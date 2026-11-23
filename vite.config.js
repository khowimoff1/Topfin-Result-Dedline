import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { authConfigFromEnv } from "./shared/auth.js";
import { handleApi } from "./shared/handler.js";

// Kompyuterda (npm start / npm run dev) backend shu yerda ishlaydi:
// ma'lumotlar data/ papkasida saqlanadi (board.json, users.json, log.json).
// Netlify'da esa netlify/functions/api.mjs ishlaydi — kod bir xil (shared/handler.js).
const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, "data");

const fileStorage = {
  async get(key) {
    try {
      return JSON.parse(await readFile(join(DATA_DIR, `${key}.json`), "utf8"));
    } catch (err) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  },
  async set(key, value) {
    await mkdir(DATA_DIR, { recursive: true });
    const file = join(DATA_DIR, `${key}.json`);
    await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2));
    await rename(`${file}.tmp`, file);
  },
};

// Parol va GOOGLE_CLIENT_ID .env faylidan o'qiladi
function localApi(env) {
  const auth = authConfigFromEnv(env);
  let queue = Promise.resolve(); // so'rovlarni navbat bilan bajaramiz (fayl buzilmasligi uchun)

  const middleware = (req, res, next) => {
    if (!req.url.startsWith("/api/")) return next();
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      queue = queue.then(async () => {
        try {
          const hasBody = !["GET", "HEAD"].includes(req.method);
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method,
            headers: {
              "content-type": req.headers["content-type"] ?? "application/json",
              authorization: req.headers.authorization ?? "",
            },
            body: hasBody ? Buffer.concat(chunks) : undefined,
          });
          const response = await handleApi(request, fileStorage, auth);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          console.error(err);
          res.statusCode = 500;
          res.end();
        }
      });
    });
  };

  return {
    name: "local-api",
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), localApi(loadEnv(mode, ROOT, ""))],
  server: { port: 5173, strictPort: true },
}));
