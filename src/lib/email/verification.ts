// Verification_Service — penerbitan & validasi token verifikasi email
// (email-service, Req 1, 2, 3, 5).
//
// Tanggung jawab:
//   - `requestVerification`: menerbitkan token verifikasi baru (invalidasi token
//     aktif lama), menegakkan rate limit berbasis DB, lalu mengirim email —
//     bersifat non-blocking terhadap kegagalan pengiriman.
//   - `consumeVerification`: memvalidasi token masuk lalu menetapkan status
//     terverifikasi (sekali pakai).
//   - `isEmailVerified`: gate untuk aksi sensitif (generate/regenerate API key).
//
// Prinsip keamanan: database hanya menyimpan `tokenHash` (SHA-256); nilai token
// mentah hanya ada di tautan email dan tidak pernah disimpan/terlog (Req 11.1, 11.3).

import { db } from "@/lib/db";
import { deliverEmail } from "@/lib/email/index";
import { resolveLocale } from "@/lib/email/templates";
import { APP_URL } from "@/lib/email/config";
import {
  generateToken,
  hashToken,
  checkTokenRateLimit,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
} from "@/lib/email/tokens";

/** TTL token verifikasi: 24 jam sejak pembuatan (Req 1.2). */
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export type VerifyRequestResult =
  | { ok: true }
  | { ok: false; code: "ALREADY_VERIFIED" | "RATE_LIMITED"; retryAfterMs?: number };

export type VerifyConsumeResult =
  | { ok: true }
  | { ok: false; code: "EXPIRED" | "INVALID" };

/**
 * Menerbitkan token verifikasi baru untuk `userId` lalu mengirim email verifikasi.
 *
 * Aturan (design.md, Verification_Service):
 *   - User tidak ditemukan → `INVALID`-equivalent: diperlakukan sebagai INVALID
 *     tidak berlaku di sini; kembalikan `ALREADY_VERIFIED` hanya untuk user
 *     terverifikasi. User tak-ada dikembalikan sebagai RATE_LIMITED? Tidak —
 *     kita perlakukan sebagai tidak ada aksi valid. Namun kontrak hanya
 *     mendefinisikan ALREADY_VERIFIED/RATE_LIMITED; user tak-ada tidak akan
 *     terjadi pada alur bersesi. Untuk keamanan, jika user tak ada kita anggap
 *     tidak ada yang bisa dilakukan dan tetap kembalikan { ok: true } (tanpa
 *     mengirim apa pun) agar tidak membocorkan keberadaan akun.
 *   - Sudah terverifikasi (`emailVerified` non-null) → `ALREADY_VERIFIED` (Req 1.5).
 *   - >=3 token dalam window 60 menit → `RATE_LIMITED` + `retryAfterMs` (Req 3.2, 3.3).
 *   - Selain itu: transaksi { invalidasi token aktif → buat token baru TTL 24 jam }
 *     (Req 1.1, 1.2, 1.4) lalu `deliverEmail("verify")` (Req 1.3). Pengiriman email
 *     bersifat non-blocking: token tetap terbit walau email gagal.
 */
export async function requestVerification(
  userId: string,
): Promise<VerifyRequestResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, locale: true, emailVerified: true },
  });

  // User tak ditemukan: tidak ada aksi yang bisa dilakukan. Kembalikan sukses
  // generik tanpa menerbitkan/mengirim apa pun (tidak membocorkan keberadaan akun).
  if (!user) {
    return { ok: true };
  }

  // Req 1.5: user yang sudah terverifikasi menolak permintaan verifikasi baru.
  if (user.emailVerified != null) {
    return { ok: false, code: "ALREADY_VERIFIED" };
  }

  const now = new Date();

  // Req 3.2/3.3: rate limit berbasis DB (>=3 token / 60 menit).
  const rate = await checkTokenRateLimit(db.emailVerificationToken, userId, {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    now,
  });
  if (rate.limited) {
    return { ok: false, code: "RATE_LIMITED", retryAfterMs: rate.retryAfterMs };
  }

  // Terbitkan token baru dalam satu transaksi:
  //   1. Invalidasi seluruh token aktif (belum usedAt, belum kedaluwarsa) (Req 1.4).
  //   2. Buat token baru TTL 24 jam (Req 1.1, 1.2).
  const { raw, hash } = generateToken();
  const expiresAt = new Date(now.getTime() + VERIFICATION_TTL_MS);

  await db.$transaction([
    db.emailVerificationToken.updateMany({
      where: { userId, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    }),
    db.emailVerificationToken.create({
      data: { userId, tokenHash: hash, expiresAt, createdAt: now },
    }),
  ]);

  // Req 1.3: kirim email verifikasi. Non-blocking — kegagalan tidak membatalkan
  // penerbitan token; user dapat kirim ulang.
  const verifyUrl = `${APP_URL}/verify-email?token=${raw}`;
  await deliverEmail({
    to: user.email,
    kind: "verify",
    locale: resolveLocale(user.locale),
    vars: { verifyUrl },
  });

  return { ok: true };
}

/**
 * Mengonsumsi token verifikasi mentah lalu menetapkan status terverifikasi.
 *
 * Aturan (design.md, Verification_Service):
 *   - Hash lookup by `tokenHash`. Tidak ditemukan atau sudah `usedAt` → `INVALID` (Req 2.4).
 *   - `expiresAt` di masa lalu → `EXPIRED` (Req 2.3).
 *   - Valid → transaksi { set `emailVerified = now` (Req 2.1) + `usedAt = now` (Req 2.2) }.
 */
export async function consumeVerification(
  rawToken: string,
): Promise<VerifyConsumeResult> {
  const tokenHash = hashToken(rawToken);
  const token = await db.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  // Tidak ditemukan atau sudah terpakai/di-invalidasi → INVALID (Req 2.4).
  if (!token || token.usedAt != null) {
    return { ok: false, code: "INVALID" };
  }

  const now = new Date();

  // Kedaluwarsa → EXPIRED (Req 2.3).
  if (token.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, code: "EXPIRED" };
  }

  // Valid: set emailVerified + tandai token terpakai dalam satu transaksi.
  await db.$transaction([
    db.user.update({
      where: { id: token.userId },
      data: { emailVerified: now },
    }),
    db.emailVerificationToken.update({
      where: { id: token.id },
      data: { usedAt: now },
    }),
  ]);

  return { ok: true };
}

/**
 * Gate aksi sensitif (Req 5): benar jika dan hanya jika `emailVerified` non-null.
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  return user?.emailVerified != null;
}
