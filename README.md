# ⏰ Deadline nazorati

Jamoa (4 xodim) uchun vazifalar va deadline'lar shabloni.
**React (Vite)** frontend + **Node.js** backend (Netlify Functions). Ma'lumotlar **Netlify Blobs**'da saqlanadi, alohida baza kerak emas.

## Imkoniyatlar

- **Kirish:**
  - **Boshliq** — login + parol (`boshliq`). Vazifa qo'shadi, tahrirlaydi, o'chiradi, xodimlarni boshqaradi
  - **Boshqalar** — **Google akkaunti** orqali. Birinchi marta kirganda boshliqqa **zayavka** boradi,
    boshliq qabul qilgandan keyingina sayt ochiladi. Ular faqat ko'radi (bu serverda ham tekshiriladi)
- **🔐 Foydalanuvchilar** paneli (faqat boshliq uchun):
  - **Zayavkalar** — qabul qilish / rad etish
  - **Foydalanuvchilar** — kimga ruxsat bor, oxirgi faollik, ruxsatni to'xtatish
  - **Kirishlar tarixi** — kim, qachon kirdi, saytni ochdi, zayavka yubordi; noto'g'ri parol bilan urinishlar ham yoziladi
- Har bir xodim uchun alohida ustun, bajarilish foizi
- Deadline'gacha qolgan kun: **qizil** (kechikkan), **to'q sariq** (bugun), **sariq** (1–3 kun), **ko'k** (bir hafta ichida), **yashil**
- Statistika: faol, muddati o'tgan, 3 kun ichida, bajarilgan
- Filtrlar (Faol / Kechikkan / Bajarilgan / Hammasi), qidiruv, "Ro'yxat" ko'rinishi
- Muhimlik (Past / O'rta / Yuqori) va holat (Boshlanmagan / Jarayonda / Bajarildi)
- Xodimlar ismi va lavozimini o'zgartirish, xodim qo'shish
- Har 30 soniyada avtomatik yangilanadi, shuning uchun boshqalarning o'zgarishlari ham ko'rinadi

## Kompyuterda ishga tushirish (Netlifyga qo'yishdan oldin)

**Eng oson yo'li:** papkadagi **`start.bat`** faylini ikki marta bosing.
Birinchi marta kutubxonalar o'zi o'rnatiladi, keyin sayt brauzerda ochiladi (http://localhost:5173).

Yoki terminal orqali:

```bash
npm install
npm start
```

- Backend ham ishlaydi, ma'lumotlar `data/` papkasida saqlanadi (`board.json` — vazifalar, `users.json` — foydalanuvchilar, `log.json` — kirishlar tarixi).
- Boshliq paroli va `GOOGLE_CLIENT_ID` **`.env`** faylida (Bloknot bilan oching). O'zgartirsangiz, `start.bat`ni qayta ishga tushiring.
- Jamoadoshlar bir xil tarmoqda (Wi-Fi) bo'lsa, oynada chiqadigan **Network** manzilini (masalan `http://192.168.1.5:5173`) ochib ko'rishlari mumkin. Windows "Brandmauer" ruxsat so'rasa, **Частные сети / Private networks** uchun ruxsat bering.
- Kodni o'zgartirsangiz, sahifa o'zi yangilanadi.
- Hammasini boshidan boshlash uchun `data` papkasini o'chiring.
- Netlifyga qo'yganda bu lokal ma'lumot ko'chmaydi, sayt Netlify'da yangidan boshlanadi.

Netlify muhitini aynan o'zini sinash uchun (ixtiyoriy, Netlify CLI kerak):

```bash
npm install -g netlify-cli
npm run netlify      # http://localhost:8888
```

## Google orqali kirishni sozlash (bir marta)

Google'dan bepul **Client ID** olish kerak (5 daqiqalik ish):

1. [console.cloud.google.com](https://console.cloud.google.com) ga kiring → tepada **Select a project → New project** → nom bering (masalan `deadline-nazorati`) → **Create**.
2. **APIs & Services → OAuth consent screen** (yoki **Google Auth Platform → Branding**):
   - App name: `Deadline nazorati`, support email: o'z pochtangiz → saqlang.
   - **Audience** bo'limida **External** ni tanlang va **Publish app** tugmasini bosing (aks holda faqat "test users" ro'yxatidagilar kira oladi).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized JavaScript origins** ga quyidagilarni qo'shing:
     - `https://SIZNING-SAYTINGIZ.netlify.app` (Netlify bergan manzil)
     - `http://localhost:5173` va `http://localhost` (kompyuterda sinash uchun)
   - **Redirect URI kerak emas.** → **Create**
4. Chiqqan **Client ID** ni (`....apps.googleusercontent.com`) nusxa oling:
   - Netlify'da: `GOOGLE_CLIENT_ID` o'zgaruvchisiga (pastdagi jadval)
   - Kompyuterda: `.env` faylidagi `GOOGLE_CLIENT_ID=` qatoriga

> Client **Secret** kerak emas — faqat Client ID.

## Netlifyga joylash

### 1-qadam: sozlamalar (majburiy!)

`.env` fayli Netlifyga yuklanmaydi, shuning uchun parollarni Netlify'ning o'zida yozish kerak:
**Site configuration → Environment variables → Add a variable**

| Nomi | Qiymati |
|---|---|
| `ADMIN_LOGIN` | boshliq logini (yozmasangiz: `boshliq`) |
| `ADMIN_PASSWORD` | boshliq paroli |
| `GOOGLE_CLIENT_ID` | Google'dan olingan Client ID (yuqoriga qarang) |
| `SESSION_SECRET` | uzun tasodifiy matn (30+ belgi) |

Qo'shgandan yoki o'zgartirgandan keyin **Deploys → Trigger deploy** bosing. Boshliq paroli o'zgarsa, hamma (Google orqali kirganlar ham) qaytadan kirishi kerak bo'ladi.
Avvalgi `VIEWER_LOGIN` / `VIEWER_PASSWORD` endi ishlatilmaydi — ularni o'chirib tashlashingiz mumkin.

### 2-qadam: joylash

**1-usul: GitHub orqali (tavsiya etiladi)**
1. Papkani GitHub'ga yuklang (GitHub Desktop orqali ham bo'ladi).
2. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → repozitoriyani tanlang.
3. Sozlamalar `netlify.toml`dan avtomatik olinadi (build: `npm run build`, publish: `dist`). **Deploy** tugmasini bosing.

**2-usul: CLI orqali**
```bash
netlify login
netlify init         # yangi sayt yaratadi
netlify deploy --prod
```

> ⚠️ `dist` papkasini qo'lda sudrab tashlash (drag & drop) **ishlamaydi**, chunki backend funksiyasi yuklanmaydi.

## Fayllar tuzilishi

```
start.bat                   — kompyuterda ishga tushirish (ikki marta bosing)
.env                        — kompyuterdagi login/parollar (.env.example — namuna)
netlify/functions/api.mjs   — Netlify'dagi backend (Netlify Blobs'da saqlaydi)
vite.config.js              — kompyuterdagi backend (data/*.json'da saqlaydi)
shared/handler.js           — API: vazifalar, zayavkalar, kirishlar tarixi (ikkalasi uchun umumiy)
shared/auth.js              — boshliq paroli, kirish kaliti, Google tokenini tekshirish
shared/board.js             — vazifalar qoidalari va tekshiruvi
src/App.jsx                 — asosiy sahifa
src/components/             — kartochka, oynalar, ro'yxat, kirish sahifasi, foydalanuvchilar paneli
src/utils.js                — sana formatlash, deadline ranglari
src/styles.css              — dizayn
```

## Muhim eslatma

- Ruxsati to'xtatilgan odam keyingi yangilanishda (30 soniya ichida) saytdan chiqarib yuboriladi.
- "Saytni ochdi" yozuvi har 30 soniyalik yangilanishda emas, 30 daqiqadan ko'p tanaffusdan keyin qayta ochilganda yoziladi. "Oxirgi faollik" esa ~5 daqiqa aniqlikda ko'rinadi.
- Tarixda oxirgi 1000 ta yozuv saqlanadi.
- Kirgandan keyin brauzer 30 kun eslab qoladi. Boshqa kompyuterda bo'lsangiz, ishingiz tugagach **Chiqish** tugmasini bosing.
- Kuchli parol tanlang: kamida 8–10 belgi, harf va raqam aralash.
- `.env` faylini hech kimga yubormang va GitHub'ga yuklamang (`.gitignore`da allaqachon bor).
