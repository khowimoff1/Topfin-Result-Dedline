// Telegram bot: xodimlarni ulash, vazifa xabarlari, tugmalar, buyruqlar va ertalabki eslatma.
// Faqat serverda ishlaydi. Bot tokeni: TELEGRAM_BOT_TOKEN.
//
// Bot nima qiladi:
//  - xodimga yangi vazifa belgilansa / deadline o'zgarsa / vazifa o'tkazilsa yoki bekor qilinsa — xabar
//  - xabardagi tugmalar: "▶️ Boshladim", "✅ Bajarildi" — saytdagi holat ham o'zgaradi, admin'ga xabar boradi
//  - /vazifalar, /bugun — xodimning o'z vazifalari; /hammasi — admin uchun umumiy holat
//  - har kuni ertalab — bugungi, ertangi va kechikkan vazifalar haqida eslatma
//  - saytga yangi zayavka kelsa — admin'ga "Qabul qilish / Rad etish" tugmalari bilan xabar
import { createHash, createHmac } from "node:crypto";
import { safeEqual } from "./auth.js";
import { BoardError, updateTask } from "./board.js";
import { addLog, changeUserStatus, loadBoard, loadTelegram, loadUsers, nowIso } from "./store.js";

const TIME_ZONE = "Asia/Tashkent";
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const PRIORITY = { high: "🔥 Yuqori", medium: "O'rta", low: "Past" };
const STATUS = { todo: "Boshlanmagan", doing: "Jarayonda", done: "Bajarildi" };
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

export const BOT_COMMANDS = [
  { command: "vazifalar", description: "Mening faol vazifalarim" },
  { command: "bugun", description: "Bugungi, ertangi va kechikkan vazifalar" },
  { command: "hammasi", description: "Umumiy holat (admin uchun)" },
  { command: "yordam", description: "Bot haqida" },
];

// ---------- Yordamchilar ----------

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function daysBetween(fromIso, toIso) {
  const utc = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(toIso) - utc(fromIso)) / 86_400_000);
}

const fmtDate = (iso) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}-${MONTHS[m - 1]}`;
};

function leftLabel(task, today) {
  if (task.status === "done") return "✅ Bajarildi";
  const d = daysBetween(today, task.deadline);
  if (d < 0) return `🔴 ${-d} kun kechikdi`;
  if (d === 0) return "🟠 Bugun!";
  if (d === 1) return "🟡 Ertaga";
  if (d <= 3) return `🟡 ${d} kun qoldi`;
  return `🟢 ${d} kun qoldi`;
}

const sortActive = (tasks) =>
  tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

const emailHash = (email) => createHash("sha256").update(email).digest("hex").slice(0, 16);

// ---------- Ulanish havolalari ----------

const sign = (secret, text) => createHmac("sha256", secret).update(`tg:${text}`).digest("base64url").slice(0, 10);

export const adminLinkCode = (secret) => `a_${sign(secret, "admin")}`;
export const memberLinkCode = (secret, memberId) => `m_${memberId}_${sign(secret, `m:${memberId}`)}`;
export const webhookSecret = (secret) => createHmac("sha256", secret).update("tg-webhook").digest("hex").slice(0, 32);

function parseLinkCode(secret, code) {
  if (!code) return null;
  if (code.startsWith("a_")) return safeEqual(code, adminLinkCode(secret)) ? { type: "admin" } : null;
  const match = /^m_(.+)_(.{10})$/.exec(code);
  if (!match) return null;
  return safeEqual(code, memberLinkCode(secret, match[1])) ? { type: "member", memberId: match[1] } : null;
}

// ---------- Telegram API ----------

/** Bot ulanmagan bo'lsa null qaytaradi — shunda xabarlar shunchaki yuborilmaydi. */
export function makeTelegram(auth, fetchImpl = globalThis.fetch) {
  if (!auth.telegramToken) return null;
  async function call(method, params = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetchImpl(`https://api.telegram.org/bot${auth.telegramToken}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.description || "Telegram xatosi");
      return data.result;
    } finally {
      clearTimeout(timer);
    }
  }
  return { call, secret: auth.secret };
}

/** Xabar yuborish. Xatoda sayt ishini to'xtatmaydi — faqat log'ga yozadi. */
async function send(tg, chatId, text, keyboard) {
  try {
    return await tg.call("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(keyboard && { reply_markup: { inline_keyboard: keyboard } }),
    });
  } catch (err) {
    console.error("Telegram sendMessage:", err.message);
    return null;
  }
}

async function edit(tg, message, text, keyboard) {
  try {
    await tg.call("editMessageText", {
      chat_id: message.chat.id,
      message_id: message.message_id,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: keyboard ?? [] },
    });
  } catch (err) {
    if (!/not modified/i.test(err.message)) console.error("Telegram editMessageText:", err.message);
  }
}

async function notifyAdmins(tg, storage, text, keyboard, exceptChatId) {
  const { admins } = await loadTelegram(storage);
  await Promise.all(admins.filter((a) => a.chatId !== exceptChatId).map((a) => send(tg, a.chatId, text, keyboard)));
}

// ---------- Xabar matnlari ----------

function taskText(task, today, heading) {
  return [
    heading,
    "",
    `📌 <b>${esc(task.title)}</b>`,
    task.description && `<i>${esc(short(task.description, 500))}</i>`,
    `📅 Deadline: <b>${fmtDate(task.deadline)}</b> — ${leftLabel(task, today)}`,
    `⚡ Muhimlik: ${PRIORITY[task.priority]}`,
    `📍 Holat: <b>${STATUS[task.status]}</b>`,
  ]
    .filter(Boolean)
    .join("\n");
}

function taskButtons(task) {
  if (task.status === "done") return [[{ text: "↩️ Qayta ochish", callback_data: `s:${task.id}:doing` }]];
  const row = [];
  if (task.status === "todo") row.push({ text: "▶️ Boshladim", callback_data: `s:${task.id}:doing` });
  row.push({ text: "✅ Bajarildi", callback_data: `s:${task.id}:done` });
  return [row];
}

function taskListMessage(member, tasks, today) {
  const active = sortActive(tasks);
  if (active.length === 0) return { text: `🎉 <b>${esc(member.name)}</b>, faol vazifangiz yo'q!`, keyboard: [] };
  const lines = active.map((t, i) => `${i + 1}. <b>${esc(t.title)}</b>\n    📅 ${fmtDate(t.deadline)} — ${leftLabel(t, today)} · ${STATUS[t.status]}`);
  const keyboard = active.slice(0, 15).map((t, i) => [
    ...(t.status === "todo" ? [{ text: `▶️ ${i + 1}. Boshladim`, callback_data: `l:${t.id}:doing` }] : []),
    { text: `✅ ${i + 1}. Bajarildi`, callback_data: `l:${t.id}:done` },
  ]);
  return {
    text: `📋 <b>${esc(member.name)}</b>, faol vazifalaringiz (${active.length} ta):\n\n${lines.join("\n\n")}`,
    keyboard,
  };
}

function dueSoonText(tasks, today, withOwner) {
  const groups = { overdue: [], today: [], tomorrow: [] };
  for (const t of sortActive(tasks)) {
    const d = daysBetween(today, t.deadline);
    const owner = withOwner ? ` — ${esc(withOwner(t))}` : "";
    const line = `• ${esc(t.title)}${owner}`;
    if (d < 0) groups.overdue.push(`${line} <i>(${-d} kun)</i>`);
    else if (d === 0) groups.today.push(line);
    else if (d === 1) groups.tomorrow.push(line);
  }
  const parts = [];
  if (groups.overdue.length) parts.push(`🔴 <b>Kechikkan:</b>\n${groups.overdue.join("\n")}`);
  if (groups.today.length) parts.push(`🟠 <b>Bugun:</b>\n${groups.today.join("\n")}`);
  if (groups.tomorrow.length) parts.push(`🟡 <b>Ertaga:</b>\n${groups.tomorrow.join("\n")}`);
  return parts.join("\n\n");
}

function overviewText(board, today) {
  const rows = board.members.map((m) => {
    const active = sortActive(board.tasks.filter((t) => t.assigneeId === m.id));
    const overdue = active.filter((t) => daysBetween(today, t.deadline) < 0).length;
    const next = active[0] ? ` · eng yaqini: ${fmtDate(active[0].deadline)}` : "";
    return `👤 <b>${esc(m.name)}</b>: ${active.length} ta faol${overdue ? `, 🔴 ${overdue} ta kechikkan` : ""}${next}`;
  });
  const done = board.tasks.filter((t) => t.status === "done").length;
  return `📊 <b>Umumiy holat</b> (${fmtDate(today)})\n\n${rows.join("\n")}\n\n✅ Bajarilgan: ${done} ta`;
}

const HELP_TEXT = [
  "🤖 <b>Deadline nazorati boti</b>",
  "",
  "Sizga vazifa belgilansa, deadline o'zgarsa yoki muddat yaqinlashsa — shu yerga xabar keladi.",
  "Xabardagi tugmalar bilan vazifani <b>boshlash</b> yoki <b>bajarildi</b> deb belgilash mumkin.",
  "",
  "/vazifalar — faol vazifalarim",
  "/bugun — bugungi, ertangi va kechikkan vazifalar",
  "/hammasi — umumiy holat (admin uchun)",
].join("\n");

// ---------- Saytdagi o'zgarishlar haqida xabar ----------

/** Vazifa qo'shilgan / o'zgargan / o'chirilganda chaqiriladi (before yoki after null bo'lishi mumkin). */
export async function notifyTaskChange(tg, storage, board, before, after) {
  if (!tg) return;
  const { members } = await loadTelegram(storage);
  const today = todayISO();
  const nameOf = (id) => board.members.find((m) => m.id === id)?.name ?? "";
  const chatOf = (id) => members[id]?.chatId;
  const jobs = [];
  const tell = (memberId, text, keyboard) => chatOf(memberId) && jobs.push(send(tg, chatOf(memberId), text, keyboard));

  if (!before && after) {
    tell(after.assigneeId, taskText(after, today, `🆕 <b>${esc(nameOf(after.assigneeId))}, sizga yangi vazifa belgilandi!</b>`), taskButtons(after));
  } else if (before && !after) {
    tell(before.assigneeId, `🗑 Vazifa bekor qilindi:\n<b>${esc(before.title)}</b>`);
  } else if (before && after) {
    if (before.assigneeId !== after.assigneeId) {
      tell(after.assigneeId, taskText(after, today, `🔁 <b>${esc(nameOf(after.assigneeId))}, sizga vazifa o'tkazildi!</b>`), taskButtons(after));
      tell(before.assigneeId, `↪️ <b>${esc(after.title)}</b> vazifasi ${esc(nameOf(after.assigneeId))}ga o'tkazildi.`);
    } else if (before.deadline !== after.deadline) {
      tell(after.assigneeId, taskText(after, today, `⏰ <b>Deadline o'zgardi:</b> ${fmtDate(before.deadline)} → ${fmtDate(after.deadline)}`), taskButtons(after));
    } else if (before.title !== after.title || before.description !== after.description || before.priority !== after.priority) {
      tell(after.assigneeId, taskText(after, today, "✏️ <b>Vazifa yangilandi</b>"), taskButtons(after));
    }
  }
  await Promise.all(jobs);
}

/** Saytga yangi zayavka kelganda admin'larga xabar. */
export async function notifyAccessRequest(tg, storage, user) {
  if (!tg) return;
  const key = emailHash(user.email);
  await notifyAdmins(
    tg,
    storage,
    `📨 <b>Yangi zayavka</b>\n\n👤 ${esc(user.name)}\n✉️ ${esc(user.email)}\n\nSaytga kirish uchun ruxsat so'radi.`,
    [[
      { text: "✅ Qabul qilish", callback_data: `u:${key}:approved` },
      { text: "⛔ Rad etish", callback_data: `u:${key}:rejected` },
    ]]
  );
}

// ---------- Ertalabki eslatma ----------

export async function sendDailyReminders(tg, storage) {
  if (!tg) return { sent: 0 };
  const board = await loadBoard(storage);
  const { members, admins } = await loadTelegram(storage);
  const today = todayISO();
  const jobs = [];

  for (const member of board.members) {
    const chatId = members[member.id]?.chatId;
    if (!chatId) continue;
    const body = dueSoonText(board.tasks.filter((t) => t.assigneeId === member.id), today);
    if (!body) continue;
    jobs.push(send(tg, chatId, `☀️ <b>Xayrli tong, ${esc(member.name)}!</b>\n\n${body}\n\nBarcha vazifalar: /vazifalar`));
  }

  if (sortActive(board.tasks).length > 0) {
    const nameOf = (t) => board.members.find((m) => m.id === t.assigneeId)?.name ?? "";
    const soon = dueSoonText(board.tasks, today, nameOf);
    const text = `☀️ <b>Xayrli tong!</b>\n\n${overviewText(board, today)}${soon ? `\n\n${soon}` : ""}`;
    for (const admin of admins) jobs.push(send(tg, admin.chatId, text));
  }

  const results = await Promise.all(jobs);
  return { sent: results.filter(Boolean).length };
}

// ---------- Botga kelgan xabarlar (webhook) ----------

export async function handleTelegramUpdate(tg, storage, update) {
  if (update.callback_query) return onCallback(tg, storage, update.callback_query);
  if (update.message?.text && update.message.chat?.type === "private") return onMessage(tg, storage, update.message);
}

function whoIs(tgData, board, chatId) {
  const memberId = Object.keys(tgData.members).find((id) => tgData.members[id].chatId === chatId);
  return {
    member: memberId ? board.members.find((m) => m.id === memberId) ?? null : null,
    isAdmin: tgData.admins.some((a) => a.chatId === chatId),
  };
}

const tgName = (from) => [from?.first_name, from?.last_name].filter(Boolean).join(" ") || from?.username || "—";

async function onMessage(tg, storage, message) {
  const chatId = message.chat.id;
  const [rawCommand, payload] = message.text.trim().split(/\s+/, 2);
  const command = rawCommand.toLowerCase().replace(/@.*$/, "");
  const board = await loadBoard(storage);
  const tgData = await loadTelegram(storage);
  const today = todayISO();

  if (command === "/start" && payload) {
    const link = parseLinkCode(tg.secret, payload);
    const info = { chatId, name: tgName(message.from), username: message.from?.username ?? "", linkedAt: nowIso() };

    if (link?.type === "admin") {
      tgData.admins = [...tgData.admins.filter((a) => a.chatId !== chatId), info];
      await storage.set("telegram", tgData);
      await addLog(storage, { type: "tg_link", name: "Admin", detail: `Telegram: ${info.name}` });
      return send(tg, chatId, `✅ <b>Siz admin sifatida ulandingiz!</b>\n\nEndi bu yerga keladi:\n• yangi zayavkalar (qabul/rad tugmalari bilan)\n• xodimlar vazifani boshlagani yoki bajargani\n• har kuni ertalab umumiy holat\n\n/hammasi — umumiy holat\n/bugun — bugungi va kechikkan vazifalar`);
    }

    const member = link?.type === "member" && board.members.find((m) => m.id === link.memberId);
    if (member) {
      for (const id of Object.keys(tgData.members)) if (tgData.members[id].chatId === chatId) delete tgData.members[id];
      tgData.members[member.id] = info;
      await storage.set("telegram", tgData);
      await addLog(storage, { type: "tg_link", name: member.name, detail: `Telegram: ${info.name}` });
      await notifyAdmins(tg, storage, `🔗 <b>${esc(member.name)}</b> Telegram botga ulandi (${esc(info.name)}).`);
      const intro = `✅ <b>Salom, ${esc(member.name)}!</b>\n\nSiz «Deadline nazorati» botiga ulandingiz. Yangi vazifalar, deadline o'zgarishlari va ertalabki eslatmalar shu yerga keladi.`;
      await send(tg, chatId, intro);
      const list = taskListMessage(member, board.tasks.filter((t) => t.assigneeId === member.id), today);
      return send(tg, chatId, list.text, list.keyboard);
    }

    return send(tg, chatId, "⚠️ Bu havola eskirgan yoki noto'g'ri. Admin'dan yangi havola so'rang.");
  }

  const { member, isAdmin } = whoIs(tgData, board, chatId);

  if (!member && !isAdmin) {
    return send(tg, chatId, "👋 Salom! Bu <b>Deadline nazorati</b> jamoa boti.\n\nUlanish uchun admin bergan <b>maxsus havolani</b> bosing.");
  }

  if (command === "/vazifalar" || command === "/tasks") {
    if (!member) return send(tg, chatId, "Siz admin sifatida ulangansiz. Umumiy holat: /hammasi");
    const list = taskListMessage(member, board.tasks.filter((t) => t.assigneeId === member.id), today);
    return send(tg, chatId, list.text, list.keyboard);
  }

  if (command === "/bugun" || command === "/today") {
    const nameOf = (t) => board.members.find((m) => m.id === t.assigneeId)?.name ?? "";
    const own = member ? dueSoonText(board.tasks.filter((t) => t.assigneeId === member.id), today) : "";
    const all = isAdmin ? dueSoonText(board.tasks, today, nameOf) : "";
    const parts = [];
    if (member) parts.push(own ? `👤 <b>Sizning vazifalaringiz:</b>\n\n${own}` : "🎉 Bugun va ertaga muddati tugaydigan vazifangiz yo'q.");
    if (isAdmin) parts.push(all ? `👥 <b>Butun jamoa:</b>\n\n${all}` : "👥 Jamoada bugun/ertaga muddati tugaydigan yoki kechikkan vazifa yo'q.");
    return send(tg, chatId, parts.join("\n\n———\n\n"));
  }

  if (command === "/hammasi" || command === "/all") {
    if (!isAdmin) return send(tg, chatId, "Bu buyruq faqat admin uchun. Sizning vazifalaringiz: /vazifalar");
    return send(tg, chatId, overviewText(board, today));
  }

  return send(tg, chatId, HELP_TEXT);
}

async function onCallback(tg, storage, query) {
  const answer = (text) => tg.call("answerCallbackQuery", { callback_query_id: query.id, text }).catch(() => {});
  const chatId = query.message?.chat?.id;
  const [kind, key, value] = String(query.data ?? "").split(":");
  const tgData = await loadTelegram(storage);
  let board = await loadBoard(storage);
  const { member, isAdmin } = whoIs(tgData, board, chatId);

  // Vazifa holatini o'zgartirish (s: bitta vazifa xabari, l: ro'yxat xabari)
  if (kind === "s" || kind === "l") {
    const task = board.tasks.find((t) => t.id === key);
    if (!task) return answer("Vazifa topilmadi — o'chirilgan bo'lishi mumkin");
    const isOwner = member && task.assigneeId === member.id;
    if (!isOwner && !isAdmin) return answer("Bu vazifa sizga tegishli emas");
    if (!["doing", "done"].includes(value)) return answer("Noto'g'ri buyruq");

    if (task.status !== value) {
      try {
        board = updateTask(board, task.id, { status: value });
      } catch (err) {
        return answer(err instanceof BoardError ? err.message : "Xatolik");
      }
      await storage.set("board", board);
      const actor = isOwner ? member.name : "Admin";
      const action = value === "done" ? "bajardi" : task.status === "done" ? "qayta ochdi" : "boshladi";
      await addLog(storage, { type: `tg_${value}`, name: actor, detail: task.title });
      const icon = value === "done" ? "✅" : "▶️";
      await notifyAdmins(tg, storage, `${icon} <b>${esc(actor)}</b> vazifani ${action}:\n<b>${esc(task.title)}</b>`, null, chatId);
    }

    const updated = board.tasks.find((t) => t.id === key);
    const today = todayISO();
    if (kind === "s") {
      await edit(tg, query.message, taskText(updated, today, value === "done" ? "✅ <b>Bajarildi!</b> Rahmat 👏" : "▶️ <b>Jarayonda</b>"), taskButtons(updated));
    } else if (member) {
      const list = taskListMessage(member, board.tasks.filter((t) => t.assigneeId === member.id), today);
      await edit(tg, query.message, list.text, list.keyboard);
    }
    return answer(value === "done" ? "✅ Bajarildi deb belgilandi" : "▶️ Jarayonda deb belgilandi");
  }

  // Zayavkani qabul qilish / rad etish (faqat admin)
  if (kind === "u") {
    if (!isAdmin) return answer("Faqat admin uchun");
    const user = (await loadUsers(storage)).find((u) => emailHash(u.email) === key);
    if (!user) return answer("Foydalanuvchi topilmadi");
    if (user.status !== "pending") {
      await edit(tg, query.message, `${query.message.text ?? ""}\n\nℹ️ Allaqachon hal qilingan`);
      return answer("Bu zayavka allaqachon hal qilingan");
    }
    if (!["approved", "rejected"].includes(value)) return answer("Noto'g'ri buyruq");
    await changeUserStatus(storage, user.email, value);
    const result = value === "approved" ? "✅ <b>Qabul qilindi</b>" : "⛔ <b>Rad etildi</b>";
    await edit(tg, query.message, `📨 <b>Zayavka</b>\n\n👤 ${esc(user.name)}\n✉️ ${esc(user.email)}\n\n${result}`);
    return answer(value === "approved" ? "Ruxsat berildi" : "Rad etildi");
  }

  return answer("");
}

// ---------- Admin sozlamalari (sayt orqali) ----------

export async function telegramStatus(tg, storage, board, origin) {
  if (!tg) return { configured: false };
  const tgData = await loadTelegram(storage);
  let webhook = null;
  let error = "";
  try {
    if (!tgData.botUsername) {
      tgData.botUsername = (await tg.call("getMe")).username;
      await storage.set("telegram", tgData);
    }
    const info = await tg.call("getWebhookInfo");
    webhook = {
      connected: info.url === `${origin}/api/telegram/webhook`,
      url: info.url || "",
      lastError: info.last_error_message || "",
    };
  } catch (err) {
    error = `Telegram bilan bog'lanib bo'lmadi: ${err.message}`;
  }

  const link = (code) => (tgData.botUsername ? `https://t.me/${tgData.botUsername}?start=${code}` : "");
  return {
    configured: true,
    error,
    botUsername: tgData.botUsername,
    webhook,
    adminLink: link(adminLinkCode(tg.secret)),
    admins: tgData.admins,
    members: board.members.map((m) => ({
      id: m.id,
      name: m.name,
      link: link(memberLinkCode(tg.secret, m.id)),
      linked: tgData.members[m.id] ?? null,
    })),
  };
}

export async function setupWebhook(tg, storage, origin) {
  if (!origin.startsWith("https://")) {
    throw new BoardError("Botni faqat Netlify'dagi (https) saytdan ulash mumkin — kompyuterdagi saytdan emas.");
  }
  await tg.call("setWebhook", {
    url: `${origin}/api/telegram/webhook`,
    secret_token: webhookSecret(tg.secret),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await tg.call("setMyCommands", { commands: BOT_COMMANDS });
  const tgData = await loadTelegram(storage);
  tgData.botUsername = (await tg.call("getMe")).username;
  await storage.set("telegram", tgData);
}

export async function unlinkTelegram(storage, { memberId, adminChatId }) {
  const tgData = await loadTelegram(storage);
  if (memberId) delete tgData.members[memberId];
  if (adminChatId) tgData.admins = tgData.admins.filter((a) => a.chatId !== adminChatId);
  await storage.set("telegram", tgData);
}
