# Implementation Plan: Email Service

## Overview

Implementasi bertahap layer email KirimKode di atas SMTP standar (provider-agnostic via ENV), mengikuti `design.md`. Urutan pembangunan: data model → konfigurasi → SMTP sender → template i18n → Email_Service orkestrasi → Verification_Service → Password_Reset_Service → Marketing_Service → route handlers. Setiap langkah membangun di atas langkah sebelumnya dan diakhiri dengan wiring ke route handler nyata sehingga tidak ada kode menggantung.

Bahasa implementasi: **TypeScript** (sesuai stack Next.js 16 / Prisma / NextAuth v5). Property-based test memakai `fast-check` + `vitest` (dijalankan sekali dengan `--run`, bukan mode watch). Layer service (`src/lib/email/*`) adalah target property test dengan mock `SMTP_Sender` dan basis data test terisolasi.

## Tasks

- [x] 1. Set up data model dan infrastruktur test
  - [x] 1.1 Tambah model Prisma dan field email pada `User` beserta migrasi
    - Tambah field `locale` (default `"id"`), `marketingOptOut` (default false), `optOutToken` (unique, nullable) pada model `User` di `prisma/schema.prisma`
    - Tambah model `EmailVerificationToken`, `PasswordResetToken`, `Broadcast`, `BroadcastRecipient` dengan index dan relasi sesuai design (tokenHash unique, expiresAt, usedAt, dst.)
    - Buat migrasi Prisma baru dan jalankan `prisma generate`
    - _Requirements: 1.2, 2.2, 6.2, 7.2, 8.1, 8.2, 9.4, 10.1, 11.1, 11.2, 13.1_
  - [x] 1.2 Pasang dan konfigurasi tooling test
    - Tambah `vitest` dan `fast-check` sebagai devDependency
    - Tambah script `test` (jalan sekali, mis. `vitest --run`) di `package.json`
    - Siapkan konfigurasi test dan helper basis data test terisolasi (rollback per iterasi) serta mock `SMTP_Sender`
    - _Requirements: 11.1, 11.2_

- [x] 2. Konfigurasi email dan SMTP_Sender
  - [x] 2.1 Implement email config (`src/lib/email/config.ts`) dan validasi env
    - Implement `getSmtpConfig()` membaca `EMAIL_HOST/PORT/USERNAME/PASSWORD/FROM/FROM_NAME`, kembalikan `null` jika kredensial wajib tidak lengkap
    - Implement `isEmailEnabled()` (SiteSetting `email_enabled` default true && config != null) dan export `APP_URL`
    - Tambah variabel `EMAIL_*` sebagai optional pada `src/lib/env.ts`
    - _Requirements: 11.4, 14.1, 14.3_
  - [ ]* 2.2 Write smoke test untuk `getSmtpConfig`
    - Verifikasi pembacaan env dan hasil `null` saat kredensial wajib tak lengkap
    - _Requirements: 11.4, 14.1_
  - [x] 2.3 Implement SMTP_Sender (`src/lib/email/smtp.ts`)
    - Adaptasi pola `scripts/test-smtp.mjs`: `node:net` + `node:tls`, EHLO → STARTTLS → upgrade TLS → AUTH LOGIN → MAIL/RCPT/DATA
    - Tegakkan koneksi terenkripsi TLS sebelum AUTH; kembalikan `{ ok, reason }` dan jangan pernah melempar
    - _Requirements: 11.5, 12.1_
  - [ ]* 2.4 Write integration/smoke test SMTP TLS
    - Verifikasi koneksi ter-upgrade ke TLS sebelum AUTH (1-2 contoh, bukan PBT)
    - _Requirements: 11.5_

- [x] 3. Template renderer i18n (`src/lib/email/templates.ts`)
  - [x] 3.1 Implement `resolveLocale` dan `renderEmail`
    - `resolveLocale`: `"en"` → `en`, selain itu → `id` (fallback default)
    - `renderEmail` untuk kind `verify | reset | reset_oauth_hint | broadcast` dalam `id` dan `en`; broadcast menyertakan `optOutUrl` pada konten
    - _Requirements: 9.3, 13.1, 13.2, 13.3_
  - [ ]* 3.2 Write property test resolusi locale
    - **Property 25: Resolusi locale total dengan default Indonesia**
    - **Validates: Requirements 13.1, 13.2, 13.3**
  - [ ]* 3.3 Write property test tautan opt-out pada broadcast
    - **Property 18: Email broadcast memuat tautan opt-out**
    - **Validates: Requirements 9.3**

- [x] 4. Email_Service orkestrasi (`src/lib/email/index.ts`)
  - [x] 4.1 Implement `deliverEmail` dengan kill switch dan redaksi log
    - Susun konten via `renderEmail`, kirim via `sendViaSmtp`, tegakkan `isEmailEnabled()` (skip SMTP → outcome `disabled`)
    - Tangkap kegagalan → outcome `failed` + log tanpa nilai token; sukses → `sent`; tidak pernah melempar
    - _Requirements: 11.3, 12.1, 12.3, 14.2, 14.3_
  - [ ]* 4.2 Write property test pengiriman non-blocking
    - **Property 22: Pengiriman email non-blocking (tidak pernah melempar)**
    - **Validates: Requirements 12.3, 14.2**
  - [ ]* 4.3 Write property test kegagalan transaksional tercatat
    - **Property 23: Kegagalan email transaksional tercatat & terlaporkan**
    - **Validates: Requirements 12.1**
  - [ ]* 4.4 Write property test kill switch
    - **Property 24: Kill switch mematikan pengiriman**
    - **Validates: Requirements 14.3**
  - [ ]* 4.5 Write property test redaksi token dari log
    - **Property 21: Redaksi token dari log**
    - **Validates: Requirements 11.3**

- [x] 5. Verification_Service (`src/lib/email/verification.ts`)
  - [x] 5.1 Implement utilitas token (`src/lib/email/tokens.ts`)
    - Generate token acak 32 byte (≥128-bit entropi) dan hitung `tokenHash` SHA-256; helper hitung rate limit DB dalam window 60 menit
    - _Requirements: 11.1, 11.2, 3.2, 6.6_
  - [x] 5.2 Implement `requestVerification`, `consumeVerification`, `isEmailVerified`
    - `requestVerification`: tolak jika sudah verified (`ALREADY_VERIFIED`); rate limit ≥3/60mnt (`RATE_LIMITED` + `retryAfterMs`); transaksi invalidasi token aktif → buat token baru TTL 24 jam → `deliverEmail("verify")`
    - `consumeVerification`: hash lookup; INVALID/EXPIRED/valid → transaksi set `emailVerified=now` + `usedAt=now`
    - `isEmailVerified`: benar iff `emailVerified` non-null (gate Req 5)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 5.1, 5.2_
  - [ ]* 5.3 Write property test invarian token aktif tunggal
    - **Property 3: Invarian token aktif tunggal**
    - **Validates: Requirements 1.4, 3.1**
  - [ ]* 5.4 Write property test user terverifikasi menolak permintaan baru
    - **Property 4: User terverifikasi menolak permintaan verifikasi baru**
    - **Validates: Requirements 1.5**
  - [ ]* 5.5 Write property test verifikasi token valid menetapkan status
    - **Property 5: Verifikasi token valid menetapkan status terverifikasi**
    - **Validates: Requirements 2.1**
  - [ ]* 5.6 Write property test gating aksi sensitif
    - **Property 9: Gating aksi sensitif oleh status verifikasi**
    - **Validates: Requirements 5.1, 5.2**

- [x] 6. Password_Reset_Service (`src/lib/email/password-reset.ts`) dan property test token lintas-service
  - [x] 6.1 Implement `requestPasswordReset` dan `setNewPassword`
    - `requestPasswordReset`: SELALU kembalikan `{ ok: true }` generik; tidak terdaftar → tak kirim; OAuth-only → kirim `reset_oauth_hint`; credentials → rate limit ≥3/60mnt (diam), selain itu transaksi invalidasi token aktif → buat baru TTL 60 menit → `deliverEmail("reset")`
    - `setNewPassword`: validasi panjang ≥8 (`WEAK_PASSWORD`); hash lookup token (INVALID/EXPIRED); valid → transaksi set `password=bcrypt(new)` + `usedAt=now`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5_
  - [ ]* 6.2 Write property test reset menyimpan hash password baru
    - **Property 10: Reset password menyimpan hash password baru**
    - **Validates: Requirements 7.1**
  - [ ]* 6.3 Write property test validasi panjang password
    - **Property 11: Validasi panjang password baru**
    - **Validates: Requirements 7.5**
  - [ ]* 6.4 Write property test respons anti-enumerasi
    - **Property 12: Respons reset password anti-enumerasi**
    - **Validates: Requirements 6.4, 6.5**
  - [ ]* 6.5 Write property test penerbitan token aman & unik (verifikasi + reset)
    - **Property 1: Penerbitan token aman & unik**
    - **Validates: Requirements 1.1, 6.1, 11.1, 11.2**
  - [ ]* 6.6 Write property test masa berlaku token (verifikasi + reset)
    - **Property 2: Masa berlaku token sesuai jenis**
    - **Validates: Requirements 1.2, 6.2**
  - [ ]* 6.7 Write property test token sekali pakai (verifikasi + reset)
    - **Property 6: Token bersifat sekali pakai**
    - **Validates: Requirements 2.2, 7.2**
  - [ ]* 6.8 Write property test klasifikasi validasi token (verifikasi + reset)
    - **Property 7: Klasifikasi validasi token**
    - **Validates: Requirements 2.3, 2.4, 7.3, 7.4**
  - [ ]* 6.9 Write property test rate limit penerbitan token (verifikasi + reset)
    - **Property 8: Rate limit penerbitan token**
    - **Validates: Requirements 3.2, 3.3, 6.6**

- [x] 7. Marketing_Service (`src/lib/email/marketing.ts`)
  - [x] 7.1 Implement `createBroadcast`, `sendBroadcast`, `optOut`, `resubscribe`
    - `createBroadcast`: non-admin → `FORBIDDEN`; subjek/isi kosong (trim) → `MISSING_FIELDS`; selain itu simpan broadcast + segmen
    - `sendBroadcast`: non-admin → `FORBIDDEN`; resolusi penerima segmen (all/subset) minus opt-out; render per penerima dengan `optOutUrl` unik; kirim + catat `sent`/`failed`+reason; ringkasan `total/sent/failed`
    - `optOut`/`resubscribe`: set/hapus `marketingOptOut` berdasar `optOutToken`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.4, 9.5, 10.1, 10.2, 10.3_
  - [ ]* 7.2 Write property test penyimpanan broadcast round-trip
    - **Property 13: Penyimpanan broadcast round-trip**
    - **Validates: Requirements 8.1**
  - [ ]* 7.3 Write property test resolusi segmen penerima
    - **Property 14: Resolusi segmen penerima**
    - **Validates: Requirements 8.2**
  - [ ]* 7.4 Write property test otorisasi broadcast berbasis peran
    - **Property 15: Otorisasi broadcast berbasis peran**
    - **Validates: Requirements 8.3**
  - [ ]* 7.5 Write property test validasi field wajib broadcast
    - **Property 16: Validasi field wajib broadcast**
    - **Validates: Requirements 8.4**
  - [ ]* 7.6 Write property test kepatuhan opt-out pada pengiriman
    - **Property 17: Kepatuhan opt-out pada pengiriman**
    - **Validates: Requirements 9.1, 9.2**
  - [ ]* 7.7 Write property test round-trip opt-out / resubscribe
    - **Property 19: Round-trip opt-out / resubscribe**
    - **Validates: Requirements 9.4, 9.5**
  - [ ]* 7.8 Write property test invarian tally pengiriman
    - **Property 20: Invarian tally pengiriman broadcast**
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [x] 8. Checkpoint - Pastikan seluruh service dan property test lulus
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Route handlers transaksional dan gate API key
  - [x] 9.1 Implement route verifikasi email
    - `POST /api/user/verify-email/request` (session) → `requestVerification`; `GET/POST /api/user/verify-email/confirm` (token) → `consumeVerification`
    - Validasi input (zod), rate limit IP kasar, bentuk respons via `api-response`, pesan i18n; HTTP 429 saat rate limited dengan durasi tunggu
    - _Requirements: 1.3, 2.1, 2.3, 2.4, 3.1, 3.2, 3.3, 12.2_
  - [x] 9.2 Implement route reset password
    - `POST /api/auth/reset-password/request` → `requestPasswordReset` (respons generik); `POST /api/auth/reset-password/confirm` (token) → `setNewPassword`
    - Petakan INVALID/EXPIRED/WEAK_PASSWORD ke pesan i18n + HTTP 400; pesan "coba lagi" saat pengiriman gagal
    - _Requirements: 6.3, 6.4, 6.5, 7.1, 7.3, 7.4, 7.5, 12.2_
  - [x] 9.3 Sisipkan gate verifikasi email pada `POST /api/user/api-key`
    - Sebelum generate/regenerate: jika `!isEmailVerified(userId)` → `apiError` HTTP 403 dengan pesan verifikasi diperlukan + petunjuk memulai verifikasi
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ]* 9.4 Write unit test route transaksional dan alur non-blocking
    - Pesan gate API key memuat petunjuk verifikasi (5.3); route mengembalikan "coba lagi" saat `deliverEmail` gagal (12.2); user unverified tetap dapat memanggil endpoint beli/deposit tanpa terblok gate email
    - _Requirements: 4.1, 4.2, 4.3, 5.3, 12.2, 14.2_

- [x] 10. Route handlers broadcast dan opt-out
  - [x] 10.1 Implement route pembuatan/daftar broadcast
    - `GET/POST /api/admin/broadcast` (admin via `requireAdmin`) → `createBroadcast`; validasi subjek/isi (zod)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 10.2 Implement route pengiriman broadcast
    - `POST /api/admin/broadcast/[id]/send` (admin) → `sendBroadcast`; kembalikan ringkasan `total/sent/failed`
    - _Requirements: 9.1, 9.2, 9.3, 10.1, 10.2, 10.3_
  - [x] 10.3 Implement route opt-out dan resubscribe
    - `GET /api/email/opt-out` (token) → `optOut`; `GET /api/email/resubscribe` (token) → `resubscribe`
    - _Requirements: 9.4, 9.5_
  - [ ]* 10.4 Write unit/integration test route broadcast dan opt-out
    - Non-admin ditolak FORBIDDEN; email OAuth-only memakai varian OAuth-hint (6.5 sisi konten); rendered verify/reset memuat tautan bertoken (1.3, 6.3 sisi konten)
    - _Requirements: 6.5, 8.3, 9.4, 9.5_

- [x] 11. Checkpoint akhir - Pastikan seluruh test lulus
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks bertanda `*` bersifat opsional (test) dan dapat dilewati untuk MVP lebih cepat; tugas inti implementasi tidak pernah opsional.
- Property test menggunakan `fast-check` (min. 100 iterasi/properti) dengan mock `SMTP_Sender` dan basis data test terisolasi; jalankan sekali (`--run`), bukan mode watch.
- Setiap Property 1–25 di design dipetakan ke tepat satu property test; properti token lintas-service (1, 2, 6, 7, 8) menguji token verifikasi maupun reset.
- Setiap task merujuk klausa requirement spesifik untuk keterlacakan; checkpoint memastikan validasi bertahap.
- Tidak menambah dependency runtime baru untuk SMTP (memakai `node:net`/`node:tls` sesuai pola `scripts/test-smtp.mjs`).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.3", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.4", "3.2", "3.3", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "4.5", "5.1"] },
    { "id": 4, "tasks": ["5.2"] },
    { "id": 5, "tasks": ["5.3", "5.4", "5.5", "5.6", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "9.1", "9.2", "9.3"] },
    { "id": 8, "tasks": ["9.4", "10.1", "10.2", "10.3"] },
    { "id": 9, "tasks": ["10.4"] }
  ]
}
```
