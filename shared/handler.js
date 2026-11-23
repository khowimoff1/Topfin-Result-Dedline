// API so'rovlarini qayta ishlash. Bir xil kod ikki joyda ishlaydi:
//  - Netlify'da:   netlify/functions/api.mjs  (saqlash: Netlify Blobs)
//  - Kompyuterda:  vite.config.js → npm start (saqlash: data/board.json)
// `storage` — { get(): Promise<board|null>, set(board): Promise<void> }
// `auth`    — authConfigFromEnv(...) natijasi
//
// Rollar:
//  - admin  (boshliq)    — ko'radi va o'zgartiradi
//  - viewer (kuzatuvchi) — faqat ko'radi
import { createHash, createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { BoardError, addTask, createDefaultBoard, deleteTask, setMembers, updateTask } from "./board.js";

const TOKEN_DAYS = 30;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const sha = (s) => createHash("sha256").update(String(s)).digest();
const safeEqual = (a, b) => timingSafeEqual(sha(a), sha(b));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Sozlamalar (env) ----------

let cachedKey = null;
let cachedAuth = null;

/**
 * Login/parollarni muhit o'zgaruvchilaridan o'qiydi:
 * ADMIN_LOGIN, ADMIN_PASSWORD, VIEWER_LOGIN, VIEWER_PASSWORD, SESSION_SECRET
 */
export function authConfigFromEnv(env) {
  const users = [
    { role: "admin", login: (env.ADMIN_LOGIN || "boshliq").trim(), password: env.ADMIN_PASSWORD || "" },
    { role: "viewer", login: (env.VIEWER_LOGIN || "jamoa").trim(), password: env.VIEWER_PASSWORD || "" },
  ].filter((u) => u.password);

  const key = JSON.stringify([users, env.SESSION_SECRET || ""]);
  if (key !== cachedKey) {
    // Parol o'zgarsa kalit ham o'zgaradi va eski kirishlar bekor bo'ladi.
    const secret = scryptSync(key, "deadline-nazorati", 32);
    cachedAuth = { users, secret };
    cachedKey = key;
  }
  return cachedAuth;
}

function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token, auth) {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", auth.secret).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!(payload.exp > Date.now())) return null;
    if (!auth.users.some((u) => u.role === payload.role)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function readBody(req) {
  try {
    return await req.json();
  } catch {
    throw new BoardError("Noto'g'ri so'rov");
  }
}

// ---------- So'rovlar ----------

export async function handleApi(req, storage, auth) {
  const { pathname } = new URL(req.url);
  const [resource, rawId] = pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const id = rawId && decodeURIComponent(rawId);
  const method = req.method;

  try {
    // Kirish (login) — parolsiz ochiq yagona manzil
    if (resource === "login" && method === "POST" && !id) {
      if (auth.users.length === 0) {
        throw new BoardError("Parollar sozlanmagan: ADMIN_PASSWORD va VIEWER_PASSWORD ni kiriting", 500);
      }
      const body = (await readBody(req)) ?? {};
      const login = String(body.login ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const user = auth.users.find((u) => safeEqual(login, u.login.toLowerCase()) && safeEqual(password, u.password));
      if (!user) {
        await sleep(700); // parolni tanlab topishni sekinlashtirish
        throw new BoardError("Login yoki parol noto'g'ri", 401);
      }
      const token = signToken({ role: user.role, exp: Date.now() + TOKEN_DAYS * 86_400_000 }, auth.secret);
      return json({ role: user.role, token });
    }

    const authHeader = req.headers.get("authorization") ?? "";
    const session = verifyToken(authHeader.replace(/^Bearer\s+/i, ""), auth);
    if (!session) return json({ error: "Avval tizimga kiring" }, 401);

    let board = await storage.get();
    if (!board) {
      board = createDefaultBoard();
      await storage.set(board);
    }

    if (method === "GET" && resource === "board" && !id) return json(board);

    const isMutation =
      (resource === "tasks" && ((method === "POST" && !id) || (["PUT", "DELETE"].includes(method) && id))) ||
      (resource === "members" && method === "PUT" && !id);
    if (!isMutation) return json({ error: "Topilmadi" }, 404);
    if (session.role !== "admin") return json({ error: "Faqat boshliq o'zgartira oladi" }, 403);

    let next;
    if (resource === "tasks" && method === "POST") next = addTask(board, await readBody(req));
    else if (resource === "tasks" && method === "PUT") next = updateTask(board, id, await readBody(req));
    else if (resource === "tasks" && method === "DELETE") next = deleteTask(board, id);
    else next = setMembers(board, (await readBody(req))?.members);

    await storage.set(next);
    return json(next);
  } catch (err) {
    if (err instanceof BoardError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: "Serverda xatolik yuz berdi" }, 500);
  }
}
