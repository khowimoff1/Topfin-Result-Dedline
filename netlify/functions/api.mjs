// Node.js backend — Netlify Function. Ma'lumotlar Netlify Blobs'da saqlanadi
// (alohida baza kerak emas, Netlify o'zi beradi). Asosiy mantiq shared/handler.js da.
import { getStore } from "@netlify/blobs";
import { authConfigFromEnv } from "../../shared/auth.js";
import { handleApi } from "../../shared/handler.js";

// Parollar va GOOGLE_CLIENT_ID: Netlify → Site configuration → Environment variables.
export default async (req) => {
  const store = getStore({ name: "deadline-board", consistency: "strong" });
  const storage = {
    get: (key) => store.get(key, { type: "json" }),
    set: (key, value) => store.setJSON(key, value),
  };
  return handleApi(req, storage, authConfigFromEnv(process.env));
};

export const config = { path: "/api/*" };
