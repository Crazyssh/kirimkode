# Riset & Rancangan: SMS OTP Supply via USB Modem (Modem Pool)

> Status: RANCANGAN — hardware sudah diputuskan, software belum dibangun.
> Tujuan: bikin supply OTP **SMS** sendiri dari SIM fisik di USB modem,
> bukan resell dari provider. Nomor punya sendiri → margin penuh.

---

## 1. Konsep Bisnis

Jualan OTP di mana nomor disediakan dari **SIM fisik di USB modem** milik sendiri.
Layanan (Tokopedia/Gojek/WA/dll) kirim kode verifikasi via **SMS** ke nomor itu.
Modem terima SMS → agent forward ke KirimKode → tampil ke buyer.

**Beda dengan api1–api10:** itu resell dari provider luar. Yang ini nomor punya
sendiri → margin penuh, tapi ada beban operasional (isi SIM, jaga modem nyala).

**Batasan:** hanya OTP yang dikirim via **SMS ke nomor +62**. Layanan yang kirim
OTP via WhatsApp (bukan SMS) TIDAK ketangkep — itu ranah riset phone-farm WA (dok terpisah).

---

## 2. Hardware (SUDAH DIPUTUSKAN)

Skala target: **50 modem**, tersebar di beberapa node kecil (bukan 1 mesin).

### Per node (~8-10 modem)
| Komponen | Pilihan | Catatan |
|----------|---------|---------|
| Mesin | **STB oprek + Armbian** | Murah (~Rp100-250rb), hemat daya. Wajib boot dari SD berkualitas / USB biar tahan mati listrik. Clone 1 image ke semua STB. |
| Koneksi | **LAN (bukan wifi 2.4GHz)** | Hub USB 3.0 bikin interferensi 2.4GHz → ganggu wifi. Pakai kabel LAN. |
| USB hub | **Powered USB hub 10-port** (mis. WLX-985A) | Adaptor 12V/5A (60W) — lega buat 10 modem. Saklar per-port (bisa reset modem tanpa cabut). |
| Modem | **Huawei E3531** (21Mbps, SMS) | Mode stick/AT, gammu-friendly. 3G/2G, SMS masuk via **2G (900/1800MHz)** karena 3G Indonesia sudah dimatikan. |
| SIM | 1 SIM per modem | Reliabilitas SMS = fungsi operator + kekuatan sinyal 2G di lokasi. |

### Arsitektur skala 50 modem
```
STB-1 + powered hub → ~10 modem → agent ┐
STB-2 + powered hub → ~10 modem → agent ┤
STB-3 + powered hub → ~10 modem → agent ┼→ HTTPS → VPS KirimKode
STB-4 + powered hub → ~10 modem → agent ┤   (tiap modem 1 token)
STB-5 + powered hub → ~10 modem → agent ┘
```
1 STB mati = cuma ~10 modem hilang (blast radius kecil).

### Kenapa gammu (bukan HiLink)
- E3531 dibaca gammu di Linux via mode stick (AT command). gammu-smsd = daemon
  per modem, auto-simpan SMS masuk. Ringan.
- HiLink (E3372h) di-skip: tiap modem = IP `192.168.8.1` → bentrok kalau banyak.

### Power
- STB: adaptor bawaannya (5V/2A).
- Modem: dari adaptor powered hub (BUKAN dari STB). Rating Ampere hub = faktor #1.
- PSU 5V industrial (mis. 5V/40A) = opsi nanti kalau puluhan modem per lokasi.

---

## 3. Model Biaya (referensi)

Per node (1 STB + 1 hub + 10 modem + 10 SIM) ≈ **Rp1.876.890** (≈ Rp187.689/modem all-in).
- Reusable (STB+hub+modem) ≈ Rp1,77jt → tahan bertahun-tahun.
- Habis pakai (SIM+pulsa) ≈ Rp100rb → biaya rutin ganti nomor.

Break-even node (asumsi, WAJIB diukur di fase tes):
| Skenario | OTP/modem/hari | Harga net | Pendapatan/node/hari | Balik modal |
|----------|---------------|-----------|---------------------|-------------|
| Konservatif | 5 | Rp1.000 | Rp50.000 | ~38 hari |
| Menengah | 12 | Rp1.000 | Rp120.000 | ~16 hari |
| Optimis | 20 | Rp1.500 | Rp300.000 | ~6 hari |

Penentu nyata: jumlah order masuk (demand), umur SIM, success rate SMS.

---

## 4. Arsitektur Software

VPS di cloud (tanpa USB) = tetap "otak". Modem nancep di STB lokal yang jalanin
**agent** (jembatan modem → VPS).

```
[STB Armbian + powered hub]
   modem1..N ──(gammu-smsd baca SMS)──► folder/DB lokal
                                          │
                                   Agent Node.js:
                                   - baca SMS baru dari gammu
                                   - POST ke VPS (HTTPS)
                                   - heartbeat per modem
                                          │
                                          ▼
                              [VPS KirimKode / Next.js]
                              POST /api/agent/sms/incoming
                              POST /api/agent/heartbeat
                              → match order aktif di modem itu
                              → ekstrak OTP → isi order.code
                              → buyer lihat OTP (SSE existing)
```

Integrasi: tambah **server baru `modem`** (nama planet, kandidat: **Pluto / Terra**).
Alur order beda dari resell:
- `createOrder` = reserve 1 modem `idle`+`online`, balikin nomornya (BUKAN call API luar)
- `checkSms` = baca `order.code` dari DB kita (diisi endpoint incoming)
- `cancelOrder` = lepas modem balik ke pool
- `getLayanan` = daftar layanan yang ditawarkan + harga + jumlah modem `idle` (= stok)

---

## 5. Skema Database (tambahan Prisma)

### `Modem`
```
id             String   @id @default(cuid())
token          String   @unique   // auth agent → server (per modem)
label          String              // "stb1-modem-01"
machineGroup   String?             // "stb-1" — grouping per mesin (monitor 50 modem)
phoneNumber    String?             // nomor SIM
operator       String?             // Telkomsel/XL/dll (info)
status         String  @default("offline") // online | offline
slotStatus     String  @default("idle")    // idle | busy | disabled
currentOrderId String?             // order yang mengunci modem ini
lastSeenAt     DateTime?
signal         Int?                // kekuatan sinyal (opsional dari agent)
createdAt      DateTime @default(now())
updatedAt      DateTime @updatedAt
```

### `ModemSms` (log audit semua SMS masuk)
```
id             String   @id @default(cuid())
modemId        String
sender         String?             // pengirim SMS
text           String              // isi mentah
extractedCode  String?             // OTP hasil ekstrak
matchedOrderId String?             // order yang cocok (kalau ada)
receivedAt     DateTime @default(now())
```

Order tetap pakai tabel `Order` existing (`server = "modem"`).

---

## 6. Endpoint VPS (baru)

Auth: header `X-Modem-Token` (token per-modem). Tanpa token → 401.

- **`POST /api/agent/sms/incoming`** — agent kirim SMS masuk.
  Body: `{ sender, text, receivedAt }`. Server: validasi token → catat ModemSms →
  cari order aktif modem itu → ekstrak OTP → isi `order.code`.
- **`POST /api/agent/heartbeat`** — agent lapor modem hidup (~30 detik sekali).
  Body: `{ phoneNumber?, operator?, signal? }`. Server: `status=online` + `lastSeenAt`.
  Cron/logika mark `offline` kalau heartbeat putus > X detik.

### Admin
- **`/admin/modem`** — dashboard tahan 50 modem: list online/offline, idle/busy,
  sinyal, nomor; grouping per `machineGroup`; generate token (massal); enable/disable;
  lepas paksa modem yang nyangkut.

---

## 7. Ekstraksi OTP

SMS mentah → ambil kode. Pola dasar: angka 4-8 digit, filter SMS yang mengandung
kata "kode/code/OTP/verif". Dipertajam per-layanan nanti.

---

## 8. Pricing

Nomor punya sendiri → harga bebas. Rancangan: **flat per order dulu** (bisa diubah
admin), lalu naik ke per-layanan via `PriceRule` prefix `"modem:"` (pola sama seperti
Eris/Mercury yang sudah ada).

---

## 9. Keamanan

- `/api/agent/*` WAJIB token per-modem (cegah injeksi OTP palsu). HTTPS.
- Rate limit ringan di endpoint incoming.
- Semua SMS masuk dicatat di `ModemSms` (audit).

---

## 10. Tahapan Build

### Fase 1 — Software VPS (bisa dites TANPA modem, pakai curl)
- [ ] Model Prisma `Modem` + `ModemSms` + migration
- [ ] Endpoint `/api/agent/sms/incoming` + `/api/agent/heartbeat` (auth token)
- [ ] Adapter `provider-modem.ts` masuk dispatcher `otp.ts`
- [ ] Daftar server `modem` di `services.ts`
- [ ] Admin dashboard `/admin/modem` (grouping per mesin, tahan 50 modem)

### Fase 2 — Agent PC/STB
- [ ] Setup Armbian + gammu-smsd + usb-modeswitch di 1 STB (tes)
- [ ] Agent Node.js: baca SMS dari gammu → POST ke VPS + heartbeat
- [ ] Tes end-to-end 2-3 modem: order → SMS masuk → OTP tampil ke buyer

### Fase 3 — Scale & polish
- [ ] Clone image STB, deploy 5-6 node = 50 modem
- [ ] udev rules mapping port (nama /dev/ttyUSB stabil)
- [ ] Pricing per-layanan, auto-release timeout, tampil rapi di /buy
- [ ] Analytics: OTP sukses/modem/hari, umur SIM, success rate

---

## 11. Risiko (Jujur)

1. **Hanya SMS +62.** OTP via WA tidak ketangkep (ranah dok WA terpisah).
2. **Sinyal 2G.** 3G sudah mati → SMS via 2G. Di lokasi sinyal 2G lemah, SMS telat/gagal.
3. **Ban/blokir SIM** kalau dipakai OTP intensif → ganti SIM berkala (biaya + tenaga).
4. **Registrasi SIM** (NIK/KK) = beban administratif buat 50 SIM.
5. **Modem nyala 24 jam** butuh listrik + internet stabil + pendinginan (panas).
6. **Demand.** Modem nganggur = rugi. Scale mengikuti order masuk, bukan sebaliknya.
7. **Penyalahgunaan.** OTP rawan fraud → pertimbangkan log + KYC ringan buyer.

---

## 12. Keputusan Masih Terbuka

- [ ] Nama server: **Pluto** atau **Terra**?
- [ ] Pricing awal: flat berapa?
- [ ] Server "modem" gabung Bimasakti (unified) atau berdiri sendiri?
- [ ] Umur max order (timeout) berapa menit untuk server modem?
- [ ] Mode SMS kedua (resend) didukung atau sekali pakai?

---

_Living document. Update saat ada keputusan/temuan baru._
_Hardware final: STB Armbian + powered USB hub 10-port + Huawei E3531. Dibahas & disepakati sebelum Fase 1._
