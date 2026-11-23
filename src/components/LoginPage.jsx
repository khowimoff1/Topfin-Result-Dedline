import { useState } from "react";
import * as api from "../api.js";

export default function LoginPage({ onLogin }) {
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
    <div className="center-screen login-screen">
      <form className="login-card form" onSubmit={submit}>
        <div className="login-head">
          <span className="login-logo">⏰</span>
          <h1>Deadline nazorati</h1>
          <p className="muted">Davom etish uchun tizimga kiring</p>
        </div>
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
      </form>
    </div>
  );
}
