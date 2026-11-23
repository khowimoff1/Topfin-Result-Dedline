// Node.js backend — Netlify Function. Ma'lumotlar Netlify Blobs'da saqlanadi
// (alohida baza kerak emas, Netlify o'zi beradi). Asosiy mantiq shared/handler.js da.
import { authConfigFromEnv } from "../../shared/auth.js";
import { handleApi } from "../../shared/handler.js";
import { blobStorage } from "../lib/storage.mjs";

// Parollar, GOOGLE_CLIENT_ID, TELEGRAM_BOT_TOKEN: Netlify → Site configuration → Environment variables.
export default async (req) => handleApi(req, blobStorage(), authConfigFromEnv(process.env));

export const config = { path: "/api/*" };
