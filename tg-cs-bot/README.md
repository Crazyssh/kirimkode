# Bot CS Telegram Business — KirimKode

Auto-reply chat customer di akun Telegram Business kamu. Bot balas FAQ otomatis
atas nama akunmu (bukan chat ke bot langsung).

## Syarat
- Akun Telegram kamu harus **Telegram Premium** (fitur Business hanya untuk Premium).
- Node.js 18+ di server (VPS kirimkode sudah ada).
- Bot Telegram (punya token dari @BotFather).

## Langkah Setup

### 1. Aktifkan Business Mode di bot (BotFather)
- Buka **@BotFather** → `/mybots` → pilih bot kamu → **Bot Settings** → **Business Mode** → **Turn on**.
- Kalau menu "Business Mode" belum muncul, pastikan app Telegram & BotFather versi terbaru.

### 2. Connect bot ke akun bisnismu (di app Telegram kamu)
- **Settings** → **Telegram Business** → **Chatbots** → ketik username bot kamu → pilih.
- Pastikan izin **"can reply"** aktif.

### 3. Jalankan bot di VPS
```bash
cd /var/www/kirimkode/tg-cs-bot
BOT_TOKEN="TOKEN_BOT_KAMU" node bot.mjs
```
Kalau muncul `Bot CS Telegram Business jalan...` berarti sukses.

### 4. Jalankan permanen pakai pm2
```bash
cd /var/www/kirimkode/tg-cs-bot
BOT_TOKEN="TOKEN_BOT_KAMU" pm2 start bot.mjs --name kirimkode-cs-bot
pm2 save
```

Cek log:
```bash
pm2 logs kirimkode-cs-bot
```

## Edit Jawaban FAQ
Semua jawaban ada di `faq.mjs`. Tambah/ubah keyword & balasan sesuka hati,
lalu restart bot:
```bash
pm2 restart kirimkode-cs-bot
```

## Catatan
- Bot hanya membalas pesan **dari customer** (pesan yang kamu kirim sendiri diabaikan).
- Ada cooldown 15 detik per chat biar gak balas beruntun.
- Kalau pesan customer tidak cocok keyword apa pun, bot balas pesan default
  (lihat `DEFAULT_REPLY` di `faq.mjs`).
- Ini beda & terpisah dari bot OTP (@KIRIMKODECS_BOT). Bisa pakai bot yang sama
  atau bot khusus CS — asal bot itu yang di-connect ke Business account.
