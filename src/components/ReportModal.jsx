import { useMemo, useState } from "react";
import Modal from "./Modal.jsx";
import * as api from "../api.js";
import { monthlyReport, reportMonths, monthLabel, shiftMonth, tashkentDate } from "../../shared/report.js";
import { formatDate, initials, memberColor } from "../utils.js";

const RESULT = {
  onTime: ["✅", "O'z vaqtida"],
  late: ["⏰", "Kechikib bajarildi"],
  waiting: ["⏳", "Tasdiq kutilmoqda"],
  missed: ["❌", "Bajarilmagan"],
  upcoming: ["🕓", "Muddati kelmagan"],
};

const tone = (p) => (p >= 80 ? "good" : p >= 50 ? "mid" : "bad");

export default function ReportModal({ board, canEdit, onToast, onClose }) {
  const today = tashkentDate(new Date().toISOString());
  const months = useMemo(() => reportMonths(board, today), [board, today]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [open, setOpen] = useState(null);
  const [sending, setSending] = useState(false);
  const report = useMemo(() => monthlyReport(board, month, today), [board, month, today]);
  const colorOf = (id) => memberColor(Math.max(0, board.members.findIndex((m) => m.id === id)));
  const isCurrent = month === today.slice(0, 7);
  const { team } = report;

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
    const head = ["Xodim", "Jami", "Bajarildi", "Foiz", "O'z vaqtida", "Kechikib", "Tasdiq kutilmoqda", "Bajarilmagan", "Muddati kelmagan"];
    const line = (name, r) => [name, r.total, r.done, `${r.percent}%`, r.onTime, r.late, r.waiting, r.missed, r.upcoming];
    const rows = [head, ...report.members.map((m) => line(m.name, m)), line("JAMOA", team)];
    const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `hisobot-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Modal title="📊 Oylik hisobot" onClose={onClose} wide>
      <div className="report-modal">
      <div className="report-bar">
        <div className="month-switch">
          <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Oldingi oy">
            ‹
          </button>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {(months.includes(month) ? months : [month, ...months]).map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Keyingi oy">
            ›
          </button>
        </div>
        <span className="spacer" />
        <button className="btn btn-sm" onClick={downloadCsv} disabled={!team.total}>
          📥 Excel (CSV)
        </button>
        {canEdit && (
          <button className="btn btn-sm" onClick={sendToTelegram} disabled={sending || !team.total}>
            {sending ? "Yuborilmoqda…" : "📨 Telegramga yuborish"}
          </button>
        )}
      </div>

      {team.total === 0 ? (
        <p className="empty report-empty">{report.label} oyida deadline'i tushgan vazifa yo'q.</p>
      ) : (
        <>
          <div className="report-team">
            <div className={`report-big tone-${tone(team.percent)}`}>
              <b>{team.percent}%</b>
              <span>jamoa bo'yicha bajarildi</span>
            </div>
            <ReportNum value={team.total} label="Jami vazifa" />
            <ReportNum value={team.onTime} label="✅ O'z vaqtida" />
            <ReportNum value={team.late} label="⏰ Kechikib" />
            <ReportNum value={team.missed} label="❌ Bajarilmagan" />
            {team.waiting > 0 && <ReportNum value={team.waiting} label="⏳ Tasdiq kutilmoqda" />}
            {team.upcoming > 0 && <ReportNum value={team.upcoming} label="🕓 Muddati kelmagan" />}
          </div>

          <div className="report-list">
            {report.members.map((m, i) => (
              <div key={m.id} className="report-row">
                <button className="report-head" onClick={() => setOpen(open === m.id ? null : m.id)} disabled={!m.total}>
                  <span className="report-rank">{m.total ? i + 1 : "–"}</span>
                  <span className="avatar sm" style={{ background: colorOf(m.id) }}>
                    {initials(m.name)}
                  </span>
                  <span className="report-name">
                    <b>{m.name}</b>
                    <small className="muted">
                      {m.total
                        ? `${m.done} / ${m.total} bajarildi · o'z vaqtida ${m.onTimePercent}%`
                        : "Bu oyda vazifa yo'q"}
                    </small>
                  </span>
                  {m.total > 0 && (
                    <>
                      <span className="report-bar-track">
                        <span className={`tone-bg-${tone(m.percent)}`} style={{ width: `${m.percent}%` }} />
                      </span>
                      <span className={`report-percent tone-${tone(m.percent)}`}>{m.percent}%</span>
                      <span className="report-chevron">{open === m.id ? "▾" : "▸"}</span>
                    </>
                  )}
                </button>
                {m.total > 0 && (
                  <div className="report-chips">
                    {Object.entries(RESULT).map(([key, [icon, label]]) =>
                      m[key] ? (
                        <span key={key} className={`chip chip-${key}`}>
                          {icon} {label}: {m[key]}
                        </span>
                      ) : null
                    )}
                  </div>
                )}
                {open === m.id && (
                  <ul className="report-tasks">
                    {m.tasks.map((t) => (
                      <li key={t.id}>
                        <span title={RESULT[t.result][1]}>{RESULT[t.result][0]}</span>
                        <span className="report-task-title">{t.title}</span>
                        <span className="muted small">
                          📅 {formatDate(t.deadline)}
                          {t.completedAt && ` · yopildi ${formatDate(tashkentDate(t.completedAt))}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <p className="muted small report-note">
        Hisobotga deadline'i {report.label.toLowerCase()} oyiga tushgan vazifalar kiradi. Foiz = bajarilgan / jami.
        {isCurrent && " Oy hali tugamagan — muddati kelmagan vazifalar ham jamiga kiradi."}
      </p>
      </div>
    </Modal>
  );
}

function ReportNum({ value, label }) {
  return (
    <div className="report-num">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
