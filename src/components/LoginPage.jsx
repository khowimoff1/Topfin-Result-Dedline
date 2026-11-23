import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../api.js";
import GoogleButton from "./GoogleButton.jsx";

const PENDING_CHECK_MS = 20_000; // zayavka qabul qilinganini 20 soniyada bir tekshiramiz

const STATUS_MESSAGES = {
  pending: {
    icon: "⏳",
    title: "Zayavkangiz yuborildi",
    text: "Boshliq ruxsat berishi bilan sayt o'zi ochiladi. Bu sahifani yopmasangiz bo'ldi.",
  },
  rejected: { icon: "⛔", title: "Ruxsat berilmadi", text: "Boshliq zayavkangizni rad etgan. Savol bo'lsa, unga murojaat qiling." },
  blocked: { icon: "⛔", title: "Kirish to'xtatilgan", text: "Boshliq sizning kirishingizni o'chirib qo'ygan." },
};

export default function LoginPage({ onLogin, notice }) {
  const [config, setConfig] = useState(null);
  const [mode, setMode] = useState("google"); // "google" | "admin"
  const [status, setStatus] = useState(null); // pending | rejected | blocked
  const [error, setError] = useState(notice || "");
  const credential = useRef(null);

  useEffect(() => {
    api
      .getConfig()
      .then(setConfig)
      .catch((err) => {
        setConfig({ googleClientId: null });
        setError(err.message);
      });
  }, []);

  const tryGoogle = useCallback(
    async (cred) => {
      credential.current = cred;
      setError("");
      try {
        const result = await api.googleLogin(cred);
        if (result.status === "approved") onLogin(api.getSession());
        else setStatus(result.status);
      } catch (err) {
        setStatus(null);
        setError(err.message);
      }
    },
    [onLogin]
  );

  // Zayavka kutilayotganda — o'zi tekshirib turadi (Google kaliti ~1 soat amal qiladi)
  useEffect(() => {
    if (status !== "pending") return;
    const timer = setInterval(() => credential.current && tryGoogle(credential.current), PENDING_CHECK_MS);
    return () => clearInterval(timer);
  }, [status, tryGoogle]);

  const message = status && STATUS_MESSAGES[status];

  return (
    <div className="center-screen login-screen">
      <div className="login-card">
        <div className="login-head">
          <span className="login-logo">⏰</span>
          <h1>Deadline nazorati</h1>
          <p className="muted">{mode === "admin" ? "Boshliq sifatida kirish" : "Davom etish uchun tizimga kiring"}</p>
        </div>

        {mode === "google" ? (
          <div className="login-google">
            {message && (
              <div className={`login-status status-box-${status}`}>
                <span className="login-status-icon">{message.icon}</span>
                <div>
                  <b>{message.title}</b>
                  <p>{message.text}</p>
                </div>
              </div>
            )}
            {error && <p className="form-error">{error}</p>}

            {!config ? (
              <p className="muted center">Yuklanmoqda…</p>
            ) : config.googleClientId ? (
              <>
                {!message && <p className="muted small center">Jamoa a'zolari Google akkaunti orqali kiradi. Birinchi marta kirganda boshliqqa zayavka boradi.</p>}
                <GoogleButton clientId={config.googleClientId} onCredential={tryGoogle} onError={setError} />
              </>
            ) : (
              <p className="notice">Google orqali kirish hali sozlanmagan (GOOGLE_CLIENT_ID). README.md faylidagi yo'riqnomaga qarang.</p>
            )}

            <button type="button" className="link-btn" onClick={() => { setMode("admin"); setError(""); }}>
              👑 Boshliq sifatida kirish
            </button>
          </div>
        ) : (
          <AdminForm onLogin={onLogin} onBack={() => { setMode("google"); setError(""); }} />
        )}
      </div>
    </div>
  );
}

function AdminForm({ onLogin, onBack }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(await api.login(login, password));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="form login-form" onSubmit={submit}>
      <label>
        Login
        <input autoFocus autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required />
      </label>
      <label>
        Parol
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "Tekshirilmoqda…" : "Kirish"}
      </button>
      <button type="button" className="link-btn" onClick={onBack}>
        ← Google orqali kirish
      </button>
    </form>
  );
}
