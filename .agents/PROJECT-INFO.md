# KirimKode - Info Penting Proyek

> Dokumen referensi cepat. Buka file ini kalau lupa info dasar.
> Update file ini setiap ada perubahan struktural (server baru, migrasi VPS, dll).

---

## 🌐 Domain & Hosting

- **Domain**: https://kirimkode.com (di belakang Cloudflare proxy)
- **GitHub repo**: https://github.com/Crazyssh/kirimkode
- **Branch utama**: `main`

---

## 🖥️ VPS

- **Host**: Jagoan UniverseUltra
- **IP**: `103.27.207.116`
- **OS**: Ubuntu 24.04
- **Spec**: 6 vCPU, 6GB RAM, swap 4GB

### Lokasi file penting di VPS

| Path | Keterangan |
|------|------------|
| `/var/www/kirimkode` | Folder kode (git clone dari repo) |
| `/var/www/kirimkode/.env` | Environment variables (DATABASE_URL, API keys, dll) |
| `/root/db-credentials.txt` | Backup credentials Postgres (password DB) |
| `/etc/nginx/sites-available/kirimkode` | Config Nginx |
| `/etc/nginx/ssl/` | SSL Cloudflare Origin Certificate |
| `~/.pm2/` | Config PM2 + log file |

### SSH

```bash
ssh root@103.27.207.116
```

---

## 🗄️ Database

- **Engine**: PostgreSQL 17 (lokal di VPS, bukan Neon lagi)
- **DB name**: `kirimkode`
- **DB user**: `kirimkode_app`
- **Port**: `5432` (bind localhost only)
- **Connection string**: ada di `/var/www/kirimkode/.env` → `DATABASE_URL`
- **Password**: simpan di `/root/db-credentials.txt`
- **Migration history**: `prisma/migrations/`

### Tuning Postgres (sudah applied)

- `shared_buffers = 512MB`
- `max_connections = 50`

### Akses DB manual

```bash
sudo -u postgres psql -d kirimkode
```

### Backup DB

**Otomatis (harian jam 00:00 WIB → Cloudflare R2):**

Setup sudah jalan via cron. Script di `/var/www/kirimkode/scripts/backup-db.sh`.

Cek backup terbaru di R2:
```bash
rclone ls r2:kirimkode-backups
```

Cek log backup:
```bash
tail -50 /var/log/kirimkode-backup.log
```

**Manual on-demand:**

```bash
sudo /var/www/kirimkode/scripts/backup-db.sh
```

**Storage di R2** (skema replace + previous):
- `kirimkode-latest.sql.gz` — backup terbaru (overwrite tiap run)
- `kirimkode-previous.sql.gz` — backup hari kemarin (safety fallback)

R2 bucket: `kirimkode-backups` (Asia-Pacific, akun Cloudflare)
Endpoint: `https://2f58ef440bb814044b007fd56187ef1f.r2.cloudflarestorage.com`
Config rclone di VPS: `~/.config/rclone/rclone.conf`

**Backup quick-and-dirty (lokal, tanpa upload):**

```bash
sudo -u postgres pg_dump kirimkode > /root/kirimkode-backup-$(date +%Y%m%d-%H%M).sql
```

### Restore DB

**Dari R2:**

```bash
sudo /var/www/kirimkode/scripts/restore-db.sh latest      # backup terbaru
sudo /var/www/kirimkode/scripts/restore-db.sh previous    # hari kemarin
```

Script akan minta konfirmasi (`YES RESTORE`), bikin safety snapshot DB sekarang dulu, stop PM2, drop+create+restore, lalu start PM2.

**Dari file lokal:**

```bash
sudo -u postgres psql -d kirimkode < /root/kirimkode-backup-XXX.sql
```

---

## 🚀 Stack Teknologi

- **Framework**: Next.js 16.1.6 (App Router, Turbopack)
- **Runtime**: Node.js 20
- **ORM**: Prisma 7.4
- **Auth**: NextAuth v5 (JWT session)
- **Styling**: Tailwind v4
- **Process manager**: PM2 (cluster mode 4 instance, max_memory_restart 500M)
- **Web server**: Nginx (reverse proxy + SSL)

---

## 🛰️ Provider OTP (Server)

| Server ID | Nama Display | Provider | Endpoint | Treatment Harga |
|-----------|-------------|----------|----------|-----------------|
| `api1` | Mars | JasaOTP V1 | api.jasaotp.id/v1 | Apply pricing rule |
| `api2` | Jupiter | JasaOTP V2 | api.jasaotp.id/v2 | Apply pricing rule |
| `api3` | Saturn | HeroSMS V1 | - | **Final price** (skip pricing rule) |
| `api4` | Neptune | HeroSMS V2 | /api/v1/activations/offers | **Live /offers** (banding 0.01 USD) + markup 1.35 (final price) |
| `api5` | Earth (Beta) | Clowatch | api.clowatch.com/api/v1 | Apply pricing rule |
| `api6` | Venus (Beta) | 5sim.net | api.5sim.net | **Final price** (USD→IDR + markup 1.15) |
| `api7` | Mars V2 | Happy Pixel | - | Apply pricing rule (share rule dengan Mars/api1) |
| `api8` | Mercury | Clowatch v2 | api.clowatch.com/api/v2 | Apply pricing rule + flat markup +Rp 115 |
| `api9` | Uranus | Clowatch v3 | api.clowatch.com/api/v3 | **Final price** (skip pricing rule) |
| `api10` | Eris | Clowatch v4 | api.clowatch.com/api/v4 | **Final price** (skip pricing rule) |
| `unified` | Bimasakti | Aggregator | (gabungan api1+api2+api3+api5+api8) | Per-provider pricing |

### Cancel rule per server

| Server | Cancel min |
|--------|-----------|
| api7 (Mars V2) | 2 menit 30 detik |
| Clowatch (api5 Earth, api8 Mercury, api9 Uranus, api10 Eris) | 3 menit |
| Lainnya | 3 menit (default) |

### Timeout nomor (umur max order)

| Server | Timeout |
|--------|---------|
| api8 (Mercury) | 4 menit 30 detik |
| Lainnya | 20 menit (default) |

Helper centralized di `src/lib/pricing.ts`:
- `getCancelMinMs(serverId)` — kapan tombol cancel aktif
- `getOrderTimeoutMs(serverId)` — auto-refund + cancel
- `applyServerExtraMarkup(price, serverId)` — flat markup tambahan
- `applyPricing(...)` — pricing rule admin

---

## 🔐 Environment Variables (.env)

Lokasi: `/var/www/kirimkode/.env`

### Wajib

```bash
DATABASE_URL="postgresql://kirimkode_app:PASSWORD@127.0.0.1:5432/kirimkode?schema=public"
AUTH_SECRET="..."  # NextAuth JWT secret
AUTH_GOOGLE_ID="..."
AUTH_GOOGLE_SECRET="..."

# Cron auth
CRON_SECRET="ee0w0PXs5vsqE01pOmi687ZyWzPBcWnU"

# JasaOTP (api1, api2)
JASAOTP_API_KEY="..."
JASAOTP_API1_URL="https://api.jasaotp.id/v1"
JASAOTP_API2_URL="https://api.jasaotp.id/v2"

# HeroSMS (api3, api4)
HEROSMS_API_KEY="..."

# Clowatch (api5 Earth, api8 Mercury, api9 Uranus, api10 Eris)
PROVIDER5_API_KEY="..."
PROVIDER5_API_URL="https://api.clowatch.com/api/v1"
PROVIDER8_API_KEY="..."  # boleh fallback ke PROVIDER5_API_KEY
PROVIDER8_API_URL="https://api.clowatch.com/api/v2"
PROVIDER9_API_KEY="..."  # boleh fallback ke PROVIDER5_API_KEY
PROVIDER9_API_URL="https://api.clowatch.com/api/v3"
PROVIDER10_API_KEY="..." # boleh fallback ke PROVIDER5_API_KEY
PROVIDER10_API_URL="https://api.clowatch.com/api/v4"

# 5sim (api6 Venus)
PROVIDER6_API_KEY="..."

# Mars V2 (api7)
PROVIDER7_API_KEY="..."

# Payment gateways
PAYMENKU_API_KEY="..."
PAYMENKU_SECRET_KEY="..."
BAYARGG_API_KEY="..."
BAYARGG_SECRET_KEY="..."

# Telegram bot
TELEGRAM_BOT_TOKEN="..."
```

---

## ⏰ Cron Jobs

Trigger via crontab di VPS:

| Frequency | Endpoint | Tujuan |
|-----------|----------|--------|
| 1 menit | `/api/cron/orders` | Polling OTP + auto-cancel timeout + refund |
| 2 menit | `/api/cron/deposits` | Polling status pembayaran |
| 1 jam | `/api/cron/sync` | Sync negara/layanan dari semua provider |
| 3 menit | `/api/cron/health` | Cek health server provider |
| 30 detik | `/api/cron/clowatch-health` | Auto health check Clowatch (api5/api8/api9/api10) — test order WA→TG, hide otomatis kalau unhealthy |

Auth: `Authorization: Bearer $CRON_SECRET`

Trigger sync manual untuk satu server:
```bash
curl -s "https://kirimkode.com/api/cron/sync?key=$CRON_SECRET&server=api9"
```

Trigger cron orders manual:
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://kirimkode.com/api/cron/orders
```

---

## 🛠️ Workflow Deploy

Setiap selesai code change (sesuai `.agents/workflows/after-code-change.md`):

```bash
# Di komputer dev
git add -A
git commit -m "deskripsi perubahan dalam Bahasa Indonesia"
git push
```

Lalu di VPS:

```bash
cd /var/www/kirimkode && git pull && npm run build && pm2 restart kirimkode
```

### Kalau ada migration baru

```bash
cd /var/www/kirimkode && git pull && npx prisma generate && npx prisma migrate deploy && npm run build && pm2 restart kirimkode
```

`prisma generate` sudah otomatis jalan di `npm run build` (lihat `package.json` script).

---

## 🔍 Troubleshooting

### Cek log PM2

```bash
pm2 logs kirimkode --lines 100
pm2 logs kirimkode --lines 100 --nostream | grep -iE "error|fail"
```

### Cek log spesifik (filter keyword)

```bash
pm2 logs kirimkode --lines 200 --nostream | grep -i "paymenku"
pm2 logs kirimkode --lines 200 --nostream | grep -i "server-info"
```

### Restart PM2

```bash
pm2 restart kirimkode      # restart aja
pm2 reload kirimkode       # zero-downtime reload
pm2 stop kirimkode         # stop
pm2 start kirimkode        # start
pm2 status                 # liat status semua process
```

### Cek nginx

```bash
systemctl status nginx
systemctl reload nginx     # reload config tanpa downtime
nginx -t                   # test config syntax
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### Test API health

```bash
curl -sk -o /dev/null -w "HTTPS: %{http_code} | Time: %{time_total}s\n" https://kirimkode.com/
curl -sk https://kirimkode.com/api/health
```

### Database stuck / connection error

```bash
sudo systemctl status postgresql
sudo systemctl restart postgresql
sudo -u postgres psql -d kirimkode -c "SELECT count(*) FROM pg_stat_activity;"
```

### Provider error (Cloudflare block, 403, dll)

VPS lama (`38.147.122.93`) sempat di-block Cloudflare WAF beberapa provider. VPS Jagoan baru (`103.27.207.116`) seharusnya tidak ada masalah ini. Kalau muncul lagi, kontak support provider untuk whitelist IP.

---

## 🎨 Struktur Folder Penting

```
kirimkode/
├── .agents/workflows/         # Workflow rules untuk Kiro AI
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Migration history
├── public/                    # Static assets (icons, og-image, dll)
├── scripts/                   # Setup VPS + seed scripts
└── src/
    ├── app/
    │   ├── (admin)/admin/     # Admin panel pages
    │   ├── (auth)/            # Login, register, banned page
    │   ├── (dashboard)/       # User pages (buy, deposit, history)
    │   └── api/               # Backend routes
    │       ├── admin/         # Protected admin endpoints
    │       ├── cron/          # Cron job endpoints
    │       ├── otp/           # OTP order/cancel/sms (web user)
    │       ├── v1/            # Public API (developer API key)
    │       └── webhook/       # Payment webhook (Paymenku, BAYAR.GG)
    ├── components/            # React components
    ├── data/services.ts       # Server list (api1-api9 + unified)
    ├── lib/
    │   ├── auth.ts            # NextAuth config
    │   ├── db.ts              # Prisma client singleton
    │   ├── otp.ts             # Dispatcher ke provider1-9
    │   ├── provider1-9.ts     # Adapter per provider
    │   ├── pricing.ts         # Pricing rules + extra markup + timeout
    │   ├── unified-provider.ts # Bimasakti aggregation logic
    │   ├── site-settings.ts   # Setting helper (visible_servers, dll)
    │   ├── usd-rate.ts        # Auto-refresh USD/IDR (1 jam)
    │   └── ...
    └── middleware.ts          # Route protection (admin, auth, etc.)
```

---

## 🔑 Akses Admin Web

URL admin: https://kirimkode.com/admin

Halaman penting:
- `/admin` — Dashboard (statistik)
- `/admin/users` — Manajemen user (ban, edit saldo, role)
- `/admin/orders` — Daftar order + tombol Refund
- `/admin/deposits` — Daftar deposit + konfirmasi manual QRIS
- `/admin/pricing` — Atur pricing rule (markup per service+country)
- `/admin/server-visibility` — Toggle server visible di /buy & yang ikut Bimasakti
- `/admin/settings` — Toggle gateway (Paymenku/BAYAR.GG/Manual QRIS), tombol "Paksa Refresh Semua User"
- `/admin/server` — Server stats (CPU, RAM, DB stats, top tables)
- `/admin/audit-log` — Riwayat aksi admin
- ~~`/admin/api4-stock`~~ — DEPRECATED: Neptune sekarang full-auto dari `/offers`, halaman ini nonaktif (dihapus dari sidebar)
- `/admin/checker` — WhatsApp/Telegram number checker
- `/admin/broadcast` — Broadcast announcement

### Promote user jadi admin

```bash
sudo -u postgres psql -d kirimkode -c "UPDATE users SET role='admin' WHERE email='admin@example.com';"
```

Atau pakai script:
```bash
cd /var/www/kirimkode && npx tsx scripts/set-admin.ts user@example.com
```

---

## 💰 Payment Gateway

| Channel | Fee | Status flag |
|---------|-----|-------------|
| Paymenku QRIS | Rp 200 + 0.7% | `paymenku_enabled` |
| BAYAR.GG QRIS | 2.1% | `bayargg_enabled` |
| QRIS Manual (admin konfirmasi) | Rp 100 | `manual_qris_enabled` |

Master switch: `deposit_enabled` (matikan semua deposit).

Setting toggle ada di /admin/settings.

---

## 📊 Order Source Tracking

Field `order.source` di DB — track origin order:
- `web` — order dari website (login session)
- `api` — order via API key (developer)
- `bot` — order dari Telegram bot

Tampil di tabel /admin/orders sebagai badge.

---

## 🔄 Tombol "Paksa Refresh Semua User"

Lokasi: `/admin/settings` paling bawah.

Cara kerja:
1. Admin klik → set timestamp `force_refresh_at` di DB
2. Semua tab user polling `/api/refresh-version` tiap 30 detik
3. Begitu deteksi timestamp baru → `window.location.reload()` otomatis
4. User TIDAK logout — cuma hard refresh halaman

Berguna setelah update visibilitas server / pricing / fitur baru.

---

## 📝 Aturan Konvensi

- **Bahasa**: SEMUA komunikasi dengan AI harus Bahasa Indonesia
- **Commit message**: Bahasa Indonesia, deskriptif, tipe pakai conventional commits (`feat`, `fix`, `chore`, `ui`)
- **Naming server baru**: Pakai nama planet (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune)
- **Pricing rule sharing**: Mars V2 (api7) share PriceRule dengan Mars (api1) by serviceCode+countryId
- **Mercury (api8)** share rule dengan Earth (api5) + flat markup
- **Final price providers**: api3 (Saturn), api4 (Neptune), api6 (Venus), api9 (Uranus), api10 (Eris) — skip applyPricing
- **Neptune (api4) full-auto**: layanan & stok LIVE dari HeroSMS `/api/v1/activations/offers` (auth header `Authorization: ApiKey <key>`). Harga di-band per 0.01 USD (ambil harga tertinggi tiap band sebagai cap), harga jual = cap × kurs × 1.35. Beli → `getNumberV2` dengan `maxPrice=cap` tanpa `fixedPrice` (dapat nomor termurah ≤ cap, margin ≥ 35%). TIDAK ada stok manual DB lagi — halaman `/admin/api4-stock` sudah nonaktif (dihapus dari sidebar).

---

## 🆘 Emergency Contacts

- **Support Paymenku**: [URL/email kalau perlu whitelist IP]
- **Support BAYAR.GG**: [URL/email]
- **Support Cloudflare**: dashboard.cloudflare.com (akun pemilik)

---

_Last updated: Mei 2026_
