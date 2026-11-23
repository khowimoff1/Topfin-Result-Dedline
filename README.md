# ⏰ Deadline nazorati

Jamoa (4 xodim) uchun vazifalar va deadline'lar shabloni.
**React (Vite)** frontend + **Node.js** backend (Netlify Functions). Ma'lumotlar **Netlify Blobs**'da saqlanadi, alohida baza kerak emas.

## Imkoniyatlar

- **2 ta login:**
  - **Boshliq** (`boshliq`) — vazifa qo'shadi, tahrirlaydi, o'chiradi, xodimlarni boshqaradi
  - **Jamoa** (`jamoa`) — faqat ko'radi (hech narsani o'zgartira olmaydi, bu serverda ham tekshiriladi)
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

- Backend ham ishlaydi, ma'lumotlar `data/board.json` faylida saqlanadi.
- Login va parollar **`.env`** faylida (Bloknot bilan oching). Parolni o'zgartirsangiz, `start.bat`ni qayta ishga tushiring.
- Jamoadoshlar bir xil tarmoqda (Wi-Fi) bo'lsa, oynada chiqadigan **Network** manzilini (masalan `http://192.168.1.5:5173`) ochib ko'rishlari mumkin. Windows "Brandmauer" ruxsat so'rasa, **Частные сети / Private networks** uchun ruxsat bering.
- Kodni o'zgartirsangiz, sahifa o'zi yangilanadi.
- Hammasini boshidan boshlash uchun `data` papkasini o'chiring.
- Netlifyga qo'yganda bu lokal ma'lumot ko'chmaydi, sayt Netlify'da yangidan boshlanadi.

Netlify muhitini aynan o'zini sinash uchun (ixtiyoriy, Netlify CLI kerak):

```bash
npm install -g netlify-cli
npm run netlify      # http://localhost:8888
```

## Netlifyga joylash

### 1-qadam: parollarni sozlash (majburiy!)

`.env` fayli Netlifyga yuklanmaydi, shuning uchun parollarni Netlify'ning o'zida yozish kerak:
**Site configuration → Environment variables → Add a variable**

| Nomi | Qiymati |
|---|---|
| `ADMIN_LOGIN` | boshliq logini (yozmasangiz: `boshliq`) |
| `ADMIN_PASSWORD` | boshliq paroli |
| `VIEWER_LOGIN` | jamoa logini (yozmasangiz: `jamoa`) |
| `VIEWER_PASSWORD` | jamoa paroli |
| `SESSION_SECRET` | uzun tasodifiy matn (30+ belgi) |

Parollarni qo'shgandan yoki o'zgartirgandan keyin **Deploys → Trigger deploy** bosing. Parol o'zgarsa, hamma qaytadan kirishi kerak bo'ladi.
Parollar sozlanmasa, saytga hech kim kira olmaydi.

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
vite.config.js              — kompyuterdagi backend (data/board.json'da saqlaydi)
shared/handler.js           — API va login tekshiruvi (ikkalasi uchun umumiy)
shared/board.js             — vazifalar qoidalari va tekshiruvi
src/App.jsx                 — asosiy sahifa
src/components/             — kartochka, oynalar, ro'yxat
src/utils.js                — sana formatlash, deadline ranglari
src/styles.css              — dizayn
```

## Muhim eslatma

- Kirgandan keyin brauzer 30 kun eslab qoladi. Boshqa kompyuterda bo'lsangiz, ishingiz tugagach **Chiqish** tugmasini bosing.
- Kuchli parol tanlang: kamida 8–10 belgi, harf va raqam aralash.
- `.env` faylini hech kimga yubormang va GitHub'ga yuklamang (`.gitignore`da allaqachon bor).
