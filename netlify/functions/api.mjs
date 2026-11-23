// Node.js backend — Netlify Function. Ma'lumotlar Netlify Blobs'da saqlanadi
// (alohida baza kerak emas, Netlify o'zi beradi). Asosiy mantiq shared/handler.js da.
import { getStore } from "@netlify/blobs";
import { authConfigFromEnv, handleApi } from "../../shared/handler.js";

const KEY = "board";

// Parollar Netlify → Site configuration → Environment variables bo'limida beriladi.
export default async (req) => {
  const store = getStore({ name: "deadline-board", consistency: "strong" });
  const storage = {
    get: () => store.get(KEY, { type: "json" }),
    set: (board) => store.setJSON(KEY, board),
  };
  return handleApi(req, storage, authConfigFromEnv(process.env));
};

export const config = { path: "/api/*" };
