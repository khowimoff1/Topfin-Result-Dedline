import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import * as api from "../api.js";
import { formatDateTime, initials, memberColor } from "../utils.js";

export default function TelegramModal({ onClose, onToast }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = () =>
    api
      .fetchTelegram()
      .then((s) => {
        setStatus(s);
        setError("");
      })
      .catch((err) => setError(err.message));

  useEffect(() => {
    load();
  }, []);

  const run = async (key, fn, message) => {
    setBusy(key);
    setError("");
    try {
      const result = await fn();
      if (result?.configured !== undefined) setStatus(result);
      if (message) onToast(typeof message === "function" ? message(result) : message);
    } catch (err) {
      setError(err.message);
    }
    setBusy("");
  };

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast(`${what} havolasi nusxalandi — unga yuboring`);
    } catch {
      window.prompt("Havolani nusxa oling:", text);
    }
  };

  return (
    <Modal title="📨 Telegram bot" onClose={onClose} wide>
      <div className="users-modal tg-modal">
        {error && <p className="form-error">{error}</p>}
        {!status && !error && <p className="muted">Yuklanmoqda…</p>}

        {status && !status.configured && (
          <div className="notice">
            <b>Bot hali ulanmagan.</b> @BotFather orqali bot yarating va uning tokenini Netlify'da{" "}
            <code>TELEGRAM_BOT_TOKEN</code> o'zgaruvchisiga yozing, keyin qayta deploy qiling. Batafsil: README.md → "Telegram bot".
          </div>
        )}

        {status?.configured && (
          <>
            {status.error && <p className="form-error">{status.error}</p>}

            <section className="tg-section">
              <h3>1. Bot</h3>
              <div className="tg-row">
                <div className="user-info">
                  <b>
                    {status.botUsername ? (
                      <a href={`https://t.me/${status.botUsername}`} target="_blank" rel="noreferrer">
                        @{status.botUsername}
                      </a>
                    ) : (
                      "—"
                    )}
                  </b>
                  {status.webhook?.connected ? (
                    <span className="text-ok small">✅ Saytga ulangan — xabarlar va tugmalar ishlaydi</span>
                  ) : (
                    <span className="text-overdue small">⚠️ Saytga ulanmagan — tugmalar va buyruqlar ishlamaydi</span>
                  )}
                  {status.webhook?.lastError && <span className="muted small">Oxirgi xato: {status.webhook.lastError}</span>}
                </div>
                <button className="btn btn-primary" disabled={busy === "setup"} onClick={() => run("setup", api.setupTelegram, "Bot saytga ulandi ✅")}>
                  {status.webhook?.connected ? "Qayta ulash" : "Botni saytga ulash"}
                </button>
              </div>
            </section>

            <section className="tg-section">
              <h3>2. Admin (siz)</h3>
              <p className="muted small">Zayavkalar, xodimlar vazifani bajargani va ertalabki umumiy holat shu Telegram'ga keladi.</p>
              <div className="tg-row">
                <div className="user-info">
                  {status.admins.length === 0 ? (
                    <span className="muted">Hali ulanmagan</span>
                  ) : (
                    status.admins.map((a) => (
                      <span key={a.chatId} className="tg-linked">
                        ✅ {a.name} {a.username && <span className="muted">@{a.username}</span>}
                        <button className="link-btn danger-link" onClick={() => run(`a${a.chatId}`, () => api.unlinkTelegram({ adminChatId: a.chatId }), "Uzildi")}>
                          uzish
                        </button>
                      </span>
                    ))
                  )}
                </div>
                {status.adminLink && (
                  <a className="btn" href={status.adminLink} target="_blank" rel="noreferrer">
                    Telegram'da ulash
                  </a>
                )}
              </div>
            </section>

            <section className="tg-section">
              <h3>3. Xodimlar</h3>
              <p className="muted small">
                Har bir xodimga o'z havolasini yuboring. U havolani bosib <b>Start</b> ni bossa — bot uni taniydi va vazifalari haqida xabar
                yuboradi.
              </p>
              <ul className="user-list">
                {status.members.map((m, i) => (
                  <li key={m.id} className="user-row">
                    <span className="avatar" style={{ background: memberColor(i) }}>
                      {initials(m.name)}
                    </span>
                    <div className="user-info">
                      <b>{m.name}</b>
                      {m.linked ? (
                        <span className="text-ok small">
                          ✅ Ulangan: {m.linked.name} {m.linked.username && `(@${m.linked.username})`} · {formatDateTime(m.linked.linkedAt)}
                        </span>
                      ) : (
                        <span className="muted small">Ulanmagan</span>
                      )}
                    </div>
                    <div className="user-actions">
                      {m.link && (
                        <button className="btn" onClick={() => copy(m.link, m.name)}>
                          🔗 Havolani nusxalash
                        </button>
                      )}
                      {m.linked && (
                        <button
                          className="icon-btn danger"
                          title="Telegram'ni uzish"
                          aria-label="Telegram'ni uzish"
                          disabled={busy === m.id}
                          onClick={() => run(m.id, () => api.unlinkTelegram({ memberId: m.id }), `${m.name} uzildi`)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="tg-section tg-footer">
              <span className="muted small">Ertalabki eslatma har kuni soat 9:00 da avtomatik yuboriladi.</span>
              <button
                className="btn"
                disabled={busy === "remind"}
                onClick={() => run("remind", api.sendReminderNow, (r) => `${r.sent} ta xabar yuborildi`)}
              >
                ☀️ Eslatmani hozir yuborish
              </button>
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
