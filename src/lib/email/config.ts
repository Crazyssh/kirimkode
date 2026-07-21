/**
 * Konfigurasi email + kill switch (email-service, Req 11.4, 14.1, 14.3).
 *
 * SMTP bersifat provider-agnostic: host/port/kredensial/pengirim dibaca dari
 * environment variable (nama env konsisten dengan `scripts/test-smtp.mjs`),
 * tidak di-hardcode. Kill switch `email_enabled` (SiteSetting) memungkinkan
 * menonaktifkan pengiriman email tanpa memengaruhi alur bisnis inti.
 */

import { db } from "@/lib/db";

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string; // alamat pengirim
  fromName: string; // display name
}

/**
 * Base URL aplikasi untuk menyusun tautan verifikasi/reset/opt-out.
 * Fallback ke localhost agar tetap terdefinisi di lingkungan dev.
 */
export const APP_URL: string =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Port SMTP default (587 = STARTTLS) bila `EMAIL_PORT` tidak di-set. */
const DEFAULT_SMTP_PORT = 587;

/**
 * Membaca konfigurasi SMTP dari environment variable.
 *
 * Mengembalikan `null` jika kredensial wajib tidak lengkap
 * (`EMAIL_HOST`, `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM`), sehingga
 * pemanggil dapat memperlakukan email sebagai tidak terkonfigurasi (Req 14.1).
 */
export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.EMAIL_HOST?.trim();
  const username = process.env.EMAIL_USERNAME?.trim();
  const password = process.env.EMAIL_PASSWORD;
  const from = process.env.EMAIL_FROM?.trim();

  // Kredensial wajib harus lengkap; tanpa ini email tak bisa dikirim.
  if (!host || !username || !password || !from) {
    return null;
  }

  const parsedPort = Number(process.env.EMAIL_PORT);
  const port =
    Number.isFinite(parsedPort) && parsedPort > 0
      ? parsedPort
      : DEFAULT_SMTP_PORT;

  return {
    host,
    port,
    username,
    password,
    from,
    fromName: process.env.EMAIL_FROM_NAME?.trim() || from,
  };
}

/**
 * Kill switch pengiriman email (Req 14.3).
 *
 * Email dianggap aktif jika SiteSetting `email_enabled` bukan `"false"`
 * (default true) DAN konfigurasi SMTP lengkap (`getSmtpConfig() != null`).
 */
export async function isEmailEnabled(): Promise<boolean> {
  if (getSmtpConfig() == null) return false;

  try {
    const setting = await db.siteSetting.findUnique({
      where: { key: "email_enabled" },
    });
    // Default true: hanya nonaktif jika secara eksplisit di-set ke "false".
    return setting?.value !== "false";
  } catch {
    // Kegagalan baca setting tidak boleh mematikan email secara diam-diam
    // maupun melempar; default ke perilaku aktif (default true).
    return true;
  }
}
