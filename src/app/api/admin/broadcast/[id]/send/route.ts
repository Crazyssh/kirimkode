// Route: POST /api/admin/broadcast/[id]/send
//
// Mengirim sebuah broadcast marketing ke seluruh penerima segmennya yang tidak
// berstatus opt-out. Seluruh logika resolusi penerima, filter opt-out, render
// per-penerima dengan tautan opt-out unik, pengiriman, dan tally didelegasikan
// ke `sendBroadcast` (Marketing_Service).
//
// Requirements: 9.1/9.2 (kepatuhan opt-out), 9.3 (tautan opt-out per penerima),
// 10.1/10.2 (tally per penerima + alasan gagal), 10.3 (ringkasan total/sent/failed).

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api-response";
import { sendBroadcast } from "@/lib/email/marketing";
import { id as idMessages } from "@/lib/i18n/id";
import { en as enMessages } from "@/lib/i18n/en";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Gate admin (Req 8.3 sisi route): non-admin/anonim ditolak lebih awal.
  const { error, user } = await requireAdmin();
  if (error) return error;

  // Locale pesan mengikuti preferensi admin ("en" iff tepat "en", selain itu "id").
  const admin = await db.user.findUnique({
    where: { id: user.id },
    select: { locale: true },
  });
  const t = admin?.locale === "en" ? enMessages.emailMarketing : idMessages.emailMarketing;

  const { id: broadcastId } = await params;

  const result = await sendBroadcast({ id: user.id, role: user.role }, broadcastId);

  if (result.ok) {
    // Req 10.3: kembalikan ringkasan total/sent/failed (invarian sent + failed = total).
    return apiSuccess(result.summary, 200);
  }

  if (result.code === "NOT_FOUND") {
    return apiError(t.broadcastSendNotFound, 404, "NOT_FOUND");
  }

  // FORBIDDEN (defensif — requireAdmin sudah menjaga gate ini).
  return apiError(t.broadcastSendForbidden, 403, "FORBIDDEN");
}
