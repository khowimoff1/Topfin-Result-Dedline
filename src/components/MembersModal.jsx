import { useState } from "react";
import Modal from "./Modal.jsx";
import { initials, memberColor } from "../utils.js";

export default function MembersModal({ members, onSave, onClose }) {
  const [list, setList] = useState(() => members.map((m) => ({ ...m })));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (i, key, value) => setList((l) => l.map((m, j) => (j === i ? { ...m, [key]: value } : m)));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(list);
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title="Xodimlar" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted small">Ism va lavozimlarni o'zgartiring. Vazifasi bor xodimni o'chirib bo'lmaydi.</p>
        {list.map((m, i) => (
          <div className="member-row" key={m.id ?? `new-${i}`}>
            <span className="avatar" style={{ background: memberColor(i) }}>
              {initials(m.name)}
            </span>
            <input value={m.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Ism familiya" maxLength={60} />
            <input value={m.role} onChange={(e) => update(i, "role", e.target.value)} placeholder="Lavozim (ixtiyoriy)" maxLength={60} />
            <button
              type="button"
              className="icon-btn danger"
              title="Olib tashlash"
              aria-label="Olib tashlash"
              disabled={list.length === 1}
              onClick={() => setList((l) => l.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost" onClick={() => setList((l) => [...l, { name: "", role: "" }])}>
          + Xodim qo'shish
        </button>

        {error && <p className="form-error">{error}</p>}

        <footer className="modal-foot">
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Bekor qilish
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
