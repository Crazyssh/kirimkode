// Password_Reset_Service — penerbitan & validasi token reset password
// (email-service, Req 6, 7).
//
// Tanggung jawab:
//   - `requestPasswordReset`: SELALU mengembalikan respons sukses generik
//     `{ ok: true }` (anti-enumerasi, Req 6.4/6.5). Perbedaan hanya pada email
//     yang dikirim (atau tidak), tidak tercermin pada nilai balik.
//   - `setNewPassword`: memvalidasi & mengonsumsi token reset lalu menyimpan
//     password baru dalam bentuk ter-hash (bcrypt), sekali pakai.
//
// Prinsip keamanan: database hanya menyimpan `tokenHash` (SHA-256); nilai token
// mentah hanya ada di tautan email dan tidak pernah disimpan/terlog (Req 11.2, 11.3).

import bcrypt from "bcryptjs";
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

/** TTL token reset password: 60 menit sejak pembuatan (Req 6.2). */
const RESET_TTL_MS = 60 * 60 * 1000;

/** Panjang minimum password baru (Req 7.5). */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Cost factor bcrypt — konsisten dengan pola hashing password di seluruh
 * codebase (register/settings/api-key/admin memakai `bcrypt.hash(pw, 12)`).
 */
const BCRYPT_ROUNDS = 12;

export type SetPasswordResult =
  | { ok: true }
  | { ok: false; code: "EXPIRED" | "INVALID" | "WEAK_PASSWORD" };

/**
 * Meminta reset password untuk sebuah alamat email.
 *
 * SELALU mengembalikan bentuk sukses generik `{ ok: true }` agar keberadaan
 * akun tidak dapat disimpulkan dari respons (anti-enumerasi, Req 6.4/6.5).
 *
 * Aturan (design.md, Password_Reset_Service):
 *   - Email tidak terdaftar → tidak kirim apa pun, kembalikan `{ ok: true }` (Req 6.4).
 *   - OAuth-only (`password == null`) → kirim email "login via OAuth"
 *     (`reset_oauth_hint`), kembalikan `{ ok: true }` (Req 6.5).
 *   - Credentials → jika >=3 permintaan dalam window 60 menit, diam-diam berhenti
 *     tetapi tetap `{ ok: true }` (Req 6.6); selain itu transaksi { invalidasi
 *     token reset aktif → buat token baru TTL 60 menit (Req 6.1, 6.2) } lalu
 *     `deliverEmail("reset")` (Req 6.3). Pengiriman email non-blocking.
 */
export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, locale: true, password: true },
  });

  // Req 6.4: email tidak terdaftar — tidak kirim apa pun, respons generik.
  if (!user) {
    return { ok: true };
  }

  // Req 6.5: akun OAuth-only (tanpa password) — kirim petunjuk login OAuth.
  if (user.password == null) {
    await deliverEmail({
      to: user.email,
      kind: "reset_oauth_hint",
      locale: resolveLocale(user.locale),
      vars: {},
    });
    return { ok: true };
  }

  const now = new Date();

  // Req 6.6: rate limit berbasis DB (>=3 permintaan / 60 menit). Bila terlampaui,
  // diam-diam berhenti tanpa membocorkan lewat respons (tetap { ok: true }).
  const rate = await checkTokenRateLimit(db.passwordResetToken, user.id, {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    now,
  });
  if (rate.limited) {
    return { ok: true };
  }

  // Terbitkan token reset baru dalam satu transaksi:
  //   1. Invalidasi seluruh token reset aktif (belum usedAt, belum kedaluwarsa).
  //   2. Buat token baru TTL 60 menit (Req 6.1, 6.2).
  const { raw, hash } = generateToken();
  const expiresAt = new Date(now.getTime() + RESET_TTL_MS);

  await db.$transaction([
    db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    }),
    db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt, createdAt: now },
    }),
  ]);

  // Req 6.3: kirim email reset. Non-blocking — kegagalan tidak membatalkan
  // penerbitan token; respons tetap generik.
  const resetUrl = `${APP_URL}/reset-password?token=${raw}`;
  await deliverEmail({
    to: user.email,
    kind: "reset",
    locale: resolveLocale(user.locale),
    vars: { resetUrl },
  });

  return { ok: true };
}

/**
 * Menetapkan password baru dari token reset mentah.
 *
 * Aturan (design.md, Password_Reset_Service):
 *   - Panjang password < 8 → `WEAK_PASSWORD` (Req 7.5). Divalidasi lebih dulu,
 *     sebelum menyentuh token, agar pesan syarat konsisten.
 *   - Hash lookup by `tokenHash`. Tidak ditemukan atau sudah `usedAt` → `INVALID` (Req 7.4).
 *   - `expiresAt` di masa lalu → `EXPIRED` (Req 7.3).
 *   - Valid → transaksi { set `password = bcrypt(new)` (Req 7.1) + `usedAt = now` (Req 7.2) }.
 */
export async function setNewPassword(
  rawToken: string,
  newPassword: string,
): Promise<SetPasswordResult> {
  // Req 7.5: validasi panjang minimal sebelum menyentuh token.
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, code: "WEAK_PASSWORD" };
  }

  const tokenHash = hashToken(rawToken);
  const token = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  // Tidak ditemukan atau sudah terpakai/di-invalidasi → INVALID (Req 7.4).
  if (!token || token.usedAt != null) {
    return { ok: false, code: "INVALID" };
  }

  const now = new Date();

  // Kedaluwarsa → EXPIRED (Req 7.3).
  if (token.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, code: "EXPIRED" };
  }

  // Valid: simpan password ter-hash + tandai token terpakai dalam satu transaksi
  // (Req 7.1, 7.2).
  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.$transaction([
    db.user.update({
      where: { id: token.userId },
      data: { password: hashedPassword },
    }),
    db.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: now },
    }),
  ]);

  return { ok: true };
}
