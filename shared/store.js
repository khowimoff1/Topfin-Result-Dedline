// Saqlangan ma'lumotlar bilan ishlash uchun umumiy yordamchilar (sayt API va Telegram bot uchun).
// storage — { get(key), set(key, value) }; kalitlar: board, users, log, telegram
import { createDefaultBoard } from "./board.js";

export const LOG_LIMIT = 1000; // jurnalda saqlanadigan oxirgi yozuvlar soni
export const USER_STATUSES = ["approved", "rejected", "blocked"];

export const nowIso = () => new Date().toISOString();

export async function loadBoard(storage) {
  let board = await storage.get("board");
  if (!board) {
    board = createDefaultBoard();
    await storage.set("board", board);
  }
  return board;
}

export const loadUsers = async (storage) => (await storage.get("users")) ?? [];

export async function addLog(storage, entry) {
  const log = (await storage.get("log")) ?? [];
  log.unshift({ at: nowIso(), ...entry });
  await storage.set("log", log.slice(0, LOG_LIMIT));
}

/** Foydalanuvchiga ruxsat berish / rad etish / to'xtatish (sayt va bot uchun bir xil). */
export async function changeUserStatus(storage, email, status) {
  if (!USER_STATUSES.includes(status)) return null;
  const users = await loadUsers(storage);
  const user = users.find((u) => u.email === email);
  if (!user) return null;
  user.status = status;
  user.decidedAt = nowIso();
  await storage.set("users", users);
  await addLog(storage, { type: status, email: user.email, name: user.name });
  return user;
}

/** Telegram ulanishlari: { botUsername, members: { [memberId]: {chatId, ...} }, admins: [{chatId, ...}] } */
export async function loadTelegram(storage) {
  const saved = (await storage.get("telegram")) ?? {};
  return { botUsername: "", members: {}, admins: [], ...saved };
}
