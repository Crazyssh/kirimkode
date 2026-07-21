// Route: GET /api/email/opt-out
//
// Menetapkan status opt-out marketing seorang penerima ketika ia mengeklik
// tautan opt-out pada email broadcast. Token opt-out stabil dibaca dari query
// string (tanpa sesi, karena tautan diklik dari email). Mengembalikan JSON via
// `api-response` untuk konsistensi API (tidak ada halaman khusus — lihat tabel
// route pada design.md).
//
// Requirements: 9.4 (akses tautan opt-out → status Opt_Out).

import { NextRequest } from "next/server";
import { z } from "zod";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { apiError, apiMessage } from "@/lib/api-response";
import { optOut } from "@/lib/email/marketing";
import { id } from "@/lib/i18n/id";
import { en } from "@/lib/i18n/en";

const tokenSchema = z.object({
  token: z.string().min(1),
});

/**
 * Resolusi locale untuk pesan respons pada endpoint tanpa sesi.
 * "en" jika dan hanya jika input tepat "en" (query `?lang=` atau header
 * Accept-Language), selain itu "id" sebagai bawaan (Req 13.3).
 */
function messagesFor(req: NextRequest, langParam?: string | null) {
  const accept = req.headers.get("accept-language") ?? "";
  const wantsEn = langParam === "en" || accept.trim().toLowerCase().startsWith("en");
  return wantsEn ? en.emailMarketing : id.emailMarketing;
}

export async function GET(req: NextRequest) {
  const rateLimited = checkRouteRateLimit(req, "email-opt-out", 10, 60000);
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(req.url);
  const t = messagesFor(req, searchParams.get("lang"));

  // Validasi keberadaan token (zod).
  const parsed = tokenSchema.safeParse({ token: searchParams.get("token") ?? undefined });
  if (!parsed.success) {
    return apiError(t.optOutTokenRequired, 400, "TOKEN_REQUIRED");
  }

  const result = await optOut(parsed.data.token);

  if (result.ok) {
    // Req 9.4: penerima ditetapkan berstatus Opt_Out.
    return apiMessage(t.optedOut, 200);
  }

  // Token tidak ditemukan.
  return apiError(t.optOutInvalidToken, 400, "INVALID");
}
