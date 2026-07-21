/**
 * Utilitas token untuk email-service (Req 11.1, 11.2, 3.2, 6.6).
 *
 * - Token acak 32 byte (>=128-bit entropi) di-encode hex sebagai nilai mentah
 *   yang dikirim ke user; database hanya menyimpan `tokenHash` (SHA-256) agar
 *   nilai token tidak pernah tersimpan/terlog dalam bentuk mentah (Req 11.3).
 * - Rate limit berbasis DB (bukan in-memory) agar konsisten di seluruh instance
 *   PM2 cluster: menghitung token yang `createdAt`-nya berada dalam window
 *   (default 60 menit) untuk seorang user (Req 3.2, 6.6).
 */

import { createHash, randomBytes } from "node:crypto";

/** Jumlah byte acak untuk token mentah. 32 byte = 256-bit entropi (>=128-bit). */
export const TOKEN_BYTES = 32;

/** Window default rate limit penerbitan token: 60 menit (Req 3.2, 6.6). */
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** Batas default jumlah penerbitan token per window: maksimum 3 (Req 3.2, 6.6). */
export const RATE_LIMIT_MAX = 3;

export interface GeneratedToken {
  /** Nilai token mentah (hex) yang dikirim ke user via email. */
  raw: string;
  /** SHA-256 dari nilai mentah; inilah yang disimpan di database. */
  hash: string;
}

/**
 * Menghitung SHA-256 (hex) dari nilai token mentah.
 * Deterministik: raw yang sama selalu menghasilkan hash yang sama, sehingga
 * lookup dilakukan dengan hashing token masuk lalu mencari `tokenHash`.
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Membuat token acak baru (>=128-bit entropi) beserta hash-nya.
 * `raw` dikirim ke user; `hash` disimpan di kolom `tokenHash`.
 */
export function generateToken(): GeneratedToken {
  const raw = randomBytes(TOKEN_BYTES).toString("hex");
  return { raw, hash: hashToken(raw) };
}

/**
 * Delegate Prisma minimal yang dibutuhkan helper rate limit. Baik
 * `db.emailVerificationToken` maupun `db.passwordResetToken` memenuhi bentuk
 * ini, sehingga helper dapat dipakai ulang oleh Verification_Service maupun
 * Password_Reset_Service.
 */
export interface RateLimitDelegate {
  count(args: {
    where: { userId: string; createdAt: { gte: Date } };
  }): Promise<number>;
  findFirst(args: {
    where: { userId: string; createdAt: { gte: Date } };
    orderBy: { createdAt: "asc" };
    select: { createdAt: true };
  }): Promise<{ createdAt: Date } | null>;
}

export interface RateLimitResult {
  /** true jika penerbitan token berikutnya harus ditolak karena rate limit. */
  limited: boolean;
  /** Jumlah token yang dibuat dalam window saat ini. */
  count: number;
  /**
   * Sisa waktu tunggu (ms) sebelum penerbitan diizinkan lagi; hanya bermakna
   * ketika `limited` bernilai true. Dihitung dari token tertua dalam window:
   * `oldestInWindow.createdAt + window - now` (design.md, Req 3.3).
   */
  retryAfterMs: number;
}

/**
 * Menghitung rate limit penerbitan token berbasis DB untuk seorang user.
 *
 * Menghitung berapa banyak token milik `userId` yang `createdAt`-nya berada
 * dalam `windowMs` terakhir. Jika jumlahnya sudah mencapai `max`, penerbitan
 * berikutnya ditolak (`limited = true`) dan `retryAfterMs` dihitung dari token
 * tertua dalam window.
 *
 * Bersifat generik terhadap `delegate` sehingga verifikasi maupun reset dapat
 * memakai helper yang sama.
 */
export async function checkTokenRateLimit(
  delegate: RateLimitDelegate,
  userId: string,
  options: { windowMs?: number; max?: number; now?: Date } = {},
): Promise<RateLimitResult> {
  const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const max = options.max ?? RATE_LIMIT_MAX;
  const now = options.now ?? new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  const count = await delegate.count({
    where: { userId, createdAt: { gte: windowStart } },
  });

  if (count < max) {
    return { limited: false, count, retryAfterMs: 0 };
  }

  // Rate limit tercapai: hitung sisa tunggu dari token tertua dalam window.
  const oldest = await delegate.findFirst({
    where: { userId, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const retryAfterMs = oldest
    ? Math.max(0, oldest.createdAt.getTime() + windowMs - now.getTime())
    : 0;

  return { limited: true, count, retryAfterMs };
}
