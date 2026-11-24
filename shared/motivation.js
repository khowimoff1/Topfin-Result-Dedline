// Ertalabki Telegram eslatmasidagi "kun gapi". Har kuni navbatdagisi tanlanadi
// (hamma bir kunda bir xil gapni oladi). Ro'yxatga bemalol qo'shing yoki o'zgartiring.
export const MOTIVATION = [
  "Har bir katta ish kichik qadamdan boshlanadi. Bugun birinchi qadamni qo'ying.",
  "Ishni ertaga qoldirma — ertaning o'z ishi bor.",
  "Sabr tagi — sariq oltin.",
  "Bugungi kichik g'alaba — ertangi katta natijaning poydevori.",
  "Eng qiyin vazifani birinchi bajaring — qolgan kun yengil o'tadi.",
  "Birlashgan o'zar, birlashmagan to'zar. Jamoa bo'lib ishlaymiz!",
  "Deadline — dushman emas, u maqsadga yetkazuvchi yo'lboshchi.",
  "Ko'p o'ylab, kam gapir — ishing o'zi gapirsin.",
  "Mehnat — baxt kaliti. Bugun ham kalitni burab ko'ramiz.",
  "Rejasiz kun — shamolda qolgan yelkan. Kunni reja bilan boshlang.",
  "Natija tasodif emas — u har kungi intizomning mevasi.",
  "Ilm — bilim bulog'i, mehnat — hayot chirog'i.",
  "Bugun qilgan ishingiz uchun ertaga o'zingizga rahmat aytasiz.",
  "Katta tog' ham tosh-tosh bilan oshiladi. Vazifalarni bo'lib-bo'lib bajaring.",
  "Harakatda — barakat.",
  "Mukammallikni kutmang — boshlang, keyin yaxshilaysiz.",
  "Siz o'ylagandan kuchliroqsiz. Bugun buni yana bir bor isbotlaymiz.",
  "Vaqt — eng qimmat boylik. Uni muhim ishlarga sarflang.",
  "Ertalabki birinchi soat butun kunning ohangini belgilaydi.",
  "Daryo tomchidan, kuch esa har kungi mehnatdan yig'iladi.",
  "Qilgan ishing — o'zingga, qilmagan ishing — ham o'zingga.",
  "Yaxshi boshlangan ish — yarim bitgan ish.",
  "Charchoq o'tadi, natija qoladi.",
  "Bir-birimizga yordam bersak, har qanday deadline yengiladi.",
  "Kecha qanday bo'lgani muhim emas — bugun yangi imkoniyat.",
  "Ishning ko'zini bilgan — ko'p ishni oz vaqtda qiladi.",
  "Har bir yakunlangan vazifa — jamoaga qo'shilgan ishonch.",
  "Diqqatni bitta ishga qarating — ko'p ish bir vaqtda yarim bo'ladi.",
  "Oltin o'tda bilinadi, odam — mehnatda.",
  "Bugun qo'yilgan maqsad — ertangi yutuqning manzili.",
  "Kichik yutuqlarni ham nishonlang — ular katta yo'lning bekatlari.",
  "Mashaqqatsiz rohat yo'q.",
  "Qat'iyat bor joyda yo'l albatta topiladi.",
  "Ishonchli jamoa — har qanday qiyinchilikdan kuchli.",
  "Bugun bir qadam oldinga — oy oxirida yuz qadam oldinda bo'lasiz.",
  "So'z bilan emas, ish bilan ko'rsat.",
  "Vazifa qanchalik qiyin bo'lsa, uni yengish shunchalik shirin.",
  "Tartib — tezlikning onasi. Avval rejalashtiring, keyin bajaring.",
  "Bugun kimgadir yordam bering — ertaga u sizga yelka tutadi.",
  "Muvaffaqiyat — har kuni takrorlangan kichik harakatlar yig'indisi.",
  "Ko'z qo'rqoq, qo'l botir. Boshlasangiz — bitadi!",
  "Yaxshi kayfiyat — yarim ish. Kuningiz xayrli o'tsin!",
];

/** Bugungi gap: yil kuniga qarab navbat bilan (YYYY-MM-DD). */
export function motivationOfDay(todayIso) {
  const [y, m, d] = todayIso.split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return MOTIVATION[dayNumber % MOTIVATION.length];
}
