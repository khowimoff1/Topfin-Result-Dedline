// Oylik hisobot (svod): har bir xodim shu oyda qancha vazifani yopdi.
// Sayt (Hisobot oynasi) va Telegram bot (/hisobot, oy boshidagi xabar) bir xil hisobni ishlatadi.
//
// Qaysi vazifalar oyga kiradi: deadline'i shu oyga to'g'ri kelganlari.
//  - bajarildi      — status "done"
//  - o'z vaqtida    — deadline kuni yoki undan oldin yopilgan
//  - kechikib       — deadline'dan keyin yopilgan
//  - tasdiq kutadi  — xodim "bajardim" degan, admin hali tasdiqlamagan
//  - bajarilmagan   — deadline o'tgan, hali yopilmagan
//  - muddati kelmagan — deadline hali oldinda (joriy oy uchun)

export const MONTH_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

const TIME_ZONE = "Asia/Tashkent";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** ISO vaqt → Toshkent bo'yicha sana (YYYY-MM-DD). */
export const tashkentDate = (iso) => dayFmt.format(new Date(iso));

/** "2026-11" → "Noyabr 2026" */
export function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Oyni siljitish: shiftMonth("2026-01", -1) → "2025-12" */
export function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

function emptyRow() {
  return { total: 0, done: 0, onTime: 0, late: 0, waiting: 0, missed: 0, upcoming: 0, tasks: [] };
}

function finish(row) {
  return { ...row, percent: percent(row.done, row.total), onTimePercent: percent(row.onTime, row.total) };
}

/**
 * @param board    { members, tasks }
 * @param monthKey "YYYY-MM"
 * @param today    "YYYY-MM-DD" (Toshkent bo'yicha bugun)
 */
export function monthlyReport(board, monthKey, today) {
  const rows = new Map(board.members.map((m) => [m.id, emptyRow()]));
  const team = emptyRow();

  for (const task of board.tasks) {
    if (!task.deadline?.startsWith(`${monthKey}-`)) continue;
    const row = rows.get(task.assigneeId);
    if (!row) continue;

    let result;
    if (task.status === "done") {
      const closedOn = task.completedAt ? tashkentDate(task.completedAt) : task.deadline;
      result = closedOn <= task.deadline ? "onTime" : "late";
    } else if (task.doneRequestedAt) result = "waiting";
    else if (task.deadline < today) result = "missed";
    else result = "upcoming";

    for (const r of [row, team]) {
      r.total += 1;
      r[result] += 1;
      if (result === "onTime" || result === "late") r.done += 1;
    }
    row.tasks.push({ id: task.id, title: task.title, deadline: task.deadline, completedAt: task.completedAt, result });
  }

  const members = board.members.map((m) => {
    const row = finish(rows.get(m.id));
    row.tasks.sort((a, b) => a.deadline.localeCompare(b.deadline));
    return { id: m.id, name: m.name, role: m.role, ...row };
  });
  // Eng yaxshi natija tepada
  const ranked = [...members].sort((a, b) => b.percent - a.percent || b.onTime - a.onTime || b.total - a.total);
  const { tasks: _all, ...teamTotals } = finish(team);
  return { month: monthKey, label: monthLabel(monthKey), members: ranked, team: teamTotals };
}

/** Hisobotda tanlash mumkin bo'lgan oylar (vazifalar deadline'laridan + joriy oy), yangisi birinchi. */
export function reportMonths(board, today) {
  const set = new Set(board.tasks.map((t) => t.deadline?.slice(0, 7)).filter(Boolean));
  set.add(today.slice(0, 7));
  return [...set].sort().reverse();
}
