// Har kuni ertalab soat 9:00 da (Toshkent vaqti) Telegram orqali eslatma yuboradi:
//  - har bir xodimga: kechikkan, bugungi va ertangi vazifalari
//  - admin'ga: jamoaning umumiy holati
// Netlify Scheduled Function. Vaqt UTC'da: 04:00 UTC = 09:00 Toshkent.
import { authConfigFromEnv } from "../../shared/auth.js";
import { makeTelegram, sendDailyReminders } from "../../shared/telegram.js";
import { blobStorage } from "../lib/storage.mjs";

export default async () => {
  const tg = makeTelegram(authConfigFromEnv(process.env));
  if (!tg) return; // bot ulanmagan
  const { sent } = await sendDailyReminders(tg, blobStorage());
  console.log(`Ertalabki eslatma: ${sent} ta xabar yuborildi`);
};

export const config = { schedule: "0 4 * * *" };
