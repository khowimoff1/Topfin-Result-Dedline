import { useMemo, useState } from "react";
import Modal from "./Modal.jsx";
import { formatDateTime, initials, timeAgo } from "../utils.js";

const LOG_LABELS = {
  request: ["📨", "Ruxsat so'radi (zayavka)"],
  approved: ["✅", "Ruxsat berildi"],
  rejected: ["⛔", "Zayavka rad etildi"],
  blocked: ["🚫", "Kirish to'xtatildi"],
  removed: ["🗑", "Ro'yxatdan o'chirildi"],
  login: ["🔑", "Google orqali kirdi"],
  visit: ["👁", "Saytni ochdi"],
  admin_login: ["👑", "Admin kirdi"],
  failed: ["⚠️", "Noto'g'ri parol bilan urinish"],
  tg_link: ["🔗", "Telegram botga ulandi"],
  tg_doing: ["▶️", "Telegram'da vazifani boshladi"],
  tg_done: ["✅", "Telegram'da vazifani bajardi"],
};

const STATUS_LABELS = {
  pending: "Kutmoqda",
  approved: "Ruxsat bor",
  rejected: "Rad etilgan",
  blocked: "To'xtatilgan",
};

function Avatar({ user }) {
  return user.picture ? (
    <img className="avatar user-photo" src={user.picture} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar" style={{ background: "#64748b" }}>
      {initials(user.name)}
    </span>
  );
}

export default function UsersModal({ access, onStatus, onRemove, onClose }) {
  const { users, log } = access;
  const pending = users.filter((u) => u.status === "pending");
  const others = users.filter((u) => u.status !== "pending");
  const [tab, setTab] = useState(pending.length ? "requests" : "users");
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const act = async (email, fn) => {
    setBusy(email);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    }
    setBusy("");
  };

  const people = useMemo(() => {
    const map = new Map();
    for (const e of log) {
      const key = e.email || (e.type === "admin_login" ? "admin" : "");
      if (key && !map.has(key)) map.set(key, e.email ? e.name : "Admin");
    }
    return [...map];
  }, [log]);

  const visibleLog = who ? log.filter((e) => (e.email || (e.type === "admin_login" ? "admin" : "")) === who) : log;

  return (
    <Modal title="Foydalanuvchilar va kirishlar" onClose={onClose} wide>
      <div className="users-modal">
        <div className="segmented">
          <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>
            Zayavkalar {pending.length > 0 && <span className="count-badge">{pending.length}</span>}
          </button>
          <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
            Foydalanuvchilar ({others.length})
          </button>
          <button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}>
            Kirishlar tarixi
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}

        {tab === "requests" &&
          (pending.length === 0 ? (
            <p className="empty">Yangi zayavka yo'q. Kimdir Google orqali birinchi marta kirsa, shu yerda paydo bo'ladi.</p>
          ) : (
            <ul className="user-list">
              {pending.map((u) => (
                <li key={u.email} className="user-row">
                  <Avatar user={u} />
                  <div className="user-info">
                    <b>{u.name}</b>
                    <span className="muted small">{u.email}</span>
                    <span className="muted small">So'radi: {formatDateTime(u.requestedAt)}</span>
                  </div>
                  <div className="user-actions">
                    <button className="btn btn-primary" disabled={busy === u.email} onClick={() => act(u.email, () => onStatus(u.email, "approved"))}>
                      Qabul qilish
                    </button>
                    <button className="btn btn-danger-ghost" disabled={busy === u.email} onClick={() => act(u.email, () => onStatus(u.email, "rejected"))}>
                      Rad etish
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {tab === "users" &&
          (others.length === 0 ? (
            <p className="empty">Hali hech kimga ruxsat berilmagan.</p>
          ) : (
            <ul className="user-list">
              {others.map((u) => (
                <li key={u.email} className="user-row">
                  <Avatar user={u} />
                  <div className="user-info">
                    <b>
                      {u.name} <span className={`user-status user-status-${u.status}`}>{STATUS_LABELS[u.status]}</span>
                    </b>
                    <span className="muted small">{u.email}</span>
                    <span className="muted small">
                      Oxirgi faollik: <b>{timeAgo(u.lastSeenAt)}</b>
                      {u.lastLoginAt && ` · oxirgi kirish: ${formatDateTime(u.lastLoginAt)}`}
                    </span>
                  </div>
                  <div className="user-actions">
                    {u.status === "approved" ? (
                      <button className="btn" disabled={busy === u.email} onClick={() => act(u.email, () => onStatus(u.email, "blocked"))}>
                        To'xtatish
                      </button>
                    ) : (
                      <button className="btn" disabled={busy === u.email} onClick={() => act(u.email, () => onStatus(u.email, "approved"))}>
                        Ruxsat berish
                      </button>
                    )}
                    <button
                      className="icon-btn danger"
                      title="Ro'yxatdan o'chirish"
                      aria-label="Ro'yxatdan o'chirish"
                      disabled={busy === u.email}
                      onClick={() => window.confirm(`${u.name} ro'yxatdan o'chirilsinmi? Qayta kirsa, yana zayavka yuboradi.`) && act(u.email, () => onRemove(u.email))}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {tab === "log" && (
          <>
            <div className="log-toolbar">
              <select value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">Hamma ({log.length} ta yozuv)</option>
                {people.map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
              <span className="muted small">"Saytni ochdi" — 30 daqiqadan ko'p tanaffusdan keyin qayta ochganda yoziladi.</span>
            </div>
            {visibleLog.length === 0 ? (
              <p className="empty">Hali yozuv yo'q.</p>
            ) : (
              <div className="table-wrap log-table">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Vaqt</th>
                      <th>Kim</th>
                      <th>Nima qildi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLog.map((e, i) => {
                      const [icon, label] = LOG_LABELS[e.type] ?? ["•", e.type];
                      return (
                        <tr key={`${e.at}-${i}`} className={e.type === "failed" ? "level-overdue" : ""}>
                          <td className="nowrap">{formatDateTime(e.at)}</td>
                          <td>
                            <b>{e.type === "admin_login" ? "Admin" : e.name}</b>
                            {e.email && <div className="muted small">{e.email}</div>}
                          </td>
                          <td>
                            {icon} {label}
                            {e.detail && <div className="muted small">{e.detail}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
