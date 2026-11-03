# Otbozor Instagram bot

Har 2 kunda otbozor.uz Instagram sahifasi uchun foydali karusel post tayyorlaydi,
uni Telegram'da (@otbozor_post_bot) tasdiqlashga yuboradi va **faqat tasdiqlangandan keyin**
Instagram'ga joylaydi.

## Qanday ishlaydi

1. Reja `plan.json` faylida turadi: 15 ta post, 5-noyabrdan 3-dekabrgacha, har biri soat 19:00 da.
2. Post kunidan bir kun oldin soat 10:00 da bot internetdan ma'lumot qidirib matn yozadi
   (Gemini yoki Claude), slaydlarni Otbozor dizaynida chizadi va sizga Telegram'da yuboradi.
3. Siz xabar ostidagi tugmalardan birini bosasiz:
   - **Tasdiqlash**: post belgilangan vaqtda (19:00) Instagram'ga chiqadi.
   - **Qayta yozish**: bot yangi variant tayyorlaydi.
   - **Rad etish**: post joylanmaydi.
4. Izoh bilan o'zgartirish uchun post xabariga **reply** qilib yozing, masalan
   "qisqaroq qil, narxlar haqida ham yoz". Bot izohni hisobga olib qayta yozadi.

Telegram buyruqlari: `/holat` (reja holati), `/qayta 03` (3-postni qaytadan tayyorlash).

Hammasi GitHub Actions'da har 30 daqiqada (08:00 dan 23:30 gacha, Toshkent vaqti) ishlaydi.
Holat `data/state.json`, tayyor slaydlar `drafts/` papkasida saqlanadi.

## Sozlash

Hamma kalitlar repo'da **Settings → Secrets and variables → Actions → New repository secret**
orqali qo'shiladi. Ularni hech qachon kodga yoki chatga yozmang.

| Secret | Qayerdan olinadi |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/mybots` → @otbozor_post_bot → API Token |
| `TELEGRAM_ADMIN_ID` | Pastdagi 2-qadam |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (bepul) |
| `ANTHROPIC_API_KEY` | Ixtiyoriy, Gemini o'rniga Claude uchun: [console.anthropic.com](https://console.anthropic.com) |
| `CLOUDINARY_URL` | [cloudinary.com](https://cloudinary.com) (bepul) → Dashboard → API Environment variable |
| `IG_ACCESS_TOKEN` | Pastdagi 4-qadam |
| `GH_PAT` | Ixtiyoriy, Instagram tokenini avtomatik yangilash uchun (5-qadam) |

### 1. Telegram bot
`TELEGRAM_BOT_TOKEN` secretini qo'shing.

### 2. Admin ID
@otbozor_post_bot ga `/start` yozing. Keyin **Actions → tick → Run workflow** ni bosing.
Bot sizga chat ID raqamingizni yuboradi. Uni `TELEGRAM_ADMIN_ID` secretiga qo'ying.
Shundan keyin bot faqat sizning buyruqlaringizni qabul qiladi.

### 3. Matn yozuvchi
`GEMINI_API_KEY` ni qo'shing (bepul). Claude'ga o'tmoqchi bo'lsangiz, `ANTHROPIC_API_KEY` qo'shing va
**Variables** bo'limida `LLM_PROVIDER` = `claude` qiling. Gemini modelini `GEMINI_MODEL` o'zgaruvchisi bilan
almashtirish mumkin (standart: `gemini-2.5-flash`).

### 4. Instagram
Instagram rasmni faqat ochiq URL orqali qabul qiladi, shuning uchun slaydlar Cloudinary'ga yuklanadi
(`CLOUDINARY_URL`).

Token olish:
1. [developers.facebook.com](https://developers.facebook.com/apps) → **Create app** → turini **Business** tanlang.
2. Ilovaga **Instagram** mahsulotini qo'shing → **API setup with Instagram login**.
3. **Generate access tokens** bo'limida otbozor.uz akkauntini qo'shing va kiring.
   Ruxsatlar: `instagram_business_basic`, `instagram_business_content_publish`.
4. Chiqqan tokenni `IG_ACCESS_TOKEN` secretiga qo'ying.

Ilova "Development" rejimida qolishi mumkin, chunki faqat o'z akkauntingizga joylaysiz.

### 5. Tokenni avtomatik yangilash (ixtiyoriy)
Instagram tokeni 60 kunda eskiradi. `refresh-instagram-token` workflow uni har oyning 1 va 15-sanasida
yangilaydi. Buning uchun GitHub'da **Settings → Developer settings → Fine-grained tokens** orqali shu repo
uchun "Secrets: Read and write" ruxsatli token yarating va uni `GH_PAT` secretiga qo'ying.
Aks holda tokenni har 2 oyda qo'lda yangilang.

## Rejani o'zgartirish
`plan.json` faylidagi mavzu, g'oya yoki sanani tahrirlang. Yangi oy uchun yangi postlarni
ro'yxat oxiriga qo'shing (yangi `id` bilan).

## Lokal sinov
```bash
pip install -r requirements.txt
playwright install chromium
pytest -q
```

Shriftlar: Inter (SIL Open Font License), `assets/fonts/LICENSE-Inter.txt`.
