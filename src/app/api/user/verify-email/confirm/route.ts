// Route: GET|POST /api/user/verify-email/confirm
//
// Menyelesaikan verifikasi email dengan mengonsumsi token. Token dibaca dari
// query string (GET, saat user mengeklik tautan pada email) atau dari body
// (POST). Mengembalikan JSON via `api-response` untuk konsistensi API
// (tidak ada halaman verify khusus — lihat tabel route pada design.md).
//
// Requirements: 2.1 (verifikasi token valid), 2.3 (EXPIRED), 2.4 (INVALID).

import { NextRequest } from "next/server";
import { z } from "zod";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { apiError, apiMessage } from "@/lib/api-response";
import { consumeVerification } from "@/lib/email/verification";
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
  return wantsEn ? en.emailVerify : id.emailVerify;
}

async function handle(req: NextRequest, rawToken: string | null, langParam?: string | null) {
  const t = messagesFor(req, langParam);

  // Validasi keberadaan token (zod).
  const parsed = tokenSchema.safeParse({ token: rawToken ?? undefined });
  if (!parsed.success) {
    return apiError(t.tokenRequired, 400, "TOKEN_REQUIRED");
  }

  const result = await consumeVerification(parsed.data.token);

  if (result.ok) {
    // Req 2.1: emailVerified ditetapkan.
    return apiMessage(t.verified, 200);
  }

  if (result.code === "EXPIRED") {
    // Req 2.3: token kedaluwarsa.
    return apiError(t.expiredToken, 400, "EXPIRED");
  }

  // Req 2.4: token tidak ditemukan/sudah terpakai.
  return apiError(t.invalidToken, 400, "INVALID");
}

export async function GET(req: NextRequest) {
  const rateLimited = checkRouteRateLimit(req, "verify-email-confirm", 10, 60000);
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(req.url);
  return handle(req, searchParams.get("token"), searchParams.get("lang"));
}

export async function POST(req: NextRequest) {
  const rateLimited = checkRouteRateLimit(req, "verify-email-confirm", 10, 60000);
  if (rateLimited) return rateLimited;

  const body = (await req.json().catch(() => ({}))) as { token?: unknown };
  const token = typeof body.token === "string" ? body.token : null;
  return handle(req, token);
}
