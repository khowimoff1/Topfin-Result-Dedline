import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "./api.js";
import TaskCard from "./components/TaskCard.jsx";
import TaskModal from "./components/TaskModal.jsx";
import MembersModal from "./components/MembersModal.jsx";
import ListView from "./components/ListView.jsx";
import LoginPage from "./components/LoginPage.jsx";
import UsersModal from "./components/UsersModal.jsx";
import { LOGO_URL, daysLeft, formatDate, initials, memberColor, sortTasks } from "./utils.js";
import { toISODate } from "../shared/board.js";

const REFRESH_MS = 30_000; // boshqa xodimlarning o'zgarishlarini 30 soniyada bir yangilash

const FILTERS = [
  ["active", "Faol"],
  ["overdue", "Kechikkan"],
  ["done", "Bajarilgan"],
  ["all", "Hammasi"],
];

export default function App() {
  const [session, setSession] = useState(api.getSession);
  const [board, setBoard] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [view, setView] = useState(() => localStorage.getItem("view") || "board");
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // {task?, assigneeId?}
  const [membersOpen, setMembersOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [access, setAccess] = useState({ users: [], log: [] }); // faqat boshliq uchun
  const [logoutNotice, setLogoutNotice] = useState("");

  const isAdmin = session?.role === "admin";

  const refresh = useCallback(async () => {
    try {
      const [nextBoard, nextAccess] = await Promise.all([api.fetchBoard(), isAdmin ? api.fetchAccess() : null]);
      setBoard(nextBoard);
      if (nextAccess) setAccess(nextAccess);
      setLoadError("");
    } catch (err) {
      setLoadError(err.message);
    }
  }, [isAdmin]);

  const logout = useCallback((reason = "") => {
    api.logout();
    setSession(null);
    setBoard(null);
    setEditing(null);
    setMembersOpen(false);
    setUsersOpen(false);
    setAccess({ users: [], log: [] });
    setLogoutNotice(reason);
  }, []);

  // Kalit eskirsa yoki parol o'zgarsa — kirish sahifasiga qaytamiz
  useEffect(() => api.setUnauthorizedHandler(logout), [logout]);

  useEffect(() => {
    if (!session) return;
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [session, refresh]);

  useEffect(() => localStorage.setItem("view", view), [view]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const run = async (action, message) => {
    const next = await action();
    setBoard(next);
    if (message) setToast(message);
    return next;
  };

  const saveTask = (form) =>
    form.id ? run(() => api.updateTask(form.id, form), "Saqlandi") : run(() => api.createTask(form), "Vazifa qo'shildi");

  const toggleDone = (task) =>
    run(() => api.updateTask(task.id, { status: task.status === "done" ? "doing" : "done" })).catch((err) =>
      setToast(err.message)
    );

  const removeTask = async (task) => {
    if (!window.confirm(`"${task.title}" vazifasini o'chirasizmi?`)) return;
    try {
      await run(() => api.deleteTask(task.id), "O'chirildi");
      setEditing(null);
    } catch (err) {
      setToast(err.message);
    }
  };

  const stats = useMemo(() => {
    const tasks = board?.tasks ?? [];
    const open = tasks.filter((t) => t.status !== "done");
    return {
      total: tasks.length,
      active: open.length,
      overdue: open.filter((t) => daysLeft(t.deadline) < 0).length,
      soon: open.filter((t) => {
        const d = daysLeft(t.deadline);
        return d >= 0 && d <= 3;
      }).length,
      done: tasks.length - open.length,
    };
  }, [board]);

  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortTasks(
      (board?.tasks ?? []).filter((t) => {
        if (filter === "active" && t.status === "done") return false;
        if (filter === "done" && t.status !== "done") return false;
        if (filter === "overdue" && (t.status === "done" || daysLeft(t.deadline) >= 0)) return false;
        if (q && !`${t.title} ${t.description}`.toLowerCase().includes(q)) return false;
        return true;
      })
    );
  }, [board, filter, search]);

  if (!session) return <LoginPage onLogin={setSession} notice={logoutNotice} />;

  const canEdit = isAdmin;
  const pendingCount = access.users.filter((u) => u.status === "pending").length;

  if (!board) {
    return (
      <div className="center-screen">
        {loadError ? (
          <div className="card-msg">
            <p>Ma'lumotni yuklab bo'lmadi: {loadError}</p>
            <button className="btn btn-primary" onClick={refresh}>
              Qayta urinish
            </button>
          </div>
        ) : (
          <p className="muted">Yuklanmoqda…</p>
        )}
      </div>
    );
  }

  const today = toISODate(new Date());

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={LOGO_URL} alt="Topfin Result" width="99" height="48" />
          <div>
            <h1>Deadline nazorati</h1>
            <p className="muted">Bugun: {formatDate(today)}</p>
          </div>
        </div>
        <div className="top-actions">
          {canEdit ? (
            <span className="role-badge role-admin">👑 Admin</span>
          ) : (
            <span className="user-chip" title={session.email}>
              {session.picture ? (
                <img className="avatar sm user-photo" src={session.picture} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="avatar sm" style={{ background: "#64748b" }}>{initials(session.name)}</span>
              )}
              <span>
                <b>{session.name}</b>
                <small className="muted">Faqat ko'rish</small>
              </span>
            </span>
          )}
          {canEdit && (
            <>
              <button className="btn" onClick={() => setUsersOpen(true)}>
                🔐 Foydalanuvchilar
                {pendingCount > 0 && <span className="count-badge">{pendingCount}</span>}
              </button>
              <button className="btn" onClick={() => setMembersOpen(true)}>
                👥 Xodimlar
              </button>
              <button className="btn btn-primary" onClick={() => setEditing({})}>
                + Yangi vazifa
              </button>
            </>
          )}
          <button className="btn" onClick={() => logout()}>
            Chiqish
          </button>
        </div>
      </header>

      {loadError && <div className="notice notice-error">Yangilashda xatolik: {loadError}</div>}

      <section className="stats">
        <Stat label="Faol vazifalar" value={stats.active} />
        <Stat label="Muddati o'tgan" value={stats.overdue} tone="overdue" onClick={() => setFilter("overdue")} />
        <Stat label="3 kun ichida" value={stats.soon} tone="soon" />
        <Stat label="Bajarilgan" value={stats.done} tone="done" onClick={() => setFilter("done")} />
      </section>

      <section className="toolbar">
        <div className="segmented">
          {FILTERS.map(([v, l]) => (
            <button key={v} className={filter === v ? "active" : ""} onClick={() => setFilter(v)}>
              {l}
            </button>
          ))}
        </div>
        <input className="search" type="search" placeholder="Qidirish…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="segmented">
          <button className={view === "board" ? "active" : ""} onClick={() => setView("board")}>
            Xodimlar bo'yicha
          </button>
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
            Ro'yxat
          </button>
        </div>
      </section>

      {view === "board" ? (
        <section className="columns">
          {board.members.map((m, i) => {
            const mine = visibleTasks.filter((t) => t.assigneeId === m.id);
            const all = board.tasks.filter((t) => t.assigneeId === m.id);
            const open = all.filter((t) => t.status !== "done");
            const overdue = open.filter((t) => daysLeft(t.deadline) < 0).length;
            const progress = all.length ? Math.round(((all.length - open.length) / all.length) * 100) : 0;
            return (
              <div className="column" key={m.id}>
                <header className="column-head">
                  <span className="avatar" style={{ background: memberColor(i) }}>
                    {initials(m.name)}
                  </span>
                  <div className="column-title">
                    <h2>{m.name}</h2>
                    <p className="muted small">
                      {m.role ? `${m.role} · ` : ""}
                      {open.length} ta faol
                      {overdue > 0 && <span className="text-overdue"> · {overdue} ta kechikkan</span>}
                    </p>
                  </div>
                  {canEdit && (
                    <button className="icon-btn" title={`${m.name}ga vazifa qo'shish`} onClick={() => setEditing({ assigneeId: m.id })}>
                      +
                    </button>
                  )}
                </header>
                <div className="progress" title={`${progress}% bajarilgan`}>
                  <span style={{ width: `${progress}%`, background: memberColor(i) }} />
                </div>
                <div className="column-body">
                  {mine.length === 0 ? (
                    <p className="empty">Vazifa yo'q</p>
                  ) : (
                    mine.map((t) => (
                      <TaskCard key={t.id} task={t} canEdit={canEdit} onEdit={(task) => setEditing({ task })} onToggleDone={toggleDone} onDelete={removeTask} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <ListView tasks={visibleTasks} members={board.members} canEdit={canEdit} onEdit={(task) => setEditing({ task })} onToggleDone={toggleDone} />
      )}

      {editing && (
        <TaskModal
          task={editing.task}
          defaultAssignee={editing.assigneeId}
          members={board.members}
          readOnly={!canEdit}
          onSave={saveTask}
          onDelete={removeTask}
          onClose={() => setEditing(null)}
        />
      )}
      {usersOpen && canEdit && (
        <UsersModal
          access={access}
          onStatus={async (email, status) => setAccess(await api.setUserStatus(email, status))}
          onRemove={async (email) => setAccess(await api.removeUser(email))}
          onClose={() => setUsersOpen(false)}
        />
      )}
      {membersOpen && canEdit && (
        <MembersModal members={board.members} onSave={(list) => run(() => api.saveMembers(list), "Xodimlar saqlandi")} onClose={() => setMembersOpen(false)} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Stat({ label, value, tone = "", onClick }) {
  return (
    <button className={`stat stat-${tone}`} onClick={onClick} disabled={!onClick}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </button>
  );
}
