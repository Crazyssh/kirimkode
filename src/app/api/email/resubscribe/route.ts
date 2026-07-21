// Route: GET /api/email/resubscribe
//
// Menghapus status opt-out marketing seorang penerima ketika ia mengeklik
// tautan berlangganan kembali pada email. Token opt-out stabil dibaca dari
// query string (tanpa sesi, karena tautan diklik dari email). Mengembalikan
// JSON via `api-response` untuk konsistensi API (tidak ada halaman khusus —
// lihat tabel route pada design.md).
//
// Requirements: 9.5 (akses tautan berlangganan kembali → hapus status Opt_Out).

import { NextRequest } from "next/server";
import { z } from "zod";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { apiError, apiMessage } from "@/lib/api-response";
import { resubscribe } from "@/lib/email/marketing";
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
  const rateLimited = checkRouteRateLimit(req, "email-resubscribe", 10, 60000);
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(req.url);
  const t = messagesFor(req, searchParams.get("lang"));

  // Validasi keberadaan token (zod).
  const parsed = tokenSchema.safeParse({ token: searchParams.get("token") ?? undefined });
  if (!parsed.success) {
    return apiError(t.optOutTokenRequired, 400, "TOKEN_REQUIRED");
  }

  const result = await resubscribe(parsed.data.token);

  if (result.ok) {
    // Req 9.5: status Opt_Out penerima dihapus.
    return apiMessage(t.resubscribed, 200);
  }

  // Token tidak ditemukan.
  return apiError(t.optOutInvalidToken, 400, "INVALID");
}
