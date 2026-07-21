// POST /api/auth/reset-password/request — permintaan reset password via email.
//
// Route publik (tanpa session). Memvalidasi input, menerapkan rate limit IP
// kasar, lalu memanggil `requestPasswordReset`. Sesuai Req 6.4/6.5
// (anti-enumerasi), route SELALU mengembalikan pesan sukses generik yang
// identik — tidak pernah mengungkap apakah akun ada, apakah akun OAuth-only,
// atau apakah rate limit terlampaui.
//
// _Requirements: 6.3, 6.4, 6.5, 12.2_

import { NextRequest } from "next/server";
import { apiMessage, apiError } from "@/lib/api-response";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { validateBody, resetPasswordRequestSchema } from "@/lib/validations";
import { requestPasswordReset } from "@/lib/email/password-reset";
import { resolveLocale } from "@/lib/email/templates";
import { id } from "@/lib/i18n/id";
import { en } from "@/lib/i18n/en";

function messages(locale: "id" | "en") {
  return (locale === "en" ? en : id).resetPassword;
}

export async function POST(req: NextRequest) {
  // Locale awal (untuk pesan error validasi) dari header; default "id".
  let locale = resolveLocale(req.headers.get("accept-language")?.startsWith("en") ? "en" : "id");

  try {
    // Rate limit IP kasar sebagai lapis pelindung tambahan (rate limit utama
    // berbasis DB ada di service). Maks 5 permintaan / menit per IP.
    const rateLimited = checkRouteRateLimit(req, "reset-password-request", 5, 60000);
    if (rateLimited) return rateLimited;

    const body = await req.json().catch(() => ({}));
    const validated = validateBody(resetPasswordRequestSchema, body);
    if (!validated.success) {
      return apiError(messages(locale).invalidInput, 400);
    }

    const { email, locale: bodyLocale } = validated.data;
    locale = resolveLocale(bodyLocale ?? locale);

    // Req 6.4/6.5: service SELALU mengembalikan { ok: true } generik.
    // Kegagalan pengiriman email ditangani non-blocking di dalam service dan
    // tidak tercermin pada respons (anti-enumerasi).
    await requestPasswordReset(email.toLowerCase().trim());

    // Req 6.4/6.5: pesan sukses generik yang identik untuk semua kasus.
    return apiMessage(messages(locale).requestGeneric, 200);
  } catch {
    // Req 12.2: kegagalan tak terduga — minta user mencoba lagi.
    return apiError(messages(locale).tryAgain, 500);
  }
}
