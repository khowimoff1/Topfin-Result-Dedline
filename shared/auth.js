// Kirish (autentifikatsiya) yordamchilari: boshliq paroli, kalit (token),
// Google ID token tekshiruvi. Faqat serverda ishlaydi.
import { createHash, createHmac, createPublicKey, scryptSync, timingSafeEqual, verify } from "node:crypto";

export const TOKEN_DAYS = 30;

const sha = (s) => createHash("sha256").update(String(s)).digest();
export const safeEqual = (a, b) => timingSafeEqual(sha(a), sha(b));

// ---------- Sozlamalar (env) ----------

let cachedKey = null;
let cachedSecret = null;

/**
 * Muhit o'zgaruvchilari:
 *   ADMIN_LOGIN, ADMIN_PASSWORD — boshliq
 *   GOOGLE_CLIENT_ID            — boshqalar Google orqali kiradi
 *   SESSION_SECRET              — kalitlarni imzolash uchun maxfiy matn
 */
export function authConfigFromEnv(env) {
  const admin = { login: (env.ADMIN_LOGIN || "boshliq").trim(), password: env.ADMIN_PASSWORD || "" };
  const key = JSON.stringify([admin, env.SESSION_SECRET || ""]);
  if (key !== cachedKey) {
    // Boshliq paroli o'zgarsa kalit ham o'zgaradi va eski kirishlar bekor bo'ladi.
    cachedSecret = scryptSync(key, "deadline-nazorati", 32);
    cachedKey = key;
  }
  return { admin, secret: cachedSecret, googleClientId: (env.GOOGLE_CLIENT_ID || "").trim() };
}

// ---------- Kalit (token) ----------

export function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readToken(token, secret) {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

// ---------- Google ----------

const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];
let jwksCache = { keys: [], fetchedAt: 0 };

async function googleJwks(force) {
  if (force || Date.now() - jwksCache.fetchedAt > 60 * 60 * 1000) {
    const res = await fetch(GOOGLE_CERTS_URL);
    if (!res.ok) throw new Error("Google kalitlarini olib bo'lmadi");
    jwksCache = { keys: (await res.json()).keys ?? [], fetchedAt: Date.now() };
  }
  return jwksCache.keys;
}

const decodePart = (part) => JSON.parse(Buffer.from(part, "base64url").toString());

/**
 * "Sign in with Google" bergan ID tokenni tekshiradi (imzo, kimga berilgani, muddati).
 * To'g'ri bo'lsa { email, name, picture }, aks holda null qaytaradi.
 */
export async function verifyGoogleIdToken(idToken, clientId, getJwks = googleJwks) {
  const parts = String(idToken ?? "").split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;

  let header, payload;
  try {
    header = decodePart(h);
    payload = decodePart(p);
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;

  let jwk = (await getJwks(false)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await getJwks(true)).find((k) => k.kid === header.kid); // Google kalitlarni almashtirgan bo'lsa
  if (!jwk) return null;

  const { kty, n, e } = jwk;
  const signatureOk = verify(
    "RSA-SHA256",
    Buffer.from(`${h}.${p}`),
    createPublicKey({ key: { kty, n, e }, format: "jwk" }),
    Buffer.from(s, "base64url")
  );
  if (!signatureOk) return null;

  const now = Date.now() / 1000;
  if (!GOOGLE_ISSUERS.includes(payload.iss)) return null;
  if (payload.aud !== clientId) return null;
  if (!(payload.exp > now - 60)) return null;
  if (payload.email_verified !== true && payload.email_verified !== "true") return null;
  if (typeof payload.email !== "string" || !payload.email) return null;

  const email = payload.email.toLowerCase();
  return { email, name: String(payload.name || email).slice(0, 100), picture: String(payload.picture || "") };
}
