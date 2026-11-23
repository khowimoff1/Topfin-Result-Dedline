import { useState } from "react";
import Modal from "./Modal.jsx";
import { toISODate } from "../../shared/board.js";
import { PRIORITY_LABELS, STATUS_LABELS } from "../utils.js";

function emptyTask(members, assigneeId) {
  const inAWeek = new Date();
  inAWeek.setDate(inAWeek.getDate() + 7);
  return {
    title: "",
    description: "",
    assigneeId: assigneeId ?? members[0]?.id ?? "",
    deadline: toISODate(inAWeek),
    priority: "medium",
    status: "todo",
  };
}

export default function TaskModal({ task, members, defaultAssignee, readOnly, onSave, onDelete, onClose }) {
  const isNew = !task?.id;
  const [form, setForm] = useState(() => (isNew ? emptyTask(members, defaultAssignee) : { ...task }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) return setError("Vazifa nomini kiriting");
    setSaving(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={readOnly ? "Vazifa" : isNew ? "Yangi vazifa" : "Vazifani tahrirlash"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <fieldset className="fields" disabled={readOnly}>
        <label>
          Vazifa nomi *
          <input autoFocus value={form.title} onChange={set("title")} placeholder="Masalan: Hisobotni topshirish" maxLength={200} />
        </label>

        <label>
          Izoh
          <textarea rows={3} value={form.description} onChange={set("description")} placeholder="Qo'shimcha ma'lumot (ixtiyoriy)" maxLength={2000} />
        </label>

        <div className="form-row">
          <label>
            Mas'ul xodim *
            <select value={form.assigneeId} onChange={set("assigneeId")}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Deadline *
            <input type="date" value={form.deadline} onChange={set("deadline")} required />
          </label>
        </div>

        <div className="form-row">
          <label>
            Muhimlik
            <select value={form.priority} onChange={set("priority")}>
              {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Holat
            <select value={form.status} onChange={set("status")}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>

        </fieldset>

        {error && <p className="form-error">{error}</p>}

        {readOnly ? (
          <footer className="modal-foot">
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose}>
              Yopish
            </button>
          </footer>
        ) : (
        <footer className="modal-foot">
          {!isNew && (
            <button type="button" className="btn btn-danger-ghost" onClick={() => onDelete(task)}>
              O'chirish
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Bekor qilish
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </footer>
        )}
      </form>
    </Modal>
  );
}
