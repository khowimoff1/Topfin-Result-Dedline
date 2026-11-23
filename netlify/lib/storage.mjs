// Netlify Blobs'dagi ma'lumotlar ombori (api va daily-reminder funksiyalari uchun umumiy).
import { getStore } from "@netlify/blobs";

export function blobStorage() {
  const store = getStore({ name: "deadline-board", consistency: "strong" });
  return {
    get: (key) => store.get(key, { type: "json" }),
    set: (key, value) => store.setJSON(key, value),
  };
}
