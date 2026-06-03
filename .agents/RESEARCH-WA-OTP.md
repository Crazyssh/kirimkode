# Riset & Rancangan: WA OTP Supply (Phone Farm)

> Status: RISET / RANCANGAN — belum dieksekusi.
> Tujuan: bikin supply OTP sendiri dari nomor WhatsApp di phone farm,
> bukan resell dari provider. Nomor virtual, model disposable (sekali pakai).

---

## 1. Konsep Bisnis

Jualan OTP di mana nomor yang disediakan **terdaftar di WhatsApp**, dan layanan
(Tokopedia/Gojek/dll) mengirim kode verifikasi via **pesan WhatsApp** ke nomor itu.
App di phone farm baca notifikasi WA → forward OTP ke KirimKode → tampil ke buyer.

**Model nomor:** disposable. Nomor cukup tahan beberapa hari / sampai kepakai
daftar di layanan. Mati/ban → ganti nomor baru. Tidak perlu tahan lama.

**Sumber nomor:** virtual number (beli online, termasuk bisa dari provider yang
sudah di-resell KirimKode sendiri untuk service "WhatsApp").

---

## 2. Kenapa Phone Farm (bukan Baileys / server murni)

- OTP via WA hanya muncul di **device utama** WhatsApp (bukan linked device).
- Baileys / whatsapp-web.js = linked device → TIDAK menerima kode registrasi & OTP
  yang masuk sebagai notif device utama. Jadi tidak bisa dipakai.
- Satu-satunya cara baca OTP WA otomatis = **app Android di device itu sendiri**
  yang membaca notifikasi via `NotificationListenerService`.
- Maka phone farm (banyak HP/board fisik) adalah pendekatan yang benar.

---

## 3. Hardware: Phone Farm Board

Contoh paket yang dipertimbangkan: **20× Samsung S8/S8+ Board (4GB/64GB)**.

- "Board" = motherboard saja (tanpa layar/baterai/casing), dirakit di box hub.
- Koneksi USB/LAN ke 1 PC kontroller.
- Karena virtual number → **TIDAK butuh slot SIM**. Board cukup internet via wifi/LAN.
- Semua operasi (login WA, setup) via **scrcpy** (mirror layar board ke PC).

### Pertanyaan ke penjual (wajib)
1. Android versi berapa? (minimal 8, idealnya 9 — untuk NotificationListenerService)
2. WhatsApp versi terbaru masih bisa install & jalan?
3. Garansi/replacement kalau ada board mati?
4. PC kontroller butuh spek apa untuk handle 20 board via USB?
5. Konsumsi listrik total?
6. Board bisa konek wifi (bukan cuma LAN)? Atau LAN aja?

### Catatan teknis S8
- S8 = rilis 2017, max Android 9. WA terbaru MASIH support Android 9 (cek berkala).
- Google Play Services makin berat di Android lama → tetap OK untuk WA + forwarder.

---

## 4. Arsitektur Sistem

```
[Phone Farm — 20 board Samsung S8]
   board1 (WA aktif, nomor virtual A) ─┐
   board2 (WA aktif, nomor virtual B) ─┤
   ...                                 ├─→ wifi/LAN → internet
   board20 (nomor virtual Z) ──────────┘          │
                                                   ▼
   App Forwarder (tiap board):              [Server KirimKode / VPS]
   - NotificationListenerService              POST /api/v1/wa-otp/incoming
   - Parser OTP (regex per layanan)           → match order aktif
   - HTTP POST ke server                       → isi code → tampil ke buyer
   - Foreground service (anti-kill)
   - Device token (identifikasi board)

[Remote Management]
   PC kontroller + Tailscale (VPN) + scrcpy → akses semua board dari mana aja
```

---

## 5. Alur Operasional (Lifecycle Nomor)

```
1. Board kosong (WA belum login)
2. Beli nomor virtual (untuk service "whatsapp")
3. Aktivasi WA di board pakai nomor itu (terima kode aktivasi via provider)
   → manual via scrcpy: buka WA → input nomor → masukin kode aktivasi
4. Board terdaftar di KirimKode → status "available", masuk pool inventory
5. Buyer beli nomor X untuk layanan Y → nomor jadi "busy" (lock 1 order)
6. Buyer input nomor X di layanan Y → layanan kirim OTP via WA
7. Forwarder baca notif → POST OTP → buyer lihat OTP
8. Nomor "terbakar" (kepakai daftar / di-ban / expired)
9. Logout WA di board → balik step 2 (ganti nomor)
```

**Bottleneck operasional = step 2-3 & 9 (ganti nomor).** Harus se-efisien mungkin
karena ini dikerjakan berulang. Awalnya manual via scrcpy; nanti bisa di-automate
sebagian (ADB script buka WA, dll) tapi aktivasi WA sulit 100% otomatis.

---

## 6. Skema Database (tambahan di Prisma)

### Tabel `WaDevice` (board farm)
```
id          String  @id @default(cuid())
deviceToken String  @unique   // auth token board → server
label       String             // "board-01"
status      String  @default("offline") // online | offline
lastSeenAt  DateTime?
currentNumber String?          // nomor WA yang aktif sekarang
numberStatus  String @default("empty") // empty | available | busy | burned
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
```

### Tabel `WaOtpOrder` (atau extend Order yang ada dengan server="wa")
- Saat buyer beli → reserve 1 device yang `numberStatus=available`
- Set device jadi `busy`, simpan orderId
- OTP masuk → match by deviceToken/number → isi code
- Timeout → release device balik ke `available`

### Inventory logic
- Hanya device `numberStatus=available` yang bisa dibeli
- 1 device = 1 order aktif dalam satu waktu (lock, hindari OTP ketuker)

---

## 7. Endpoint API (KirimKode)

### `POST /api/v1/wa-otp/incoming` (dipanggil app forwarder)
Auth: device token (header `X-Device-Token`)
```json
{
  "deviceToken": "...",
  "number": "+628xxx",
  "rawMessage": "Kode verifikasi Tokopedia: 123456",
  "packageName": "com.whatsapp",
  "timestamp": 1730000000
}
```
Server:
1. Validasi device token
2. Update `lastSeenAt` (heartbeat)
3. Ekstrak OTP dari rawMessage (regex)
4. Cari order aktif untuk device/number ini
5. Isi `order.code` → buyer lihat OTP (via SSE yang sudah ada)

### `POST /api/v1/wa-device/heartbeat` (status board)
Board ping tiap 30-60 detik → update online/offline.

### Admin endpoints
- `GET /api/admin/wa-devices` — list semua board + status
- `POST /api/admin/wa-devices/:id` — set status, ganti label, release manual

---

## 8. App Android Forwarder (spek)

**Stack:** Kotlin (native) atau React Native. Native lebih ringan untuk board tua.

**Komponen:**
1. `NotificationListenerService` — tangkap notif WA (`com.whatsapp`)
2. Parser OTP — regex configurable. Contoh pattern:
   - `\b(\d{4,8})\b` (ambil angka 4-8 digit)
   - Filter: hanya notif yang mengandung kata kunci "kode/code/OTP/verif"
3. HTTP client — POST ke `/api/v1/wa-otp/incoming`
4. Foreground service — notif persisten biar gak di-kill Android
5. Config screen — set server URL + device token (sekali setup)
6. Auto-start on boot (`BOOT_COMPLETED` receiver)

**Permission:**
- `BIND_NOTIFICATION_LISTENER_SERVICE` (akses notif)
- `INTERNET`
- `FOREGROUND_SERVICE`
- `RECEIVE_BOOT_COMPLETED`
- Disable battery optimization (Samsung relatif ramah)

**Kenapa NotificationListener (bukan baca DB WA):**
- Gak butuh root
- Gak nyentuh internal WA → ban-risk minimal (WA gak tau notif dibaca di OS level)
- Reliable untuk OTP (OTP selalu muncul sebagai notif)

---

## 9. Remote Management

- **Tailscale** (VPN mesh, gratis) — PC kontroller + board farm dalam 1 network
  virtual. Akses dari mana aja walau beda lokasi.
- **scrcpy** — mirror + kontrol layar board dari PC (login WA, maintenance).
  Bisa tampil banyak board sekaligus (1 window per board).
- **ADB over USB/LAN** — kontrol massal (install app, restart, dll).
- **Dashboard web KirimKode** — status semua board, OTP log, online/offline,
  tombol release/reset device.

---

## 10. Risiko & Realita (Jujur)

1. **Ban rate WA tinggi.** Nomor virtual + dipakai jualan OTP = WA cepat flag.
   Model disposable sudah mengakomodasi ini (ganti nomor rutin), tapi cost
   beli nomor virtual jadi biaya operasional utama.

2. **Aktivasi WA butuh effort manual.** Tiap ganti nomor = scan/aktivasi WA via
   scrcpy. 20 board × ganti rutin = kerjaan operator. Pertimbangkan SOP/operator.

3. **Voice-call OTP gak ke-cover.** Kalau ada layanan kirim OTP via telepon
   (bukan pesan WA), forwarder gak bisa baca. Fokus ke layanan yang OTP-nya
   berupa pesan WA.

4. **Nomor virtual untuk WA sering "sudah kepakai".** Provider virtual number
   kadang kasih nomor yang sudah pernah didaftarkan WA → gagal aktivasi. Perlu
   provider dengan nomor fresh.

5. **Penyalahgunaan & tanggung jawab.** OTP sering dipakai fraud/fake account.
   Sebagai supplier, pertimbangkan log + KYC ringan untuk buyer.

6. **ToS WhatsApp.** WA jalan natural di board (gak ada automation di dalam WA),
   jadi lebih aman dari Baileys. Tapi tetap area abu-abu kalau dipakai massal.

---

## 11. Tahapan Eksekusi (Bertahap)

### Fase 0 — Validasi (WAJIB sebelum beli 20 board)
- [ ] Test manual dengan 1-2 HP biasa yang sudah ada
- [ ] Daftar WA pakai 1 nomor virtual → cek bisa aktivasi gak
- [ ] Daftar di 1-2 layanan (Tokopedia/Gojek) pakai nomor itu → cek OTP datang
      via WA atau SMS. Catat format pesannya.
- [ ] Ukur: berapa lama nomor bertahan, berapa layanan bisa didaftar per nomor

### Fase 1 — MVP Software
- [ ] App forwarder sederhana (NotificationListener → POST)
- [ ] Endpoint `/api/v1/wa-otp/incoming` + tabel WaDevice
- [ ] Server "WA Lokal" muncul di /buy (manual inventory dulu)
- [ ] Test end-to-end dengan 1-2 HP

### Fase 2 — Scale ke Phone Farm
- [ ] Beli board farm (kalau Fase 0 & 1 sukses)
- [ ] Setup Tailscale + scrcpy + ADB
- [ ] Setup 20 board, install forwarder, aktivasi WA
- [ ] Dashboard admin untuk monitor board

### Fase 3 — Optimasi
- [ ] Parser OTP per-layanan yang akurat
- [ ] Semi-automate ganti nomor (ADB script)
- [ ] Auto-release device on timeout
- [ ] Analytics: success rate per layanan, umur nomor, profit per board

---

## 12. Keputusan yang Masih Terbuka

- [ ] App forwarder: native Kotlin atau React Native?
- [ ] Aktivasi WA: manual (scrcpy) atau coba automate?
- [ ] Nomor virtual: dari provider mana? (test fresh number rate dulu)
- [ ] Server "WA Lokal" gabung ke Bimasakti atau berdiri sendiri?
- [ ] Pricing: flat atau per-layanan?

---

_Dokumen ini living document. Update saat ada keputusan/temuan baru dari riset Fase 0._
