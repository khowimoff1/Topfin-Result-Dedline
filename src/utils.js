// Kompaniya logosi (kirish sahifasi va sarlavhada) — public/logo.svg
export const LOGO_URL = "/logo.svg";

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

export const STATUS_LABELS = { todo: "Boshlanmagan", doing: "Jarayonda", done: "Bajarildi" };
export const PRIORITY_LABELS = { low: "Past", medium: "O'rta", high: "Yuqori" };

const MEMBER_COLORS = ["#4f46e5", "#0d9488", "#db2777", "#d97706", "#2563eb", "#7c3aed", "#059669", "#dc2626"];

export const memberColor = (index) => MEMBER_COLORS[index % MEMBER_COLORS.length];

export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

function parseLocalDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = parseLocalDate(iso);
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

/** Bugundan deadline'gacha necha kun qolgani (manfiy = kechikkan). */
export function daysLeft(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseLocalDate(iso) - today) / 86_400_000);
}

/** Deadline holati: matn + rang darajasi. */
export function deadlineInfo(task) {
  if (task.status === "done") return { label: "Bajarildi", level: "done", days: null };
  const days = daysLeft(task.deadline);
  if (days < 0) return { label: `${-days} kun kechikdi`, level: "overdue", days };
  if (days === 0) return { label: "Bugun!", level: "today", days };
  if (days === 1) return { label: "Ertaga", level: "soon", days };
  if (days <= 3) return { label: `${days} kun qoldi`, level: "soon", days };
  if (days <= 7) return { label: `${days} kun qoldi`, level: "week", days };
  return { label: `${days} kun qoldi`, level: "later", days };
}

/** Avval bajarilmaganlar, keyin deadline bo'yicha, keyin muhimlik bo'yicha. */
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
export function sortTasks(tasks) {
  return [...tasks].sort(
    (a, b) =>
      (a.status === "done") - (b.status === "done") ||
      a.deadline.localeCompare(b.deadline) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  );
}

/** "23-noyabr 2026, 14:05" */
export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()}-${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

/** "5 daqiqa oldin", "3 soat oldin", "2 kun oldin" */
export function timeAgo(iso) {
  if (!iso) return "hech qachon";
  const minutes = Math.floor((Date.now() - new Date(iso)) / 60_000);
  if (minutes < 1) return "hozirgina";
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} kun oldin`;
  return formatDateTime(iso);
}
