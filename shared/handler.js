// API so'rovlarini qayta ishlash. Bir xil kod ikki joyda ishlaydi:
//  - Netlify'da:   netlify/functions/api.mjs  (saqlash: Netlify Blobs)
//  - Kompyuterda:  vite.config.js → npm start (saqlash: data/*.json)
//
// storage — { get(key): Promise<any|null>, set(key, value): Promise<void> }
//   kalitlar: "board" (vazifalar), "users" (Google foydalanuvchilar), "log" (kirishlar tarixi),
//             "telegram" (bot ulanishlari)
// auth    — authConfigFromEnv(...) natijasi
//
// Rollar:
//  - admin  (login + parol)                     — hammasini ko'radi va o'zgartiradi
//  - viewer (boshqalar, Google orqali, ruxsat bilan) — faqat ko'radi
import { TOKEN_DAYS, readToken, safeEqual, signToken, verifyGoogleIdToken } from "./auth.js";
import { BoardError, addTask, deleteTask, setMembers, updateTask } from "./board.js";
import { USER_STATUSES, addLog, changeUserStatus, loadBoard, loadUsers, nowIso } from "./store.js";
import {
  handleTelegramUpdate,
  makeTelegram,
  notifyAccessRequest,
  notifyTaskChange,
  sendDailyReminders,
  sendMonthlyReport,
  setupWebhook,
  telegramStatus,
  unlinkTelegram,
  webhookSecret,
} from "./telegram.js";

const SEEN_EVERY_MS = 5 * 60 * 1000; // "oxirgi faollik"ni 5 daqiqada bir yangilaymiz
const VISIT_GAP_MS = 30 * 60 * 1000; // 30 daqiqadan ko'p tanaffusdan keyin qayta kirish — jurnalga "ochdi"

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const expiry = () => Date.now() + TOKEN_DAYS * 86_400_000;

async function readBody(req) {
  try {
    return await req.json();
  } catch {
    throw new BoardError("Noto'g'ri so'rov");
  }
}

async function accessData(storage) {
  return { users: await loadUsers(storage), log: (await storage.get("log")) ?? [] };
}

export async function handleApi(req, storage, auth, options = {}) {
  const { pathname } = new URL(req.url);
  const [resource, rawId, ...rest] = pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const id = rawId && decodeURIComponent(rawId);
  const method = req.method;
  if (rest.length) return json({ error: "Topilmadi" }, 404);
  const tg = makeTelegram(auth, options.fetch); // bot ulanmagan bo'lsa null

  try {
    // ---------- Ochiq manzillar (kirishsiz) ----------

    if (resource === "config" && method === "GET" && !id) {
      return json({ googleClientId: auth.googleClientId || null });
    }

    // Telegram bot xabarlari (Telegram serveridan keladi, maxfiy kalit bilan tekshiriladi)
    if (resource === "telegram" && id === "webhook" && method === "POST") {
      const given = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
      if (!tg || !safeEqual(given, webhookSecret(tg.secret))) return json({ error: "Ruxsat yo'q" }, 403);
      try {
        await handleTelegramUpdate(tg, storage, (await readBody(req)) ?? {});
      } catch (err) {
        console.error("Telegram webhook:", err); // Telegram qayta-qayta yubormasligi uchun baribir 200 qaytaramiz
      }
      return json({ ok: true });
    }

    // Admin: login + parol
    if (resource === "login" && method === "POST" && !id) {
      if (!auth.admin.password) throw new BoardError("Parol sozlanmagan: ADMIN_PASSWORD ni kiriting", 500);
      const body = (await readBody(req)) ?? {};
      const login = String(body.login ?? "").trim();
      const password = String(body.password ?? "");
      if (!(safeEqual(login.toLowerCase(), auth.admin.login.toLowerCase()) && safeEqual(password, auth.admin.password))) {
        await addLog(storage, { type: "failed", name: login.slice(0, 60) || "—" });
        await sleep(700); // parolni tanlab topishni sekinlashtirish
        throw new BoardError("Login yoki parol noto'g'ri", 401);
      }
      await addLog(storage, { type: "admin_login", name: "Admin" });
      return json({ role: "admin", name: "Admin", token: signToken({ role: "admin", exp: expiry() }, auth.secret) });
    }

    // Boshqalar: Google orqali. Birinchi marta — zayavka, admin qabul qilsa — kiradi.
    if (resource === "google" && method === "POST" && !id) {
      if (!auth.googleClientId) throw new BoardError("Google orqali kirish sozlanmagan (GOOGLE_CLIENT_ID)", 500);
      const body = (await readBody(req)) ?? {};
      const google = await verifyGoogleIdToken(body.credential, auth.googleClientId, options.getJwks);
      if (!google) throw new BoardError("Google tasdiqlamadi, qaytadan kirib ko'ring", 401);

      const users = await loadUsers(storage);
      let user = users.find((u) => u.email === google.email);
      if (!user) {
        user = { ...google, status: "pending", requestedAt: nowIso(), decidedAt: null, lastLoginAt: null, lastSeenAt: null };
        users.push(user);
        await storage.set("users", users);
        await addLog(storage, { type: "request", email: user.email, name: user.name });
        await notifyAccessRequest(tg, storage, user);
        return json({ status: "pending" });
      }
      if (user.status !== "approved") return json({ status: user.status }); // pending | rejected | blocked

      Object.assign(user, { name: google.name, picture: google.picture, lastLoginAt: nowIso(), lastSeenAt: nowIso() });
      await storage.set("users", users);
      await addLog(storage, { type: "login", email: user.email, name: user.name });
      return json({
        status: "approved",
        role: "viewer",
        name: user.name,
        email: user.email,
        picture: user.picture,
        token: signToken({ role: "viewer", email: user.email, exp: expiry() }, auth.secret),
      });
    }

    // ---------- Shu yerdan boshlab kirish shart ----------

    const authHeader = req.headers.get("authorization") ?? "";
    const session = readToken(authHeader.replace(/^Bearer\s+/i, ""), auth.secret);
    if (!session || !["admin", "viewer"].includes(session.role)) return json({ error: "Avval tizimga kiring" }, 401);

    if (session.role === "viewer") {
      // Har safar tekshiramiz: admin bloklagan bo'lsa, darhol chiqarib yuboriladi.
      const users = await loadUsers(storage);
      const user = users.find((u) => u.email === session.email && u.status === "approved");
      if (!user) return json({ error: "Ruxsatingiz bekor qilingan" }, 401);

      const sinceSeen = Date.now() - (Date.parse(user.lastSeenAt) || 0);
      if (resource === "board" && method === "GET" && sinceSeen > SEEN_EVERY_MS) {
        if (sinceSeen > VISIT_GAP_MS) await addLog(storage, { type: "visit", email: user.email, name: user.name });
        user.lastSeenAt = nowIso();
        await storage.set("users", users);
      }
    }

    // ---------- Foydalanuvchilar va tarix (faqat admin) ----------

    if (resource === "users") {
      if (session.role !== "admin") return json({ error: "Faqat admin uchun" }, 403);
      if (method === "GET" && !id) return json(await accessData(storage));
      if (!id) return json({ error: "Topilmadi" }, 404);

      const users = await loadUsers(storage);
      const index = users.findIndex((u) => u.email === id.toLowerCase());
      if (index === -1) throw new BoardError("Foydalanuvchi topilmadi", 404);
      const user = users[index];

      if (method === "PUT") {
        const status = (await readBody(req))?.status;
        if (!USER_STATUSES.includes(status)) throw new BoardError("Noto'g'ri holat");
        await changeUserStatus(storage, user.email, status);
      } else if (method === "DELETE") {
        users.splice(index, 1);
        await storage.set("users", users);
        await addLog(storage, { type: "removed", email: user.email, name: user.name });
      } else {
        return json({ error: "Topilmadi" }, 404);
      }
      return json(await accessData(storage));
    }

    // ---------- Vazifalar ----------

    const board = await loadBoard(storage);

    // ---------- Telegram bot sozlamalari (faqat admin) ----------

    if (resource === "telegram") {
      if (session.role !== "admin") return json({ error: "Faqat admin uchun" }, 403);
      const origin = new URL(req.url).origin;
      if (method === "GET" && !id) return json(await telegramStatus(tg, storage, board, origin));
      if (!tg) throw new BoardError("Bot ulanmagan: TELEGRAM_BOT_TOKEN ni kiriting");
      if (method === "POST" && id === "setup") {
        await setupWebhook(tg, storage, origin);
        return json(await telegramStatus(tg, storage, board, origin));
      }
      if (method === "POST" && id === "unlink") {
        const body = (await readBody(req)) ?? {};
        await unlinkTelegram(storage, { memberId: body.memberId, adminChatId: body.adminChatId });
        return json(await telegramStatus(tg, storage, board, origin));
      }
      if (method === "POST" && id === "remind") return json(await sendDailyReminders(tg, storage));
      if (method === "POST" && id === "report") {
        const month = (await readBody(req))?.month;
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? "")) throw new BoardError("Oy noto'g'ri tanlangan");
        return json(await sendMonthlyReport(tg, storage, month));
      }
      return json({ error: "Topilmadi" }, 404);
    }

    if (method === "GET" && resource === "board" && !id) return json(board);

    const isMutation =
      (resource === "tasks" && ((method === "POST" && !id) || (["PUT", "DELETE"].includes(method) && id))) ||
      (resource === "members" && method === "PUT" && !id);
    if (!isMutation) return json({ error: "Topilmadi" }, 404);
    if (session.role !== "admin") return json({ error: "Faqat admin o'zgartira oladi" }, 403);

    let next;
    if (resource === "tasks" && method === "POST") next = addTask(board, await readBody(req));
    else if (resource === "tasks" && method === "PUT") next = updateTask(board, id, await readBody(req));
    else if (resource === "tasks" && method === "DELETE") next = deleteTask(board, id);
    else next = setMembers(board, (await readBody(req))?.members);

    await storage.set("board", next);

    // Xodimga Telegram orqali xabar (bot ulangan bo'lsa)
    if (resource === "tasks") {
      const oldIds = new Set(board.tasks.map((t) => t.id));
      const before = id ? board.tasks.find((t) => t.id === id) ?? null : null;
      const after = id ? next.tasks.find((t) => t.id === id) ?? null : next.tasks.find((t) => !oldIds.has(t.id)) ?? null;
      await notifyTaskChange(tg, storage, next, before, after);
    }
    return json(next);
  } catch (err) {
    if (err instanceof BoardError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: "Serverda xatolik yuz berdi" }, 500);
  }
}
