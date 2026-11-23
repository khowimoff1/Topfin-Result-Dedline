// Frontend (lokal rejim) va backend (Netlify Function) uchun umumiy mantiq.
// Barcha o'zgarishlar shu yerda tekshiriladi, shuning uchun ikkala tomonda ham
// qoidalar bir xil ishlaydi.

export const STATUSES = ["todo", "doing", "done"];
export const PRIORITIES = ["low", "medium", "high"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class BoardError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  Date.now().toString(36) + Math.random().toString(36).slice(2);

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoInDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

const cleanText = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Birinchi ochilganda yaratiladigan boshlang'ich ma'lumot (4 xodim + namunalar). */
export function createDefaultBoard() {
  const now = new Date().toISOString();
  const members = [1, 2, 3, 4].map((i) => ({ id: `m${i}`, name: `Xodim ${i}`, role: "" }));
  const examples = [
    ["Oylik hisobotni tayyorlash", "Namuna vazifa — o'chirib tashlashingiz mumkin.", "m1", -1, "high", "doing"],
    ["Mijozlar bazasini yangilash", "", "m2", 2, "medium", "todo"],
    ["Ombor qoldig'ini tekshirish", "", "m3", 6, "low", "todo"],
    ["Shartnomalarni imzolatish", "", "m4", 0, "high", "doing"],
  ];
  const tasks = examples.map(([title, description, assigneeId, days, priority, status]) => ({
    id: uid(),
    title,
    description,
    assigneeId,
    deadline: isoInDays(days),
    priority,
    status,
    createdAt: now,
    completedAt: null,
  }));
  return { members, tasks, updatedAt: now };
}

const touch = (board) => ({ ...board, updatedAt: new Date().toISOString() });

function assertObject(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BoardError("Noto'g'ri so'rov");
  }
}

function buildTask(input, board, base = {}) {
  assertObject(input);
  const src = { ...base, ...input };
  const title = cleanText(src.title, 200);
  if (!title) throw new BoardError("Vazifa nomini kiriting");
  if (!board.members.some((m) => m.id === src.assigneeId)) {
    throw new BoardError("Mas'ul xodimni tanlang");
  }
  if (!DATE_RE.test(src.deadline ?? "")) throw new BoardError("Deadline sanasini kiriting");

  const status = STATUSES.includes(src.status) ? src.status : "todo";
  let completedAt = null;
  if (status === "done") {
    completedAt = base.status === "done" && base.completedAt ? base.completedAt : new Date().toISOString();
  }

  return {
    id: base.id ?? uid(),
    title,
    description: cleanText(src.description, 2000),
    assigneeId: src.assigneeId,
    deadline: src.deadline,
    priority: PRIORITIES.includes(src.priority) ? src.priority : "medium",
    status,
    createdAt: base.createdAt ?? new Date().toISOString(),
    completedAt,
  };
}

export function addTask(board, input) {
  const task = buildTask(input, board);
  return touch({ ...board, tasks: [...board.tasks, task] });
}

export function updateTask(board, id, input) {
  const existing = board.tasks.find((t) => t.id === id);
  if (!existing) throw new BoardError("Vazifa topilmadi", 404);
  const task = buildTask(input, board, existing);
  return touch({ ...board, tasks: board.tasks.map((t) => (t.id === id ? task : t)) });
}

export function deleteTask(board, id) {
  if (!board.tasks.some((t) => t.id === id)) throw new BoardError("Vazifa topilmadi", 404);
  return touch({ ...board, tasks: board.tasks.filter((t) => t.id !== id) });
}

export function setMembers(board, list) {
  if (!Array.isArray(list) || list.length === 0) throw new BoardError("Kamida bitta xodim bo'lishi kerak");
  if (list.length > 30) throw new BoardError("Xodimlar soni juda ko'p");

  const members = list.map((m) => {
    assertObject(m);
    const name = cleanText(m.name, 60);
    if (!name) throw new BoardError("Xodim ismini kiriting");
    return {
      id: typeof m.id === "string" && m.id ? m.id : uid(),
      name,
      role: cleanText(m.role, 60),
    };
  });

  const keptIds = new Set(members.map((m) => m.id));
  for (const removed of board.members.filter((m) => !keptIds.has(m.id))) {
    if (board.tasks.some((t) => t.assigneeId === removed.id)) {
      throw new BoardError(
        `${removed.name}ga vazifalar biriktirilgan. Avval ularni boshqa xodimga o'tkazing yoki o'chiring.`
      );
    }
  }
  return touch({ ...board, members });
}
