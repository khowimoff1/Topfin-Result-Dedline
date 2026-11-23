import { PRIORITY_LABELS, STATUS_LABELS, deadlineInfo, formatDate, initials, memberColor } from "../utils.js";

export default function ListView({ tasks, members, canEdit, onEdit, onToggleDone }) {
  const memberIndex = new Map(members.map((m, i) => [m.id, i]));

  if (tasks.length === 0) return <p className="empty big">Bu filtr bo'yicha vazifa yo'q.</p>;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th aria-label="Bajarildi" />
            <th>Vazifa</th>
            <th>Mas'ul</th>
            <th>Deadline</th>
            <th>Qoldi</th>
            <th>Muhimlik</th>
            <th>Holat</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const info = deadlineInfo(t);
            const idx = memberIndex.get(t.assigneeId) ?? 0;
            const member = members[idx];
            return (
              <tr key={t.id} className={`level-${info.level}`} onClick={() => onEdit(t)}>
                <td>
                  <button
                    className={`check ${t.status === "done" ? "checked" : ""}`}
                    disabled={!canEdit}
                    aria-label="Bajarildi deb belgilash"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleDone(t);
                    }}
                  >
                    {t.status === "done" ? "✓" : ""}
                  </button>
                </td>
                <td className={t.status === "done" ? "struck" : ""}>{t.title}</td>
                <td>
                  <span className="who">
                    <span className="avatar sm" style={{ background: memberColor(idx) }}>
                      {initials(member?.name)}
                    </span>
                    {member?.name}
                  </span>
                </td>
                <td className="nowrap">{formatDate(t.deadline)}</td>
                <td>
                  <span className={`badge badge-${info.level}`}>{info.label}</span>
                </td>
                <td>
                  <span className={`prio prio-${t.priority}`}>{PRIORITY_LABELS[t.priority]}</span>
                </td>
                <td>{STATUS_LABELS[t.status]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
