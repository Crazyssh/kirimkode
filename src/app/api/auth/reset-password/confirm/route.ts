// POST /api/auth/reset-password/confirm — menetapkan password baru via token.
//
// Route publik (tanpa session): user datang dari tautan email membawa token.
// Memvalidasi input, menerapkan rate limit IP kasar, lalu memanggil
// `setNewPassword`. Memetakan kode hasil service ke pesan i18n + status HTTP:
//   - WEAK_PASSWORD → pesan syarat password + 400 (Req 7.5)
//   - INVALID       → pesan token tidak valid + 400 (Req 7.4)
//   - EXPIRED       → pesan token kedaluwarsa + 400 (Req 7.3)
//   - ok            → pesan "password diperbarui" (Req 7.1)
//
// _Requirements: 7.1, 7.3, 7.4, 7.5, 12.2_

import { NextRequest } from "next/server";
import { apiMessage, apiError } from "@/lib/api-response";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { validateBody, resetPasswordConfirmSchema } from "@/lib/validations";
import { setNewPassword } from "@/lib/email/password-reset";
import { resolveLocale } from "@/lib/email/templates";
import { id } from "@/lib/i18n/id";
import { en } from "@/lib/i18n/en";

function messages(locale: "id" | "en") {
  return (locale === "en" ? en : id).resetPassword;
}

export async function POST(req: NextRequest) {
  let locale = resolveLocale(req.headers.get("accept-language")?.startsWith("en") ? "en" : "id");

  try {
    // Rate limit IP kasar: maks 10 percobaan konfirmasi / menit per IP.
    const rateLimited = checkRouteRateLimit(req, "reset-password-confirm", 10, 60000);
    if (rateLimited) return rateLimited;

    const body = await req.json().catch(() => ({}));
    const validated = validateBody(resetPasswordConfirmSchema, body);
    if (!validated.success) {
      return apiError(messages(locale).invalidInput, 400);
    }

    const { token, password, locale: bodyLocale } = validated.data;
    locale = resolveLocale(bodyLocale ?? locale);

    const result = await setNewPassword(token, password);

    if (result.ok) {
      // Req 7.1: password baru berhasil disimpan (ter-hash).
      return apiMessage(messages(locale).passwordUpdated, 200);
    }

    // Petakan kode error ke pesan i18n + HTTP 400.
    switch (result.code) {
      case "WEAK_PASSWORD":
        // Req 7.5: password tidak memenuhi panjang minimal.
        return apiError(messages(locale).weakPassword, 400, "WEAK_PASSWORD");
      case "EXPIRED":
        // Req 7.3: token kedaluwarsa.
        return apiError(messages(locale).expiredToken, 400, "EXPIRED");
      case "INVALID":
      default:
        // Req 7.4: token tidak ditemukan / sudah dipakai.
        return apiError(messages(locale).invalidToken, 400, "INVALID");
    }
  } catch {
    // Req 12.2: kegagalan tak terduga — minta user mencoba lagi.
    return apiError(messages(locale).tryAgain, 500);
  }
}
