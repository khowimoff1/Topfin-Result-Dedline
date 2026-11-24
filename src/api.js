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

function saveSession(data) {
  session = { role: data.role, token: data.token, name: data.name, email: data.email ?? "", picture: data.picture ?? "" };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logout() {
  session = null;
  localStorage.removeItem(SESSION_KEY);
}

const PUBLIC_PATHS = ["login", "google", "config"];

async function request(path, options = {}) {
  const headers = { "content-type": "application/json" };
  if (session?.token) headers.authorization = `Bearer ${session.token}`;

  const res = await fetch(`/api/${path}`, { ...options, headers, cache: "no-store" });
  let data = null;
  if (res.headers.get("content-type")?.includes("application/json")) {
    data = await res.json().catch(() => null);
  }
  if (!data) throw new Error("Server javob bermadi. Saytni start.bat orqali yoki Netlify'da oching.");

  if (res.status === 401 && !PUBLIC_PATHS.includes(path)) {
    logout();
    onUnauthorized(data.error);
  }
  if (!res.ok) throw new Error(data.error || "Xatolik yuz berdi");
  return data;
}

const post = (path, body, method = "POST") => request(path, { method, body: JSON.stringify(body) });
const enc = encodeURIComponent;

// ---------- Kirish ----------

export const getConfig = () => request("config");

/** Admin: login + parol */
export async function login(loginName, password) {
  return saveSession(await post("login", { login: loginName, password }));
}

/** Boshqalar: Google. Javob: { status: "approved" | "pending" | "rejected" | "blocked" } */
export async function googleLogin(credential) {
  const data = await post("google", { credential });
  if (data.status === "approved") saveSession(data);
  return data;
}

// ---------- Vazifalar ----------

export const fetchBoard = () => request("board");
export const createTask = (task) => post("tasks", task);
export const updateTask = (id, task) => post(`tasks/${enc(id)}`, task, "PUT");
export const deleteTask = (id) => request(`tasks/${enc(id)}`, { method: "DELETE" });
export const saveMembers = (members) => post("members", { members }, "PUT");

// ---------- Foydalanuvchilar va tarix (faqat admin) ----------

export const fetchAccess = () => request("users");
export const setUserStatus = (email, status) => post(`users/${enc(email)}`, { status }, "PUT");
export const removeUser = (email) => request(`users/${enc(email)}`, { method: "DELETE" });

// ---------- Telegram bot (faqat admin) ----------

export const fetchTelegram = () => request("telegram");
export const setupTelegram = () => post("telegram/setup", {});
export const unlinkTelegram = (target) => post("telegram/unlink", target);
export const sendReminderNow = () => post("telegram/remind", {});
export const sendMonthlyReport = (month) => post("telegram/report", { month });
