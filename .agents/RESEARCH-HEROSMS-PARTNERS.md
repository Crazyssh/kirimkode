# Riset: HeroSMS Partners (portal supplier) — catatan referensi

> Sumber: 7 halaman instruksi resmi HeroSMS di telegra.ph (Workers, Prices, Personal account,
> Terms of service, Description of work Partners/Mobile, Connecting physical equipment) —
> diakses untuk membandingkan dengan Partner Platform kita (`kirimkode-partner`).
> Diverifikasi ulang & dilengkapi 2026-07-24.
> Tujuan: referensi produk/ekonomi/keamanan. Bukan untuk disalin mentah; MVP kita tetap
> simulator-only + `wa/ID/any` + payout bank manual.

## 1. Model bisnis & ekonomi
- **Revenue split 85/15**: partner menyimpan 85% komisi dari setiap penjualan, tanpa batasan service.
- **FreePrice**: fitur harga premium, aktif setelah **30 hari active sales**. Untuk service scarce/demand tinggi, earnings maksimum bisa **2–10×** di atas harga maksimum normal.
- **Harga minimum** slider: **$0.005** per service (sama untuk semua service di posisi minimum).
- **Batas ubah harga**: maksimum **10 kali per 10 menit**, lalu dibatasi.
- **Physical vs protocol numbers**: nomor dari perangkat fisik diprioritaskan (success rate lebih tinggi); protocol/API dijual hanya jika fisik tak tersedia. Partner bisa lihat harga kompetitor "all" vs "physical only".

## 2. Pricing engine (halaman "Prices")
- Dua mode: **Sliders (manual)** vs **AutoPrice** — setting AutoPrice override manual/API.
- Set harga massal per **country** (satu negara per sesi): Maximum / Average / Minimum.
  - **Average** = rata-rata aritmetik semua penjualan sukses partner utk country/service pada **1 jam terakhir**.
  - **Automatic average price** = selalu match rata-rata semua partner; update tiap **10 menit**; bisa untuk TOP-10 dan/atau Other services.
- **TOP services**: ditentukan dari jumlah penjualan HeroSMS **7 hari terakhir**, update harian.
- **Overall satisfaction (demand satisfaction)** = `(nomor sukses diterbitkan ÷ jumlah request) × 100%`, dihitung real-time sejak 00:00 UTC+3. Warna: **>60% hijau, 30–60% kuning, <30% merah**. Dipakai untuk deteksi service yang perlu turun harga.
- **Getting into the demand range**: filter agar harga masuk rentang permintaan.
- Kartu service: toggle jual/tidak, Favorite, tag TOP sales, tag Free Price (×10), **sales chart** (bar ungu = penjualan kompetitor per harga), **competitive prices** (bar biru = ketersediaan nomor per harga), set income manual (± per unit / slider), ban expiry (UTC+3).
- Filter kartu: All / Favorite / On sale / Disabled / Banned.
- **Master toggle "Services"** tri-warna: **ungu** = semua service aktif, **kuning** = sebagian aktif, **hitam** = semua nonaktif.
- Country nomor baru muncul **10–15 menit** setelah SIM di-listing.

## 3. Workers, device, & perangkat (arsitektur agen)
- **Worker = 1 PC/agent** terhubung ke satu akun partner. Multi-PC = multi-worker.
  - Buat worker: email (boleh fiktif, format email saja) + password → jadi login software.
  - **API key sama untuk semua worker/PC** akun itu; login+password unik per worker & hanya bisa 1 PC.
  - Worker punya: ID, toggle enable, jumlah ports aktif, versi software, status. Disable worker butuh **konfirmasi eksplisit** (anti salah klik). Hanya worker "Disabled" yang bisa dihapus. Hapus/ubah password worker butuh **kode email + kode 2FA**.
  - Analytics per worker: successful operations, total earnings, avg earnings/port, export CSV.
- **Desktop software (HeroSMS-Partners)**: konfigurasi & jual SIM.
  - **1 modem = 32 ports**. Set "Number of modems" sesuai ports terpasang.
  - Fitur: exclude service tertentu, load SIM dari file, get number by call, auto number request, USSD custom untuk deteksi nomor, SIM-bank management, "Put sim for sale" toggle, statistik service load / sold services / profit (update tiap 5 menit), "Remove SIM" berdasarkan waktu kerja & profit, SimID port numbering.
- **Mobile app (HeroSMS-Mobile)**: untuk yang tak bisa pakai hardware; HP jadi modem port.
  - **2 SIM ports per device** (walau HP support 3+); support eSIM.
  - Login via **scan QR** dari worker (tab MOBILE → "Display QR code"), QR ada masa berlaku.
  - Butuh permission SMS + camera + notifikasi + **background** (kalau tidak, port putus).
  - 4 proses background: ambil info SIM, deteksi nomor via **USSD**, terima SMS→kirim server, **ping SIM** (keep-alive).
  - Deteksi nomor otomatis; fallback manual pilih operator/region (butuh **PLMN = MCC+MNC**), atau input nomor manual (harus pakai country code). Bahasa: RU/EN/PT/ZH.
  - **Update kritis wajib** dipasang (blocking); update biasa opsional.
- **Physical GSM modem** ("Connecting physical equipment"):
  - Konfigurasi port: **4 / 8 / 16 / 32 / 64-port**; paling andal **16 & 32-port** dengan modul **Quectel M26/M35**. Brand lain yang didukung: ZTE, Huawei, Simcon, Wavecom.
  - Koneksi via USB ke PC; cek Device Manager semua port muncul tanpa error. Troubleshooting: pindah port USB/ganti kabel, update driver (arsip disediakan), tambah **PCI Express USB 2.0 card** untuk banyak modem.
  - **Jangan pakai laptop** (keterbatasan hardware multi-port).
- **Physical GoIP** ("Connecting physical equipment"):
  - Brand didukung: **DBL, Ejoin, Skyline, TeIQ**. **SIM bank untuk GoIP TIDAK didukung.**
  - Temukan IP device via **Advanced IP Scanner** (GoIP + PC satu router/LAN).
  - GoIP DBL: web login **Admin/Admin**; set SMS Server IP `goip.partnersservices.net`, Port `4445`, SMS Client ID `mNlineN` (penomoran port lintas device berlanjut: device1 line1–4, device2 line5–8), Password = API key.
  - GoIP Ejoin/Skyline/TeIQ: web login **root/root**; Status Notification URL `http://goip.partnersservices.net:8081/goip/listener`, interval 60. Perlu kirim **MAC address + worker login + manufacturer** ke support untuk binding.

## 4. Finance & penarikan (halaman "Personal account" / "Finance")
- Metode withdraw: **USDT TRC-20**, **USDC BEP20 (BSC)**, **USDC Polygon** — fee 1 unit.
  - **Mobile partners**: minimum **$3**.
  - **Other partners (API/hardware)**: minimum **$100**.
- **Waktu proses withdrawal**: **≤7 hari** selama 30 hari pertama active sales, lalu **24 jam** setelah 30 hari active sales (berlaku baik hardware maupun API). Berhenti aktif → periode restriction diperpanjang.
- Withdraw kapan saja, tapi **wajib 2FA + security question aktif** dulu.

## 5. Terms of service (kebijakan penting)
- **Anti-resale**: dilarang jual ulang/pakai nomor untuk keperluan pribadi **2 bulan** setelah terjual; dilarang menyediakan nomor yang sudah dipakai/terjual di platform lain dalam 2 bulan sebelumnya; dilarang interaksi apa pun dengan service terjual selama 2 bulan.
- **Denda resale**: #1 $30 + $60 dibekukan; #2 $60 + $120; #3 $100 + $200; #4 **disconnect permanen semua akun**. Dana beku kembali 6 bulan setelah denda terakhir.
- **Denda interaksi akun terjual**: denda = harga maksimum service/country di web (min $30 total), service dinonaktifkan permanen.
- **Service mutual exclusion** (contoh): beli utk WhatsApp (wa) → jual utk AstroPay (gr) dinonaktifkan (& sebaliknya); Kazakhstan Uber↔YandexGo; Ukraina/Polandia NovaPoshta↔Viber; Belanda wa↔WhatsApp Business.
- **Financial services** (bank/wallet/crypto) tak tersedia utk partner baru; buka via support dengan **deposit beku $300** (unfreeze 14 hari setelah dimatikan).
- Liability: SIM harus baru/bersih, disimpan 2 bulan, tak dipakai 2 bulan sebelumnya; dilarang operasi saldo pulsa SIM; disarankan tidak registrasi SIM atas nama sendiri.

## 6. Keamanan akun (halaman "Settings")
- **2FA** via Google Authenticator, terpisah untuk **Financial Operations** vs **Login to account**.
- **Security question**: satu-satunya cara reset 2FA. Wajib set begitu dana pertama masuk.
- **Recovery code**: untuk ganti email & reset 2FA (tulis di kertas, tak bisa dipulihkan).
- **Password**: wajib ganti tiap 6 bulan (kalau tidak, semua tab kecuali Settings disembunyikan). Policy: min 1 huruf besar+kecil Latin, 1 digit, 1 karakter khusus. Ganti password butuh kode email + kode 2FA.
- **Active sessions**: tampil device + lokasi (mis. Windows, Pekanbaru).

## 7. Implikasi untuk Partner Platform kita (kirimkode-partner)
Sudah selaras dgn desain kita:
- Worker/agent ≈ **PartnerDevice** (`simulator|android|modem|goip|api`) + **Agent API v1**; "ports/slots" ≈ capability `slots`; heartbeat/ping ≈ heartbeat kita; deteksi nomor + SMS ingestion ≈ pipeline kita.
- Pricing server-authoritative ≈ guardrail + markup kita (kita sengaja lebih sederhana).
- Finance/hold/payout manual ≈ ledger + Payout kita.

Ide konkret worth dipertimbangkan (mostly **post-MVP**):
1. **Payout hold berbasis tenure** (7 hari → 24 jam setelah 30 hari active sales) — kita sekarang hold tetap 24 jam.
2. **Minimum withdrawal berbeda per tipe partner** (mobile $3 vs API/hardware $100).
3. **AutoPrice / automatic average / demand-satisfaction** sebagai pricing lanjutan (kita tunda; MVP guardrail saja).
4. **Overall satisfaction metric** (`sukses ÷ request`) sebagai sinyal kualitas per service/country.
5. **Anti-resale & retensi nomor 2 bulan + skema denda/freeze** — relevan untuk kebijakan supplier saat scale.
6. **Service mutual-exclusion** (beli wa → tak boleh jual service tertentu di nomor sama).
7. **2FA terpisah untuk operasi finansial** + **security question** + **recovery code** (perkuat Settings kita yang MVP-nya baru password+session).
8. **1 modem = 32 ports**, **mobile 2 SIM/device**, GoIP `mNlineN` numbering — pola konkret saat masuk hardware pasca-MVP.
9. **Rate limit ubah harga** (10×/10 menit) & **Free Price ×10** untuk service langka.
10. **QR pairing** untuk mobile agent (worker → scan QR) sebagai UX koneksi device.

> Catatan scope: semua di atas adalah referensi. Task MVP kita tidak berubah — tetap berhenti di
> simulator private beta, `wa/ID/any`, payout bank manual. Item ini masuk kandidat roadmap pasca-MVP.
