# KirimKode Partner — Project Info & Roadmap

> Status: PERENCANAAN — project/repository partner belum dibuat.
> Tujuan: menjadi sumber keputusan utama agar arsitektur dan urutan pengerjaan Partner Platform tidak terlupakan.
> Terakhir diperbarui: 22 Juli 2026.

---

## 1. Tujuan Produk

KirimKode Partner adalah platform supplier nomor OTP. Partner dapat menyediakan nomor melalui:

- APK Android;
- USB modem/GoIP melalui agent;
- direct API dari sistem partner sendiri.

Nomor partner masuk ke inventory KirimKode, dapat dipesan buyer, lalu SMS/OTP dikirim oleh perangkat partner ke server. Partner memperoleh pendapatan setelah order berhasil.

## 2. Keputusan Arsitektur Final

| Bagian | Keputusan |
|---|---|
| Repository | Terpisah: rencana `Crazyssh/kirimkode-partner` |
| Aplikasi | Next.js project mandiri |
| Domain portal | `partner.kirimkode.com` |
| Domain agent API | `partner-api.kirimkode.com` |
| VPS | Tetap VPS KirimKode pada tahap awal |
| Folder VPS | `/var/www/kirimkode-partner` |
| Port | `3001` |
| PM2 | Terpisah: `kirimkode-partner` |
| Database server | PostgreSQL yang sama pada tahap awal |
| Data partner | Tabel/schema dan ledger dipisahkan secara logis |
| Integrasi buyer | Internal API terautentikasi dan idempotent |
| APK/modem | Dibuat setelah portal dan simulator stabil |

Web utama tetap berjalan sebagai aplikasi terpisah:

```text
/var/www/kirimkode          → port 3000 → PM2 kirimkode
/var/www/kirimkode-partner  → port 3001 → PM2 kirimkode-partner
```

## 3. Alasan Dipisahkan

- Build dan restart partner tidak mengganggu buyer.
- Error atau lonjakan heartbeat perangkat tidak menjatuhkan web utama.
- Dependency, `.next`, environment, log, dan rollback berdiri sendiri.
- Portal/API partner dapat ditambah instance tanpa menambah instance buyer.
- APK dan modem tetap dapat mengirim heartbeat ketika web buyer dideploy.

Nginx mengarahkan domain ke aplikasi masing-masing:

```text
kirimkode.com              → 127.0.0.1:3000
partner.kirimkode.com      → 127.0.0.1:3001
partner-api.kirimkode.com  → 127.0.0.1:3001/api/agent
```

## 4. Aturan Bisnis Awal

1. Partner harus disetujui admin sebelum dapat menyediakan nomor.
2. Partner menentukan `basePrice`; KirimKode menerapkan guardrail dan markup.
3. Satu nomor hanya boleh memiliki satu order aktif.
4. Nomor harus online dan available sebelum dapat direservasi.
5. Pendapatan partner dibuat setelah OTP berhasil diterima buyer.
6. Order gagal, timeout, atau dibatalkan tidak menghasilkan payout.
7. Earning dapat ditahan sebelum menjadi available untuk mengantisipasi refund/dispute.
8. Payout MVP diproses manual oleh admin.
9. Saldo buyer dan earning partner wajib memakai ledger berbeda.
10. Harga termurah tidak selalu dipilih; routing juga memperhitungkan kualitas.

Rumus awal:

```text
harga buyer = basePrice partner + platform fee + markup KirimKode
payout partner = basePrice yang dikunci saat nomor berhasil direservasi
```

## 5. Lifecycle Utama

### Nomor

```text
offline → available → reserved → busy → available/disabled
```

### Order

```text
created → reserved → waiting_sms → success
                         ├── timeout
                         ├── cancelled
                         └── failed
```

### Pendapatan

```text
pending → available → requested → paid
    └── reversed
```

Harga dan payout harus disalin ke snapshot order ketika reservasi. Perubahan harga berikutnya tidak boleh mengubah order yang sudah berjalan.

## 6. Model Data Minimum

```text
Partner              identitas dan status supplier
PartnerMember        anggota/tim partner
PartnerDevice        APK, modem, GoIP, atau koneksi API
PartnerNumber        nomor dan status inventory
PartnerOffer         service, country, operator, basePrice
PartnerOrder         assignment order buyer ke nomor partner
PartnerSmsLog        audit SMS mentah dan OTP hasil ekstraksi
PartnerEarning       ledger pendapatan partner
PartnerPayout        permintaan dan proses pencairan
PartnerApiKey        kredensial API yang dapat dirotasi
PartnerWebhook       konfigurasi direct API partner
```

Semua perubahan skema harus additive dan tidak boleh menghapus data buyer. Kepemilikan Prisma migration dan pilihan schema PostgreSQL wajib difinalkan di design spec sebelum migration pertama dibuat.

## 7. Roadmap Step by Step

### Step 0 — Spec dan keputusan produk

- [ ] Buat spec `partner-platform` (requirements, design, tasks).
- [ ] Finalkan model harga, markup, earning hold, refund, dan payout.
- [ ] Finalkan hubungan database/schema antara main dan partner.
- [ ] Finalkan kontrak internal API dengan web buyer.
- [ ] Tentukan layanan MVP; rekomendasi satu negara dan satu layanan dahulu.

**Selesai jika:** lifecycle order, nomor, earning, dan kegagalan sudah tidak ambigu.

### Step 1 — Bootstrap project partner

- [ ] Buat repository private `Crazyssh/kirimkode-partner`.
- [ ] Buat Next.js project minimal.
- [ ] Tambahkan lint, typecheck, build, environment example, dan README.
- [ ] Siapkan struktur portal, API portal, agent API, dan library domain.
- [ ] Jangan menyalin secret dari `.env` web utama ke Git.

**Selesai jika:** project dapat dibuild secara mandiri tanpa menyentuh KirimKode utama.

### Step 2 — Infrastruktur VPS terpisah

- [ ] Clone ke `/var/www/kirimkode-partner`.
- [ ] Konfigurasi `.env` khusus partner di VPS.
- [ ] Jalankan port `3001` dengan PM2 `kirimkode-partner`.
- [ ] Konfigurasi Nginx dan Cloudflare untuk dua domain partner.
- [ ] Tambahkan health endpoint dan pemeriksaan log.

**Selesai jika:** deployment/reload partner tidak merestart `kirimkode`.

### Step 3 — Database dan domain core

- [ ] Tambahkan model partner, device, number, offer, order, SMS, earning, payout, dan API key.
- [ ] Terapkan unique constraint dan transaksi reservasi nomor.
- [ ] Tambahkan snapshot base price, retail price, dan payout pada order.
- [ ] Tambahkan idempotency untuk reservasi dan SMS masuk.
- [ ] Terapkan migration additive tanpa operasi penghapusan data.

**Selesai jika:** dua request bersamaan tidak dapat memperoleh nomor yang sama.

### Step 4 — Authentication dan onboarding

- [ ] Registrasi/login partner.
- [ ] Verifikasi email dan reset password.
- [ ] Status pending, approved, suspended, dan rejected.
- [ ] Role owner/member serta proteksi route.
- [ ] Persetujuan partner secara manual oleh admin.

**Selesai jika:** hanya partner approved yang dapat mengaktifkan inventory.

### Step 5 — Partner Portal MVP

- [ ] Dashboard statistik.
- [ ] Halaman perangkat.
- [ ] Halaman nomor.
- [ ] Halaman offer dan base price.
- [ ] Order aktif dan riwayat.
- [ ] Earning dan payout.
- [ ] Pengaturan akun dan API key.

**Selesai jika:** partner dapat mengelola seluruh data MVP dari portal.

### Step 6 — Admin Partner

- [ ] Review dan approve partner.
- [ ] Monitor perangkat, nomor, order, SMS, dan kualitas.
- [ ] Atur guardrail harga dan markup.
- [ ] Suspend partner/device/number.
- [ ] Review earning dan proses payout manual.
- [ ] Audit log untuk tindakan sensitif.

Admin Partner sebaiknya berada di aplikasi partner agar update fiturnya tidak membutuhkan restart web buyer.

**Selesai jika:** operasi partner dapat dikendalikan tanpa akses database manual.

### Step 7 — Agent API dan simulator

- [ ] Endpoint register device/number.
- [ ] Endpoint heartbeat.
- [ ] Endpoint perubahan status nomor.
- [ ] Endpoint SMS masuk.
- [ ] Auth token per-device, rotasi token, rate limit, dan replay protection.
- [ ] Simulator untuk device online, nomor tersedia, dan SMS OTP.

Target alur simulator:

```text
nomor tersedia → buyer order → nomor terkunci → SMS simulasi masuk
→ OTP ditemukan → order sukses → earning partner pending
```

**Selesai jika:** alur end-to-end berhasil tanpa APK atau modem fisik.

### Step 8 — Integrasi web buyer

- [ ] Buat internal API antara KirimKode dan Partner Platform.
- [ ] Tambahkan provider internal partner ke dispatcher order utama.
- [ ] Implementasikan reserve, status, retry bila didukung, cancel, dan timeout.
- [ ] Gunakan service-to-service key dan idempotency key.
- [ ] Aktifkan hanya untuk akun tester/private beta.

Perubahan ini memerlukan satu kali deployment web buyer. Setelah adapter stabil, perubahan portal partner tidak perlu merestart buyer.

**Selesai jika:** buyer tester dapat membeli nomor simulasi dan menerima OTP.

### Step 9 — APK Android MVP

- [ ] Registrasi perangkat menggunakan token.
- [ ] Baca SMS/notifikasi sesuai jenis supply.
- [ ] Heartbeat dan status nomor.
- [ ] Queue offline dan retry idempotent.
- [ ] Auto-start setelah reboot.
- [ ] Tampilkan status koneksi dan error.
- [ ] Uji satu HP dan satu SIM terlebih dahulu.

**Selesai jika:** satu order nyata berhasil dari HP sampai payout pending.

### Step 10 — Agent modem MVP

- [ ] Satu STB/PC, satu Huawei E3531, dan satu SIM.
- [ ] Gammu SMSD membaca SMS.
- [ ] Agent meneruskan heartbeat dan SMS ke Partner API.
- [ ] Mapping modem stabil dan auto-reconnect.
- [ ] Uji timeout, modem dicabut, internet putus, dan SMS duplikat.

**Selesai jika:** modem dapat berjalan stabil sebelum diperbanyak.

### Step 11 — Direct API supplier

- [ ] Dokumentasi API dan webhook.
- [ ] HMAC/signature, timestamp, nonce, dan IP allowlist opsional.
- [ ] Endpoint inventory dan SMS batch.
- [ ] Sandbox serta kredensial produksi terpisah.

**Selesai jika:** partner yang memiliki sistem sendiri tidak membutuhkan APK/modem agent KirimKode.

### Step 12 — Pricing, quality, payout, dan scale

- [ ] Routing berdasarkan harga, success rate, latency, uptime, dan kegagalan.
- [ ] Hold period, dispute, reversal, dan fraud detection.
- [ ] Payout otomatis setelah proses manual stabil.
- [ ] Queue/worker terpisah jika trafik meningkat.
- [ ] Pisahkan Partner API ke service/PM2 sendiri bila portal mulai terdampak.
- [ ] Monitoring, alert, backup, dan disaster recovery.

## 8. Scope MVP Pertama

MVP sengaja dibatasi menjadi:

```text
1 partner approved
1 device simulator
1 nomor Indonesia
1 layanan
1 base price
1 order buyer tester
1 SMS simulasi
1 OTP sukses
1 earning pending
1 payout manual
```

Yang belum masuk MVP: KYC otomatis, payout otomatis, dynamic routing kompleks, banyak negara, banyak operator, dan deployment multi-server.

## 9. Keamanan dan Reliability Wajib

- API key/token tidak boleh disimpan plaintext jika dapat di-hash.
- Gunakan HTTPS, rate limit, idempotency, dan audit log.
- Jangan percaya `partnerId`, harga, nomor, atau status dari client tanpa validasi server.
- Reservasi nomor wajib atomic.
- SMS mentah dianggap data sensitif; batasi akses dan tetapkan retention.
- OTP hanya boleh dipasangkan ke order aktif milik nomor/device yang benar.
- Jangan memakai memory proses sebagai sumber status karena PM2 dapat berjalan multi-instance.
- Heartbeat, inventory, order, dan earning harus tersimpan persisten.
- Secret main web dan partner harus berbeda.
- Payout membutuhkan approval, audit trail, dan proteksi double processing.

## 10. Deployment Terpisah

Deploy partner tanpa migration:

```bash
cd /var/www/kirimkode-partner && git pull && npm ci && npm run build && pm2 reload kirimkode-partner --update-env
```

Jika ada migration additive yang sudah direview:

```bash
cd /var/www/kirimkode-partner && git pull && npm ci && npx prisma migrate deploy && npm run build && pm2 reload kirimkode-partner --update-env
```

Perintah partner tidak boleh menjalankan `pm2 restart kirimkode`, drop database, reset database, atau menghapus data.

Deploy web buyer tetap terpisah:

```bash
cd /var/www/kirimkode && git pull && npm run build && pm2 reload kirimkode
```

## 11. Keputusan Belum Final

- [ ] Satu database dengan schema terpisah atau database partner terpisah pada server PostgreSQL yang sama.
- [ ] Repository migration mana yang menjadi sumber kebenaran.
- [ ] Nama provider internal/planet untuk supply partner.
- [ ] Layanan dan negara MVP pertama.
- [ ] Besar platform fee, markup, hold period, dan minimum payout.
- [ ] SMS biasa, WhatsApp notification, atau keduanya pada APK pertama.
- [ ] Metode payout awal.
- [ ] Kebutuhan KYC partner untuk private beta.

Semua keputusan ini wajib diselesaikan dalam spec sebelum implementasi terkait dimulai.

## 12. Urutan Singkat yang Tidak Boleh Tertukar

```text
Spec
→ Project partner terpisah
→ Infrastruktur PM2/Nginx terpisah
→ Database core
→ Auth/onboarding
→ Partner Portal
→ Admin Partner
→ Agent API + simulator
→ Integrasi buyer private beta
→ APK Android
→ Agent modem
→ Direct API
→ Scale dan otomatisasi payout
```

---

Dokumen referensi terkait di repository utama:

- `.agents/PROJECT-INFO.md`
- `.agents/RESEARCH-MODEM-SMS.md`
- `.agents/RESEARCH-WA-OTP.md`
- `.agents/workflows/after-code-change.md`

_Living document. Perbarui setiap ada keputusan arsitektur, perubahan domain/port, atau perubahan urutan roadmap._
