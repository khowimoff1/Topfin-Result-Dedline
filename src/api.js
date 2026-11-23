// Backend bilan aloqa. Kirgandan keyin olingan kalit (token) brauzerda
// saqlanadi va har bir so'rovga qo'shib yuboriladi.

const SESSION_KEY = "deadline-session";

let session = null;
try {
  session = JSON.parse(localStorage.getItem(SESSION_KEY));
} catch {
  session = null;
}

let onUnauthorized = () => {};

export const getSession = () => session;
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

export function logout() {
  session = null;
  localStorage.removeItem(SESSION_KEY);
}

async function request(path, options = {}) {
  const headers = { "content-type": "application/json" };
  if (session?.token) headers.authorization = `Bearer ${session.token}`;

  const res = await fetch(`/api/${path}`, { ...options, headers, cache: "no-store" });
  let data = null;
  if (res.headers.get("content-type")?.includes("application/json")) {
    data = await res.json().catch(() => null);
  }
  if (!data) throw new Error("Server javob bermadi. Saytni start.bat orqali yoki Netlify'da oching.");

  if (res.status === 401 && path !== "login") {
    logout();
    onUnauthorized();
  }
  if (!res.ok) throw new Error(data.error || "Xatolik yuz berdi");
  return data;
}

export async function login(loginName, password) {
  const data = await request("login", {
    method: "POST",
    body: JSON.stringify({ login: loginName, password }),
  });
  session = { role: data.role, token: data.token };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export const fetchBoard = () => request("board");

export const createTask = (task) => request("tasks", { method: "POST", body: JSON.stringify(task) });

export const updateTask = (id, task) =>
  request(`tasks/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(task) });

export const deleteTask = (id) => request(`tasks/${encodeURIComponent(id)}`, { method: "DELETE" });

export const saveMembers = (members) => request("members", { method: "PUT", body: JSON.stringify({ members }) });
