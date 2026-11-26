// "📊 Hisobot" bo'limi — oylik svod: kim necha foizga yopdi, so'nggi 6 oy dinamikasi, vazifalar ro'yxati.
import { useMemo, useState } from "react";
import * as api from "../api.js";
import { monthLabel, monthlyReport, reportMonths, shiftMonth, tashkentDate, trendReport, MONTH_NAMES } from "../../shared/report.js";
import { formatDate, initials, memberColor } from "../utils.js";

// Natija turlari: tartib — stacked chiziqdagi tartib ham shu
const RESULTS = [
  { key: "onTime", icon: "✅", label: "O'z vaqtida" },
  { key: "late", icon: "⏰", label: "Kechikib" },
  { key: "waiting", icon: "⏳", label: "Tasdiq kutilmoqda" },
  { key: "missed", icon: "❌", label: "Bajarilmagan" },
  { key: "upcoming", icon: "🕓", label: "Muddati kelmagan" },
];
const RESULT_BY_KEY = Object.fromEntries(RESULTS.map((r) => [r.key, r]));
const TREND_MONTHS = 6;

const shortMonth = (key) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
};

export default function ReportPage({ board, canEdit, onToast }) {
  const today = tashkentDate(new Date().toISOString());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [memberId, setMemberId] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [sending, setSending] = useState(false);

  const months = useMemo(() => reportMonths(board, today), [board, today]);
  const report = useMemo(() => monthlyReport(board, month, today), [board, month, today]);
  const trend = useMemo(() => trendReport(board, month, TREND_MONTHS, today), [board, month, today]);

  const colorOf = (id) => memberColor(Math.max(0, board.members.findIndex((m) => m.id === id)));
  const nameOf = (id) => board.members.find((m) => m.id === id)?.name ?? "";
  const selected = memberId === "all" ? null : report.members.find((m) => m.id === memberId) ?? null;
  const totals = selected ?? report.team;
  const isCurrent = month === today.slice(0, 7);

  // Ranglangan qatorlar uchun: reytingdagi o'rin (vazifasi borlar orasida)
  const ranked = report.members.filter((m) => m.total);
  const idle = report.members.filter((m) => !m.total);

  const allTasks = useMemo(
    () =>
      report.members
        .flatMap((m) => m.tasks.map((t) => ({ ...t, memberId: m.id })))
        .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.title.localeCompare(b.title)),
    [report]
  );
  const memberTasks = allTasks.filter((t) => memberId === "all" || t.memberId === memberId);
  const shownTasks = memberTasks.filter((t) => resultFilter === "all" || t.result === resultFilter);

  async function sendToTelegram() {
    setSending(true);
    try {
      const { sent } = await api.sendMonthlyReport(month);
      onToast(sent ? `Hisobot Telegramga yuborildi (${sent} ta xabar)` : "Telegramga ulangan hech kim yo'q");
    } catch (err) {
      onToast(err.message);
    } finally {
      setSending(false);
    }
  }

  function downloadCsv() {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Xodim", "Jami", "Bajarildi", "Foiz", "O'z vaqtida", "Kechikib", "Tasdiq kutilmoqda", "Bajarilmagan", "Muddati kelmagan"];
    const line = (name, r) => [name, r.total, r.done, `${r.percent}%`, r.onTime, r.late, r.waiting, r.missed, r.upcoming];
    const rows = [
      [`Oylik hisobot: ${report.label}`],
      [],
      head,
      ...report.members.map((m) => line(m.name, m)),
      line("JAMOA", report.team),
      [],
      ["Vazifa", "Xodim", "Deadline", "Yopilgan", "Natija"],
      ...allTasks.map((t) => [t.title, nameOf(t.memberId), t.deadline, t.completedAt ? tashkentDate(t.completedAt) : "", RESULT_BY_KEY[t.result].label]),
    ];
    const csv = "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `hisobot-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="report-page">
      {/* Filtrlar — hamma bo'limlarga birdan ta'sir qiladi */}
      <section className="report-filters">
        <div className="month-switch">
          <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Oldingi oy">
            ‹
          </button>
          <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Oy">
            {(months.includes(month) ? months : [month, ...months].sort().reverse()).map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Keyingi oy">
            ›
          </button>
        </div>
        <select className="member-select" value={memberId} onChange={(e) => setMemberId(e.target.value)} aria-label="Xodim">
          <option value="all">👥 Barcha xodimlar</option>
          {board.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <button className="btn" onClick={downloadCsv} disabled={!report.team.total}>
          📥 Excel (CSV)
        </button>
        <button className="btn" onClick={() => window.print()}>
          🖨 Chop etish
        </button>
        {canEdit && (
          <button className="btn" onClick={sendToTelegram} disabled={sending || !report.team.total}>
            {sending ? "Yuborilmoqda…" : "📨 Telegramga yuborish"}
          </button>
        )}
      </section>

      <header className="report-title">
        <h2>
          {report.label} — {selected ? selected.name : "jamoa"} hisoboti
        </h2>
        <p className="muted small">
          Deadline'i shu oyga tushgan vazifalar hisobga olinadi. Foiz = bajarilgan / jami.
          {isCurrent && " Oy hali tugamagan — muddati kelmagan vazifalar ham jamiga kiradi."}
        </p>
      </header>

      {/* Asosiy raqamlar */}
      <section className="kpis">
        <div className="kpi kpi-hero">
          <span className="kpi-label">{selected ? "Natija" : "Jamoa natijasi"}</span>
          <span className="kpi-value">{totals.total ? `${totals.percent}%` : "—"}</span>
          <span className="kpi-sub">
            {totals.done} / {totals.total} vazifa bajarildi
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Jami vazifa</span>
          <span className="kpi-value">{totals.total}</span>
          <span className="kpi-sub">o'z vaqtida {totals.total ? totals.onTimePercent : 0}%</span>
        </div>
        {RESULTS.map((r) => (
          <button
            key={r.key}
            className={`kpi kpi-btn ${resultFilter === r.key ? "active" : ""}`}
            onClick={() => setResultFilter(resultFilter === r.key ? "all" : r.key)}
            title="Shu natijadagi vazifalarni ko'rsatish"
          >
            <span className="kpi-label">
              <i className={`dot res-${r.key}`} /> {r.label}
            </span>
            <span className="kpi-value">{totals[r.key]}</span>
          </button>
        ))}
      </section>

      {report.team.total === 0 ? (
        <section className="report-card">
          <p className="empty report-empty">{report.label} oyida deadline'i tushgan vazifa yo'q. Boshqa oyni tanlang.</p>
        </section>
      ) : (
        <div className="report-grid">
          {/* Reyting */}
          <section className="report-card">
            <header className="report-card-head">
              <h3>Xodimlar reytingi</h3>
              <Legend />
            </header>
            <ol className="ranking">
              {ranked.map((m, i) => (
                <li
                  key={m.id}
                  className={`rank-row ${memberId === m.id ? "selected" : ""} ${selected && memberId !== m.id ? "dimmed" : ""}`}
                  onClick={() => setMemberId(memberId === m.id ? "all" : m.id)}
                >
                  <span className="rank-place">{i + 1}</span>
                  <span className="avatar sm" style={{ background: colorOf(m.id) }}>
                    {initials(m.name)}
                  </span>
                  <span className="rank-name">
                    <b>{m.name}</b>
                    <small className="muted">{m.role || `${m.total} ta vazifa`}</small>
                  </span>
                  <span className="stack" role="img" aria-label={RESULTS.map((r) => `${r.label}: ${m[r.key]}`).join(", ")}>
                    {RESULTS.map((r) =>
                      m[r.key] ? (
                        <span
                          key={r.key}
                          className={`seg res-${r.key}`}
                          style={{ flexGrow: m[r.key] }}
                          title={`${m.name} — ${r.label}: ${m[r.key]} ta`}
                        />
                      ) : null
                    )}
                  </span>
                  <span className="rank-value">
                    <b>{m.percent}%</b>
                    <small className="muted">
                      {m.done}/{m.total}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
            {idle.length > 0 && <p className="muted small idle">Bu oyda vazifasi yo'q: {idle.map((m) => m.name).join(", ")}</p>}
          </section>

          {/* So'nggi 6 oy */}
          <section className="report-card">
            <header className="report-card-head">
              <h3>So'nggi {TREND_MONTHS} oy, % bajarildi</h3>
              <span className="heat-scale" aria-hidden="true">
                0% <i /> 100%
              </span>
            </header>
            <div className="heat-wrap">
              <table className="heat">
                <thead>
                  <tr>
                    <th />
                    {trend.months.map((m) => (
                      <th key={m} className={m === month ? "current" : ""}>
                        <button className="heat-month" onClick={() => setMonth(m)}>
                          {shortMonth(m)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trend.members.map((m) => (
                    <tr key={m.id} className={selected && memberId !== m.id ? "dimmed" : ""}>
                      <th>
                        <span className="who">
                          <span className="avatar xs" style={{ background: colorOf(m.id) }} />
                          {m.name}
                        </span>
                      </th>
                      {m.cells.map((c, i) => (
                        <HeatCell key={trend.months[i]} cell={c} name={m.name} month={trend.months[i]} current={trend.months[i] === month} />
                      ))}
                    </tr>
                  ))}
                  <tr className="heat-team">
                    <th>Jamoa</th>
                    {trend.team.map((c, i) => (
                      <HeatCell key={trend.months[i]} cell={c} name="Jamoa" month={trend.months[i]} current={trend.months[i] === month} />
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Svod jadvali */}
      {report.team.total > 0 && (
        <section className="report-card">
          <header className="report-card-head">
            <h3>Svod jadvali</h3>
          </header>
          <div className="table-scroll">
            <table className="table svod">
              <thead>
                <tr>
                  <th>Xodim</th>
                  <th className="num">Jami</th>
                  <th className="num">Bajarildi</th>
                  <th className="num">Foiz</th>
                  {RESULTS.map((r) => (
                    <th key={r.key} className="num">
                      {r.icon} {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.members.map((m) => (
                  <tr key={m.id} className={memberId === m.id ? "selected" : ""} onClick={() => setMemberId(memberId === m.id ? "all" : m.id)}>
                    <td>
                      <span className="who">
                        <span className="avatar xs" style={{ background: colorOf(m.id) }} />
                        {m.name}
                      </span>
                    </td>
                    <td className="num">{m.total}</td>
                    <td className="num">{m.done}</td>
                    <td className="num">
                      <b>{m.total ? `${m.percent}%` : "—"}</b>
                    </td>
                    {RESULTS.map((r) => (
                      <td key={r.key} className="num">
                        {m[r.key] || <span className="muted">0</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Jamoa</td>
                  <td className="num">{report.team.total}</td>
                  <td className="num">{report.team.done}</td>
                  <td className="num">{report.team.percent}%</td>
                  {RESULTS.map((r) => (
                    <td key={r.key} className="num">
                      {report.team[r.key]}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Vazifalar ro'yxati */}
      {report.team.total > 0 && (
        <section className="report-card">
          <header className="report-card-head">
            <h3>
              Vazifalar{selected ? ` — ${selected.name}` : ""} <span className="muted">({shownTasks.length})</span>
            </h3>
            <div className="segmented">
              <button className={resultFilter === "all" ? "active" : ""} onClick={() => setResultFilter("all")}>
                Hammasi {memberTasks.length}
              </button>
              {RESULTS.map((r) => {
                const n = memberTasks.filter((t) => t.result === r.key).length;
                if (!n && resultFilter !== r.key) return null;
                return (
                  <button key={r.key} className={resultFilter === r.key ? "active" : ""} onClick={() => setResultFilter(r.key)}>
                    {r.icon} {n}
                  </button>
                );
              })}
            </div>
          </header>
          {shownTasks.length === 0 ? (
            <p className="empty">Bu filtr bo'yicha vazifa yo'q.</p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Vazifa</th>
                    <th>Xodim</th>
                    <th>Deadline</th>
                    <th>Yopilgan</th>
                    <th>Natija</th>
                  </tr>
                </thead>
                <tbody>
                  {shownTasks.map((t) => {
                    const r = RESULT_BY_KEY[t.result];
                    return (
                      <tr key={t.id} className="static">
                        <td>{t.title}</td>
                        <td>
                          <span className="who">
                            <span className="avatar xs" style={{ background: colorOf(t.memberId) }} />
                            {nameOf(t.memberId)}
                          </span>
                        </td>
                        <td className="nowrap">{formatDate(t.deadline)}</td>
                        <td className="nowrap">{t.completedAt ? formatDate(tashkentDate(t.completedAt)) : <span className="muted">—</span>}</td>
                        <td className="nowrap">
                          <span className={`result-pill pill-${t.result}`}>
                            {r.icon} {r.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Legend() {
  return (
    <span className="legend">
      {RESULTS.map((r) => (
        <span key={r.key}>
          <i className={`dot res-${r.key}`} /> {r.label}
        </span>
      ))}
    </span>
  );
}

function HeatCell({ cell, name, month, current }) {
  if (!cell) {
    return (
      <td className={`heat-cell empty-cell ${current ? "current" : ""}`} title={`${name} — ${monthLabel(month)}: vazifa yo'q`}>
        —
      </td>
    );
  }
  const p = cell.percent;
  return (
    <td
      className={`heat-cell ${current ? "current" : ""}`}
      style={{ background: `color-mix(in oklab, var(--primary) ${Math.round(8 + p * 0.82)}%, #ffffff)`, color: p >= 55 ? "#fff" : "var(--text)" }}
      title={`${name} — ${monthLabel(month)}: ${p}% (${cell.done}/${cell.total})`}
    >
      {p}%
    </td>
  );
}
