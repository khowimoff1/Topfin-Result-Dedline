import { PRIORITY_LABELS, STATUS_LABELS, deadlineInfo, formatDate } from "../utils.js";

export default function TaskCard({ task, canEdit, onEdit, onToggleDone, onDelete }) {
  const info = deadlineInfo(task);
  const done = task.status === "done";

  return (
    <article className={`task-card level-${info.level}`} onClick={() => onEdit(task)}>
      <div className="task-top">
        <button
          className={`check ${done ? "checked" : ""}`}
          disabled={!canEdit}
          title={done ? "Bajarilmagan deb belgilash" : "Bajarildi deb belgilash"}
          aria-label={done ? "Bajarilmagan deb belgilash" : "Bajarildi deb belgilash"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone(task);
          }}
        >
          {done ? "✓" : ""}
        </button>
        <h3 className={done ? "struck" : ""}>{task.title}</h3>
        {canEdit && (
        <button
          className="icon-btn danger"
          title="O'chirish"
          aria-label="O'chirish"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task);
          }}
        >
          ✕
        </button>
        )}
      </div>

      {task.description && <p className="task-desc">{task.description}</p>}

      <div className="task-meta">
        <span className={`badge badge-${info.level}`}>{info.label}</span>
        <span className="muted">📅 {formatDate(task.deadline)}</span>
      </div>
      <div className="task-meta">
        <span className={`prio prio-${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
        {!done && <span className={`status status-${task.status}`}>{STATUS_LABELS[task.status]}</span>}
      </div>
    </article>
  );
}
