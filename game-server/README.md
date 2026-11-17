# Otbozor Poyga: reyting servisi

Bu kichik servis o'yindagi haftalik reyting, oylik turnir va ko'pkari reytingini saqlaydi. Otbozor'ning asosiy backendiga tegmaydi va o'sha DigitalOcean serverida alohida ishlaydi.

- Hech qanday kutubxona kerak emas, faqat Node.js 18 yoki undan yangisi.
- Natijalar `data.json` fayliga yoziladi.
- Har bir natija Telegram imzosi bilan tekshiriladi (`initData`), shuning uchun natijani soxtalashtirib bo'lmaydi.

## O'rnatish (taxminan 10 daqiqa)

### 1. Kodni serverga ko'chiring

```bash
ssh root@SERVER_IP
mkdir -p /opt/otbozor-game && cd /opt/otbozor-game
curl -O https://raw.githubusercontent.com/doniyorjon-k/instagram-bot/main/game-server/server.js
node -v   # 18 yoki undan yuqori bo'lishi kerak
```

### 2. @otbozor_game tokenini oling

@BotFather → /mybots → @otbozor_game → API Token. Tokenni hech kimga yubormang, faqat serverdagi sozlamaga yozing.

### 3. Servisni ishga tushiring (systemd)

`/etc/systemd/system/otbozor-game.service` faylini yarating:

```ini
[Unit]
Description=Otbozor Poyga leaderboard
After=network.target

[Service]
WorkingDirectory=/opt/otbozor-game
Environment=BOT_TOKEN=BU_YERGA_TOKEN
Environment=PORT=8787
Environment=ALLOWED_ORIGINS=https://doniyorjon-k.github.io
ExecStart=/usr/bin/node server.js
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
chown -R www-data /opt/otbozor-game
systemctl daemon-reload && systemctl enable --now otbozor-game
curl http://127.0.0.1:8787/health   # {"ok":true} chiqishi kerak
```

(pm2 ishlatsangiz: `BOT_TOKEN=... pm2 start server.js --name otbozor-game && pm2 save`.)

### 4. Nginx orqali tashqariga oching

Mavjud domeningizning `server { ... }` blokiga (masalan `api.otbozor.uz`) qo'shing:

```nginx
location /game-api/ {
    proxy_pass http://127.0.0.1:8787/game-api/;
    proxy_set_header Host $host;
}
```

```bash
nginx -t && systemctl reload nginx
curl https://api.otbozor.uz/game-api/health
```

### 5. O'yinga manzilni yozing

`docs/config.js` faylida:

```js
window.OTBOZOR_GAME_API = 'https://api.otbozor.uz/game-api';
window.OTBOZOR_PRIZE = "Otbozor'dan maxsus sovg'a";   // oylik turnir sovrini
```

Shu bilan reyting ishlay boshlaydi.

## Turnir g'olibini ko'rish

```bash
curl "https://api.otbozor.uz/game-api/top?kind=race&period=month"
```

Ro'yxat har oyning 1-sanasida (Toshkent vaqti) avtomatik yangilanadi. Eski oylar `data.json` ichida saqlanib qoladi.

## Tekshirish

```bash
node test.js   # "all tests passed"
```
