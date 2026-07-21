# Design Document — Email Service

> Fitur: **email-service** (KirimKode). Workflow: requirements-first.
> Basis: `requirements.md` pada folder spec yang sama.
> Stack: Next.js 16 (App Router) + React 19 + TypeScript + Prisma 7 + PostgreSQL + NextAuth v5, PM2 cluster (4 instance).

## Overview

Fitur Email Service menambahkan tiga kemampuan email ke KirimKode di atas SMTP standar yang bersifat provider-agnostic:

1. **Verifikasi email** — opsional dan non-blocking; hanya diwajibkan sebelum aksi sensitif (generate/regenerate API key).
2. **Reset password via email** — hanya relevan untuk `Credentials_User` (punya password), aman terhadap enumerasi akun.
3. **Broadcast marketing** — dibuat & dikirim admin, patuh opt-out, dengan pelacakan pengiriman dasar.

Prinsip desain utama, diturunkan langsung dari requirements:

- **Non-blocking (Req 4, 12, 14):** kegagalan atau ketidaktersediaan SMTP tidak boleh mengganggu alur beli nomor, deposit, dan otentikasi. Semua pengiriman email diperlakukan sebagai efek samping yang boleh gagal secara anggun.
- **Provider-agnostic via ENV (Req 11.4, 14.1):** host/port/kredensial/pengirim SMTP dibaca dari environment variable, tidak di-hardcode. Mengganti penyedia SMTP tidak mengubah kode.
- **Keamanan token (Req 11.1–11.3):** token acak ≥128-bit, sekali pakai, kedaluwarsa, dan nilainya tidak pernah masuk log. Token disimpan sebagai hash di database.
- **Kill switch (Req 14.3):** satu flag konfigurasi dapat menonaktifkan pengiriman email tanpa memengaruhi alur bisnis inti.

Desain sengaja menghindari penambahan dependency baru: SMTP_Sender dibangun ulang dari pola yang **sudah terbukti bekerja** di `scripts/test-smtp.mjs` (STARTTLS pada port 587 + AUTH LOGIN, memakai `node:net` dan `node:tls`). Ini menjaga konsistensi dengan filosofi codebase yang minim dependency (lihat `package.json` — tidak ada `nodemailer`).

### Riset & Temuan yang Menginformasikan Desain

- **SMTP flow terbukti:** `scripts/test-smtp.mjs` sudah memvalidasi jalur STARTTLS + `AUTH LOGIN` terhadap penyedia terkonfigurasi (ZeptoMail) memakai env `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `EMAIL_FROM_NAME`. Desain **mengadopsi nama env yang sama** agar tidak ada duplikasi konfigurasi. STARTTLS meng-upgrade koneksi plaintext ke TLS, memenuhi Req 11.5.
- **Rate limit di lingkungan cluster:** `src/lib/rate-limit.ts` berbasis `Map` in-memory per-proses. Dengan PM2 cluster 4 instance (lihat `PROJECT-INFO.md`), hitungan in-memory **tidak konsisten antar-instance**. Karena Req 3.2 dan Req 6.6 (maks 3 permintaan / 60 menit) bersifat security-sensitive, rate limit email harus **berbasis database** (menghitung token yang dibuat dalam window), bukan in-memory. Rate limit in-memory tetap dipakai sebagai lapis pelindung IP kasar pada endpoint (pola `checkRouteRateLimit`).
- **Model `User` sudah punya `emailVerified DateTime?`** (schema.prisma) → dipakai apa adanya untuk status `Verified_User`. Tidak ada field `locale`/opt-out marketing → perlu ditambah.
- **`VerificationToken` bawaan NextAuth** (identifier/token/expires) tidak punya penanda "terpakai" dan dipakai adapter Auth. Untuk kebutuhan sekali-pakai + invalidasi + hash, desain memakai **model token khusus** terpisah, tidak mendaur ulang tabel NextAuth.
- **Titik integrasi gating** ada di `src/app/api/user/api-key/route.ts` (POST generate/regenerate). Gate verifikasi email disisipkan di sini (Req 5).
- **Konvensi respons** memakai helper `src/lib/api-response.ts` (`apiSuccess`/`apiError`/`apiMessage`) untuk endpoint, `requireAdmin()` (`src/lib/admin.ts`) untuk gating admin, `logAction()` (`src/lib/audit.ts`) untuk audit, dan i18n `src/lib/i18n/{id,en}.ts`.

## Architecture

### Posisi dalam sistem

```mermaid
flowchart TD
  subgraph Client
    UI[Halaman Next.js: verify, reset, admin broadcast, opt-out]
  end

  subgraph API[Route Handlers /api]
    RV[/api/user/verify-email/*]
    RR[/api/auth/reset-password/*]
    RK[/api/user/api-key POST]
    RB[/api/admin/broadcast/*]
    RO[/api/email/opt-out, /api/email/resubscribe]
  end

  subgraph Services[src/lib/email/*]
    VS[Verification_Service]
    PRS[Password_Reset_Service]
    MS[Marketing_Service]
    ES[Email_Service<br/>compose + orchestrate]
    TPL[Template renderer i18n]
    SMTP[SMTP_Sender<br/>net/tls STARTTLS]
    CFG[email config + kill switch]
  end

  DB[(PostgreSQL via Prisma)]
  MAIL[(SMTP Provider)]

  UI --> API
  RV --> VS
  RR --> PRS
  RK --> VS
  RB --> MS
  RO --> MS
  VS --> ES
  PRS --> ES
  MS --> ES
  ES --> TPL
  ES --> SMTP
  ES --> CFG
  VS --> DB
  PRS --> DB
  MS --> DB
  SMTP --> MAIL
```

### Layering & tanggung jawab

- **Route handlers** (`src/app/api/...`): otentikasi (session/`requireAdmin`), validasi input (zod), rate limit IP kasar, panggil service, bentuk respons via `api-response`. Tidak memuat logika email.
- **Service layer** (`src/lib/email/`): logika murni + orkestrasi DB. Ini lapisan yang menjadi target property-based testing.
  - `Verification_Service` — terbit/validasi `Verification_Token`, set `emailVerified`, rate limit DB.
  - `Password_Reset_Service` — terbit/validasi `Reset_Token`, set password baru (bcrypt), respons generik anti-enumerasi, rate limit DB.
  - `Marketing_Service` — CRUD broadcast, targeting segmen, filter opt-out, kirim + tally, opt-out/resubscribe.
  - `Email_Service` — menyusun konten (delegasi ke template renderer i18n), memanggil SMTP_Sender, menegakkan kill switch, redaksi log.
  - `SMTP_Sender` — adapter koneksi SMTP (STARTTLS+TLS+AUTH), satu-satunya yang menyentuh jaringan email.
- **Data layer**: Prisma models baru + penambahan field pada `User`.

### Keputusan desain kunci

1. **Token disimpan sebagai hash (SHA-256), bukan plaintext.** Nilai token acak dikirim ke user via email; database hanya menyimpan `tokenHash`. Lookup dilakukan dengan hashing token yang masuk lalu mencari `tokenHash`. Ini membatasi dampak kebocoran DB dan mendukung Req 11.3 (token tidak muncul di penyimpanan/log).
2. **Rate limit berbasis DB (bukan in-memory).** Menghitung jumlah token milik user yang `createdAt` dalam window 60 menit. Konsisten di seluruh instance PM2. Sisa waktu tunggu = `oldestInWindow.createdAt + window − now` (Req 3.3).
3. **Invalidasi token lama** dilakukan dengan menandai semua token aktif user sebagai terpakai/expired (`usedAt = now`) tepat sebelum menerbitkan token baru (Req 1.4). Membuat token baru dan invalidasi lama dijalankan dalam satu transaksi Prisma.
4. **Respons generik anti-enumerasi** untuk reset password: service selalu mengembalikan hasil sukses yang identik untuk email tidak terdaftar, terdaftar, maupun OAuth-only (Req 6.4, 6.5). Perbedaan hanya pada email yang dikirim (atau tidak) — tidak tercermin pada respons HTTP.
5. **Pengiriman email adalah best-effort & non-blocking.** `Email_Service.send()` menangkap error, mencatatnya (tanpa token), dan mengembalikan status `{ ok: false, reason }` alih-alih melempar ke alur inti (Req 12). Untuk email transaksional, service memetakan kegagalan ke pesan "coba lagi" bagi user (Req 12.2).
6. **Kill switch** `email_enabled` (SiteSetting) + validitas konfigurasi SMTP. Jika email dimatikan, `SMTP_Sender` di-skip dan `Email_Service.send()` mengembalikan status non-error yang menandai "disabled" (Req 14.3).

## Components and Interfaces

Semua tipe di bawah adalah TypeScript, ditempatkan di `src/lib/email/`.

### Config — `src/lib/email/config.ts`

```ts
export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;       // alamat pengirim
  fromName: string;   // display name
}

// Membaca dari env: EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME, EMAIL_PASSWORD, EMAIL_FROM, EMAIL_FROM_NAME
export function getSmtpConfig(): SmtpConfig | null; // null jika kredensial wajib tidak lengkap
export function isEmailEnabled(): Promise<boolean>; // SiteSetting `email_enabled` (default true) && getSmtpConfig() != null
export const APP_URL: string; // NEXT_PUBLIC_APP_URL, untuk menyusun tautan verifikasi/reset/opt-out
```

### SMTP_Sender — `src/lib/email/smtp.ts`

Adaptasi dari `scripts/test-smtp.mjs` (STARTTLS + AUTH LOGIN) memakai `node:net` + `node:tls`.

```ts
export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  ok: boolean;
  reason?: string; // pesan kegagalan untuk log (bukan untuk user mentah)
}

export async function sendViaSmtp(email: OutgoingEmail, cfg: SmtpConfig): Promise<SendResult>;
```

- Membuka koneksi ke `host:port`, `EHLO`, `STARTTLS`, upgrade TLS (`tls.connect`), `AUTH LOGIN`, `MAIL FROM`/`RCPT TO`/`DATA`.
- Menegakkan Req 11.5: koneksi harus terenkripsi TLS sebelum `AUTH`.
- Semua error koneksi/protokol dikembalikan sebagai `{ ok: false, reason }` — tidak melempar.

### Template renderer — `src/lib/email/templates.ts`

```ts
export type Locale = "id" | "en";
export type EmailKind =
  | "verify" | "reset" | "reset_oauth_hint" | "broadcast";

export interface RenderedEmail { subject: string; html: string; text: string; }

export function resolveLocale(input?: string | null): Locale; // Req 13.3: fallback "id"
export function renderEmail(
  kind: EmailKind,
  locale: Locale,
  vars: Record<string, string>
): RenderedEmail;
```

- `resolveLocale`: `"en"` → `en`; `"id"` → `id`; nilai lain/null/undefined → `id` (Req 13).
- Broadcast selalu menyertakan tautan opt-out pada `vars.optOutUrl` (Req 9.3).

### Email_Service — `src/lib/email/index.ts`

```ts
export interface DeliveryOutcome { status: "sent" | "failed" | "disabled"; reason?: string; }

// Menyusun konten (renderEmail) + kirim (sendViaSmtp) + kill switch + redaksi log.
export async function deliverEmail(params: {
  to: string;
  kind: EmailKind;
  locale: Locale;
  vars: Record<string, string>;
}): Promise<DeliveryOutcome>;
```

- Jika `isEmailEnabled()` false → kembalikan `{ status: "disabled" }` tanpa menyentuh jaringan (Req 14.3).
- Sukses → `{ status: "sent" }`; gagal → catat log kegagalan **tanpa nilai token** (Req 11.3, 12.1) dan kembalikan `{ status: "failed", reason }`.

### Verification_Service — `src/lib/email/verification.ts`

```ts
export type VerifyRequestResult =
  | { ok: true }
  | { ok: false; code: "ALREADY_VERIFIED" | "RATE_LIMITED"; retryAfterMs?: number };

export type VerifyConsumeResult =
  | { ok: true }
  | { ok: false; code: "EXPIRED" | "INVALID" };

// Req 1, 3: terbitkan token (invalidasi lama), rate limit DB, kirim email.
export async function requestVerification(userId: string): Promise<VerifyRequestResult>;

// Req 2: konsumsi token → set emailVerified, tandai token terpakai.
export async function consumeVerification(rawToken: string): Promise<VerifyConsumeResult>;

// Req 5: gate untuk aksi sensitif.
export async function isEmailVerified(userId: string): Promise<boolean>;
```

Aturan:
- `requestVerification`: jika user sudah `Verified_User` → `ALREADY_VERIFIED` (Req 1.5). Jika ≥3 token dalam 60 menit → `RATE_LIMITED` + `retryAfterMs` (Req 3.2, 3.3). Selain itu: transaksi { invalidasi token aktif (Req 1.4) → buat token baru TTL 24 jam (Req 1.2, 11.1) } lalu `deliverEmail("verify")` (Req 1.3).
- `consumeVerification`: hash token → cari. Tidak ada/terpakai → `INVALID` (Req 2.4). Kedaluwarsa → `EXPIRED` (Req 2.3). Valid → transaksi { set `emailVerified = now` (Req 2.1) + `usedAt = now` (Req 2.2) }.

### Password_Reset_Service — `src/lib/email/password-reset.ts`

```ts
// Req 6: SELALU kembalikan bentuk sukses generik (anti-enumerasi). Tidak ada varian error yang membocorkan.
export async function requestPasswordReset(email: string): Promise<{ ok: true }>;

export type SetPasswordResult =
  | { ok: true }
  | { ok: false; code: "EXPIRED" | "INVALID" | "WEAK_PASSWORD" };

// Req 7: set password baru dari reset token.
export async function setNewPassword(rawToken: string, newPassword: string): Promise<SetPasswordResult>;
```

Aturan:
- `requestPasswordReset`: cari user by email.
  - Tidak terdaftar → tidak kirim apa-apa, kembalikan `{ ok: true }` (Req 6.4).
  - OAuth-only (`password == null`) → kirim email "login via OAuth", kembalikan `{ ok: true }` (Req 6.5).
  - Credentials → jika ≥3 reset dalam 60 menit, diam-diam berhenti tetapi tetap `{ ok: true }` (Req 6.6); selain itu transaksi { invalidasi reset token aktif → buat baru TTL 60 menit (Req 6.2, 11.2) } + `deliverEmail("reset")` (Req 6.3).
- `setNewPassword`: validasi panjang ≥8 (Req 7.5, cek sebelum menyentuh token agar pesan syarat konsisten). Hash lookup token: tidak ada/terpakai → `INVALID` (Req 7.4); kedaluwarsa → `EXPIRED` (Req 7.3); valid → transaksi { `password = bcrypt(new)` (Req 7.1) + `usedAt = now` (Req 7.2) }.

### Marketing_Service — `src/lib/email/marketing.ts`

```ts
export type Segment = { type: "all" } | { type: "subset"; userIds: string[] };

export type CreateBroadcastResult =
  | { ok: true; broadcastId: string }
  | { ok: false; code: "FORBIDDEN" | "MISSING_FIELDS" };

export async function createBroadcast(actor: { id: string; role: string }, input: {
  subject: string; body: string; segment: Segment;
}): Promise<CreateBroadcastResult>;

export interface SendSummary { total: number; sent: number; failed: number; }
export type SendBroadcastResult =
  | { ok: true; summary: SendSummary }
  | { ok: false; code: "FORBIDDEN" | "NOT_FOUND" };

export async function sendBroadcast(actor: { id: string; role: string }, broadcastId: string): Promise<SendBroadcastResult>;

// Opt-out lewat token pada tautan email (tanpa perlu login).
export async function optOut(rawOptOutToken: string): Promise<{ ok: boolean }>;
export async function resubscribe(rawOptOutToken: string): Promise<{ ok: boolean }>;
```

Aturan:
- `createBroadcast`: non-admin → `FORBIDDEN` (Req 8.3). Subjek/isi kosong (setelah trim) → `MISSING_FIELDS` (Req 8.4). Selain itu simpan broadcast + segmen (Req 8.1, 8.2).
- `sendBroadcast`: non-admin → `FORBIDDEN`. Resolusi penerima dari segmen, **kecualikan opt-out** (Req 9.1, 9.2). Untuk tiap penerima: render broadcast dengan `optOutUrl` unik (Req 9.3), kirim, catat `sent`/`failed` + reason (Req 10.1, 10.2). Kembalikan ringkasan `total/sent/failed` dengan invarian `sent + failed = total` (Req 10.3).
- `optOut`/`resubscribe`: set/hapus status opt-out user berdasarkan token opt-out stabil (Req 9.4, 9.5).

### Route handlers (ringkas)

| Route | Method | Service | Requirement |
|-------|--------|---------|-------------|
| `/api/user/verify-email/request` | POST (session) | `requestVerification` | 1, 3 |
| `/api/user/verify-email/confirm` | GET/POST (token) | `consumeVerification` | 2 |
| `/api/auth/reset-password/request` | POST | `requestPasswordReset` | 6 |
| `/api/auth/reset-password/confirm` | POST (token) | `setNewPassword` | 7 |
| `/api/user/api-key` | POST (session) | `isEmailVerified` gate → generate | 5 |
| `/api/admin/broadcast` | GET/POST (admin) | `createBroadcast` | 8 |
| `/api/admin/broadcast/[id]/send` | POST (admin) | `sendBroadcast` | 9, 10 |
| `/api/email/opt-out` | GET (token) | `optOut` | 9.4 |
| `/api/email/resubscribe` | GET (token) | `resubscribe` | 9.5 |

Gate API key (Req 5) disisipkan di `src/app/api/user/api-key/route.ts`, sebelum generate: jika `!isEmailVerified(userId)` → `apiError` dengan pesan "verifikasi email diperlukan" + petunjuk memulai verifikasi (Req 5.2, 5.3).

## Data Models

### Perubahan pada model `User` (schema.prisma)

```prisma
model User {
  // ... field existing ...
  locale            String    @default("id") // Req 13: preferensi bahasa email: "id" | "en"
  marketingOptOut   Boolean   @default(false) // Req 9: status Opt_Out marketing
  optOutToken       String?   @unique          // token stabil untuk tautan opt-out/resubscribe

  emailVerificationTokens EmailVerificationToken[]
  passwordResetTokens     PasswordResetToken[]
  broadcasts              Broadcast[]           // broadcast yang dibuat (admin)
  broadcastRecipients     BroadcastRecipient[]
}
```

> `emailVerified DateTime?` sudah ada dan dipakai apa adanya sebagai penanda `Verified_User`.

### Token verifikasi

```prisma
model EmailVerificationToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique          // SHA-256 dari token acak 32 byte (≥128-bit entropi, Req 11.1)
  expiresAt DateTime                   // createdAt + 24 jam (Req 1.2)
  usedAt    DateTime?                  // non-null = terpakai/di-invalidasi (Req 2.2, 1.4)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, usedAt])           // untuk hitung rate limit & invalidasi cepat
  @@index([expiresAt])
  @@map("email_verification_tokens")
}
```

### Token reset password

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique          // SHA-256 dari token acak 32 byte (≥128-bit entropi, Req 11.2)
  expiresAt DateTime                   // createdAt + 60 menit (Req 6.2)
  usedAt    DateTime?                  // non-null = terpakai/di-invalidasi (Req 7.2, 6.x)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, usedAt])
  @@index([expiresAt])
  @@map("password_reset_tokens")
}
```

### Broadcast marketing

```prisma
model Broadcast {
  id          String   @id @default(cuid())
  subject     String                        // wajib non-kosong (Req 8.4)
  body        String                        // wajib non-kosong (Req 8.4)
  segmentType String   @default("all")      // "all" | "subset" (Req 8.2)
  segmentData String   @default("")         // JSON userIds untuk subset
  status      String   @default("draft")    // draft | sending | sent
  createdBy   String                        // userId admin (Req 8.1)
  totalCount  Int      @default(0)          // ringkasan (Req 10.3)
  sentCount   Int      @default(0)
  failedCount Int      @default(0)
  createdAt   DateTime @default(now())
  sentAt      DateTime?

  creator    User                 @relation(fields: [createdBy], references: [id], onDelete: Cascade)
  recipients BroadcastRecipient[]

  @@index([status])
  @@index([createdAt])
  @@map("broadcasts")
}

model BroadcastRecipient {
  id          String   @id @default(cuid())
  broadcastId String
  userId      String
  email       String                        // snapshot alamat saat kirim
  status      String   @default("pending")  // pending | sent | failed (Req 10.1)
  failReason  String?                        // alasan gagal (Req 10.2)
  sentAt      DateTime?
  createdAt   DateTime @default(now())

  broadcast Broadcast @relation(fields: [broadcastId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([broadcastId, userId])
  @@index([broadcastId])
  @@index([broadcastId, status])
  @@map("broadcast_recipients")
}
```

### Konfigurasi (SiteSetting, tabel existing)

| Key | Nilai | Tujuan |
|-----|-------|--------|
| `email_enabled` | `"true"`/`"false"` (default true) | Kill switch pengiriman email (Req 14.3) |

### Environment variables (baru, konsisten dengan `scripts/test-smtp.mjs`)

| Var | Keterangan |
|-----|-----------|
| `EMAIL_HOST` | Host SMTP |
| `EMAIL_PORT` | Port SMTP (587 STARTTLS) |
| `EMAIL_USERNAME` | Username SMTP |
| `EMAIL_PASSWORD` | Password/API key SMTP |
| `EMAIL_FROM` | Alamat pengirim |
| `EMAIL_FROM_NAME` | Display name pengirim |

Ditambahkan ke skema validasi `src/lib/env.ts` sebagai optional (agar app tetap jalan tanpa email — Req 12.3, 14.2).

## Correctness Properties

*Sebuah properti adalah karakteristik atau perilaku yang harus selalu benar untuk semua eksekusi valid dari sistem — pada dasarnya pernyataan formal tentang apa yang harus dilakukan sistem. Properti menjembatani spesifikasi yang dapat dibaca manusia dengan jaminan kebenaran yang dapat diverifikasi mesin.*

Properti berikut adalah hasil analisis prework dan sudah melalui refleksi untuk menghapus redundansi. Logika layer service (`src/lib/email/*`) diuji dengan generator acak dan mock SMTP; tidak ada jaringan/SMTP nyata dalam property test.

### Property 1: Penerbitan token aman & unik

*Untuk setiap* urutan penerbitan token (verifikasi maupun reset), setiap token yang dibuat berasal dari entropi ≥128-bit dan `tokenHash`-nya unik di seluruh token yang pernah dibuat.

**Validates: Requirements 1.1, 6.1, 11.1, 11.2**

### Property 2: Masa berlaku token sesuai jenis

*Untuk setiap* token verifikasi, `expiresAt − createdAt` sama dengan 24 jam; *untuk setiap* token reset, `expiresAt − createdAt` sama dengan 60 menit.

**Validates: Requirements 1.2, 6.2**

### Property 3: Invarian token aktif tunggal

*Untuk setiap* user dan sembarang jumlah token aktif yang dimilikinya, setelah menerbitkan token baru (termasuk kirim ulang), jumlah token aktif (belum `usedAt`, belum kedaluwarsa) tepat satu, dan semua token sebelumnya bertanda terpakai.

**Validates: Requirements 1.4, 3.1**

### Property 4: User terverifikasi menolak permintaan verifikasi baru

*Untuk setiap* user yang sudah berstatus `Verified_User`, `requestVerification` mengembalikan `ALREADY_VERIFIED` dan tidak menambah jumlah token.

**Validates: Requirements 1.5**

### Property 5: Verifikasi token valid menetapkan status terverifikasi

*Untuk setiap* user dengan token verifikasi valid & belum kedaluwarsa, `consumeVerification` menetapkan `emailVerified` menjadi non-null.

**Validates: Requirements 2.1**

### Property 6: Token bersifat sekali pakai

*Untuk setiap* token valid (verifikasi maupun reset), operasi konsumsi pertama berhasil dan operasi konsumsi kedua dengan token yang sama ditolak sebagai `INVALID`.

**Validates: Requirements 2.2, 7.2**

### Property 7: Klasifikasi validasi token

*Untuk setiap* token yang diberikan ke operasi konsumsi (verifikasi atau reset): jika `expiresAt` di masa lalu maka hasilnya `EXPIRED`; jika token tidak ditemukan atau sudah terpakai maka hasilnya `INVALID`.

**Validates: Requirements 2.3, 2.4, 7.3, 7.4**

### Property 8: Rate limit penerbitan token

*Untuk setiap* user, setelah 3 penerbitan token dalam window 60 menit, penerbitan berikutnya ditolak karena rate limit; ketika ditolak, sisa waktu tunggu yang dilaporkan berada dalam rentang (0, 60 menit]; setelah window berlalu penerbitan kembali diizinkan.

**Validates: Requirements 3.2, 3.3, 6.6**

### Property 9: Gating aksi sensitif oleh status verifikasi

*Untuk setiap* user, izin melakukan generate/regenerate API key bernilai benar jika dan hanya jika `emailVerified` non-null.

**Validates: Requirements 5.1, 5.2**

### Property 10: Reset password menyimpan hash password baru

*Untuk setiap* token reset valid & belum kedaluwarsa dan password baru yang memenuhi syarat, setelah `setNewPassword` maka `bcrypt.compare(passwordBaru, user.password)` bernilai benar.

**Validates: Requirements 7.1**

### Property 11: Validasi panjang password baru

*Untuk setiap* string password, `setNewPassword` menolak dengan `WEAK_PASSWORD` jika dan hanya jika panjang password kurang dari 8 karakter.

**Validates: Requirements 7.5**

### Property 12: Respons reset password anti-enumerasi

*Untuk setiap* alamat email — terdaftar, tidak terdaftar, maupun milik `OAuth_Only_User` — `requestPasswordReset` mengembalikan bentuk respons sukses yang identik, sehingga keberadaan akun tidak dapat disimpulkan dari respons.

**Validates: Requirements 6.4, 6.5**

### Property 13: Penyimpanan broadcast round-trip

*Untuk setiap* input broadcast valid yang dibuat admin, broadcast tersimpan dan ketika dibaca kembali memiliki subjek, isi, dan definisi segmen yang identik dengan input.

**Validates: Requirements 8.1**

### Property 14: Resolusi segmen penerima

*Untuk setiap* populasi user dan definisi segmen, himpunan penerima yang diselesaikan sama persis dengan seluruh user untuk segmen `all`, atau tepat irisan `userIds` dengan user valid untuk segmen `subset`.

**Validates: Requirements 8.2**

### Property 15: Otorisasi broadcast berbasis peran

*Untuk setiap* aktor, operasi membuat atau mengirim broadcast diizinkan jika dan hanya jika `role` aktor adalah `admin`; selain itu ditolak dengan `FORBIDDEN`.

**Validates: Requirements 8.3**

### Property 16: Validasi field wajib broadcast

*Untuk setiap* input broadcast, penyimpanan ditolak dengan `MISSING_FIELDS` jika dan hanya jika subjek kosong (setelah trim) atau isi kosong (setelah trim).

**Validates: Requirements 8.4**

### Property 17: Kepatuhan opt-out pada pengiriman

*Untuk setiap* populasi user dan segmen, tidak ada penerima berstatus `Opt_Out` yang menerima email broadcast; himpunan penerima aktual sama dengan penerima segmen dikurangi penerima opt-out.

**Validates: Requirements 9.1, 9.2**

### Property 18: Email broadcast memuat tautan opt-out

*Untuk setiap* email broadcast yang tersusun, konten HTML memuat tautan opt-out.

**Validates: Requirements 9.3**

### Property 19: Round-trip opt-out / resubscribe

*Untuk setiap* user, memanggil opt-out lalu resubscribe mengembalikan status marketing user ke keadaan tidak opt-out; sebaliknya opt-out menetapkan status menjadi opt-out.

**Validates: Requirements 9.4, 9.5**

### Property 20: Invarian tally pengiriman broadcast

*Untuk setiap* populasi user dan hasil pengiriman SMTP acak (mock), pada penyelesaian pengiriman setiap penerima berstatus `sent` atau `failed` (tidak ada `pending` tersisa), setiap `failed` memiliki alasan non-kosong, dan ringkasan memenuhi `sent + failed = total` dengan `total` sama dengan jumlah penerima non-opt-out.

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 21: Redaksi token dari log

*Untuk setiap* nilai token dan kejadian pencatatan aktivitas pengiriman, keluaran log tidak memuat nilai token mentah.

**Validates: Requirements 11.3**

### Property 22: Pengiriman email non-blocking (tidak pernah melempar)

*Untuk setiap* input dan kondisi SMTP (termasuk error/timeout yang di-mock), `deliverEmail` selalu selesai dengan sebuah outcome (`sent` | `failed` | `disabled`) dan tidak pernah melempar exception ke pemanggil.

**Validates: Requirements 12.3, 14.2**

### Property 23: Kegagalan email transaksional tercatat & terlaporkan

*Untuk setiap* kondisi kegagalan SMTP (mock), `deliverEmail` mengembalikan outcome `failed` dengan alasan non-kosong dan mencatat kegagalan tersebut.

**Validates: Requirements 12.1**

### Property 24: Kill switch mematikan pengiriman

*Untuk setiap* input, ketika email dinonaktifkan melalui konfigurasi, `deliverEmail` mengembalikan outcome `disabled`, tidak memanggil SMTP_Sender, dan tidak melempar exception.

**Validates: Requirements 14.3**

### Property 25: Resolusi locale total dengan default Indonesia

*Untuk setiap* nilai input locale (string apa pun, null, atau undefined), `resolveLocale` mengembalikan `en` jika dan hanya jika input tepat `"en"`, dan mengembalikan `id` untuk semua kasus lain.

**Validates: Requirements 13.1, 13.2, 13.3**

## Error Handling

Prinsip: kegagalan email tidak boleh merambat ke alur inti (Req 12, 14).

- **Kegagalan SMTP (koneksi/protokol/timeout).** `SMTP_Sender` menangkap semua error dan mengembalikan `{ ok: false, reason }`. `Email_Service.deliverEmail` mengubahnya menjadi outcome `failed`, mencatat log (tanpa token, Req 11.3), lalu mengembalikan outcome ke pemanggil — tidak melempar (Property 22, 23).
- **Email transaksional gagal (verifikasi/reset).** Route handler menerima outcome `failed` dan mengembalikan pesan i18n "coba lagi beberapa saat" kepada user (Req 12.2). Token tetap tersimpan sehingga user dapat mencoba kirim ulang.
- **SMTP tak terjangkau.** Karena pengiriman non-blocking dan dipanggil terpisah dari alur beli/deposit, ketidaktersediaan SMTP tidak memengaruhi transaksi inti (Req 12.3, Property 22).
- **Email dinonaktifkan (kill switch).** `deliverEmail` mengembalikan outcome `disabled`; endpoint tetap merespons sukses untuk aksi non-email dan tidak menganggapnya error (Req 14.3, Property 24).
- **Token tidak valid/kedaluwarsa/terpakai.** Service mengembalikan kode error terklasifikasi (`INVALID`/`EXPIRED`/`WEAK_PASSWORD`); route memetakan ke pesan i18n dan status HTTP yang sesuai (400) via `apiError`. Tidak membocorkan apakah token pernah ada.
- **Rate limit terlampaui.** Service mengembalikan `RATE_LIMITED` + `retryAfterMs`; route mengembalikan HTTP 429 dengan pesan durasi tunggu (Req 3.2, 3.3). Untuk reset password, penolakan rate limit tetap dibungkus respons generik agar tidak membocorkan keberadaan akun (Req 6.4, 6.6).
- **Otorisasi.** Non-admin pada endpoint broadcast → `FORBIDDEN` (HTTP 403) via `requireAdmin` + cek service. Aksi API key tanpa verifikasi email → HTTP 403 dengan petunjuk verifikasi (Req 5.2, 5.3).
- **Input tidak valid.** Divalidasi dengan zod di route (mis. subjek/isi kosong, format email); pesan i18n dikembalikan via `apiError`.
- **Audit non-fatal.** Pencatatan log/audit dibungkus try/catch (pola `logAction`) agar kegagalan logging tidak pernah menghentikan alur.

## Testing Strategy

Pendekatan ganda: property-based test untuk logika universal + unit/integration test untuk contoh, konfigurasi, dan integrasi eksternal.

### Property-Based Testing (berlaku untuk feature ini)

Layer service (`src/lib/email/*`) sebagian besar berupa logika yang dapat diuji sebagai properti universal (token, rate limit, validasi, filter opt-out, tally, resolusi locale). Karena itu PBT diterapkan pada layer service dengan basis data test terisolasi (transaksi rollback per iterasi atau schema in-memory) dan **mock** untuk `SMTP_Sender` (menghindari biaya jaringan dan mengontrol sukses/gagal).

- **Library**: `fast-check` (ekosistem TypeScript/Node), dipasang sebagai devDependency. Tidak mengimplementasikan PBT dari nol.
- **Test runner**: `node:test` (built-in) atau `vitest`; jalankan sekali (`--run`, tanpa watch).
- **Iterasi**: minimum 100 iterasi per properti (konfigurasi `fc.assert(..., { numRuns: 100 })`).
- **Tag tiap test** merujuk properti desain, format:
  `// Feature: email-service, Property {number}: {property_text}`
- **Pemetaan**: setiap Property 1–25 di atas diimplementasikan oleh **satu** property test.
- **Generator kunci**: user acak (verified/unverified, credentials/OAuth-only, opt-out/tidak, locale bervariasi termasuk nilai tak dikenal), string password sembarang panjang, waktu pembuatan acak (untuk expiry), definisi segmen acak, dan hasil SMTP mock acak (peta penerima→sukses/gagal) untuk properti tally.
- **Edge case yang wajib tercakup generator**: string kosong/whitespace (subjek/isi/password), locale non-`id`/`en`/null/undefined, token acak yang tak ada di DB, token kedaluwarsa, populasi user kosong, segmen subset dengan userId tak valid.

### Unit / Example Tests

- Konten pesan penolakan gate API key memuat petunjuk verifikasi (Req 5.3).
- Email reset untuk OAuth-only adalah varian OAuth-hint (Req 6.5, konten).
- Route verifikasi/reset mengembalikan pesan "coba lagi" saat `deliverEmail` gagal (Req 12.2).
- Rendered verify/reset email memuat tautan dengan token (Req 1.3, 6.3 sisi konten).
- Alur non-blocking (Req 4.1–4.3, 14.2): user unverified tetap dapat memanggil endpoint beli/deposit tanpa terblok gate email (contoh representatif).

### Integration / Smoke Tests

- **SMTP TLS (Req 11.5)**: uji integrasi 1–2 contoh memakai pola `scripts/test-smtp.mjs` untuk memastikan koneksi ter-upgrade ke TLS sebelum `AUTH`. Bukan PBT.
- **Konfigurasi env (Req 11.4, 14.1)**: smoke test tunggal bahwa `getSmtpConfig()` membaca `EMAIL_*` dari env dan mengembalikan `null` jika kredensial wajib tidak lengkap.
- **Migrasi Prisma**: verifikasi model baru ter-migrate (build menjalankan `prisma generate`).

### Menjalankan test

Karena belum ada test runner terpasang, tahap implementasi akan menambahkan `fast-check` + `vitest` (atau `node:test`) sebagai devDependency dan script `test`. Jalankan sekali tanpa watch (mis. `npx vitest --run`), bukan mode watch, agar tidak memblokir proses.
