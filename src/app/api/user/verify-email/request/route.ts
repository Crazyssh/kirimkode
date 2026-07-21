// Route: POST /api/user/verify-email/request
//
// Meminta pengiriman (atau kirim ulang) email verifikasi untuk user yang sedang
// login. Mendelegasikan seluruh logika penerbitan token, rate limit berbasis DB,
// dan pengiriman email ke `requestVerification` (Verification_Service).
//
// Requirements: 1.3 (kirim email verifikasi), 3.1 (kirim ulang),
// 3.2/3.3 (rate limit + durasi tunggu → HTTP 429), 12.2.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { apiError, apiMessage } from "@/lib/api-response";
import { requestVerification } from "@/lib/email/verification";
import { id } from "@/lib/i18n/id";
import { en } from "@/lib/i18n/en";

export async function POST(req: NextRequest) {
  // Rate limit IP kasar (lapis pelindung selain rate limit token berbasis DB):
  // maks 5 permintaan per IP per menit. Mengikuti pola `checkRouteRateLimit`.
  const rateLimited = checkRouteRateLimit(req, "verify-email-request", 5, 60000);
  if (rateLimited) return rateLimited;

  const session = await auth();
  if (!session?.user?.id) {
    // Belum login: butuh sesi untuk mengaitkan verifikasi dengan user.
    return apiError(id.emailVerify.unauthorized, 401, "UNAUTHORIZED");
  }

  const userId = session.user.id;

  // Locale untuk pesan respons mengikuti preferensi tersimpan user
  // ("en" jika dan hanya jika tepat "en", selain itu "id" — Req 13).
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });
  const t = user?.locale === "en" ? en.emailVerify : id.emailVerify;

  const result = await requestVerification(userId);

  if (result.ok) {
    // Sukses: token diterbitkan & email dikirim best-effort (non-blocking).
    return apiMessage(t.requestSent, 200);
  }

  if (result.code === "ALREADY_VERIFIED") {
    // Req 1.5: user sudah terverifikasi.
    return apiError(t.alreadyVerified, 400, "ALREADY_VERIFIED");
  }

  // RATE_LIMITED (Req 3.2/3.3): HTTP 429 + durasi tunggu tersisa.
  const retryAfterMs = result.retryAfterMs ?? 0;
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
  const message = t.rateLimited.replace("{minutes}", String(minutes));
  return apiError(message, 429, "RATE_LIMITED");
}
