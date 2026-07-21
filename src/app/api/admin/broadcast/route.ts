// Route: GET|POST /api/admin/broadcast
//
// Endpoint admin untuk mendaftar dan membuat broadcast email marketing.
// Gating admin memakai `requireAdmin()`; logika penyimpanan didelegasikan ke
// `createBroadcast` (Marketing_Service). Task 10.2 memiliki subroute
// `[id]/send`, task 10.3 memiliki route opt-out/resubscribe.
//
//   - GET  : daftar broadcast (admin) dengan field ringkasan pengiriman.
//   - POST : buat broadcast baru; validasi subjek/isi/segmen via zod, lalu
//            delegasi ke `createBroadcast`.
//
// Requirements: 8.1 (simpan broadcast + segmen), 8.2 (segmen all/subset),
// 8.3 (non-admin → FORBIDDEN 403), 8.4 (subjek/isi wajib → 400).

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createBroadcast, type Segment } from "@/lib/email/marketing";
import { id } from "@/lib/i18n/id";
import { en } from "@/lib/i18n/en";

// Skema segmen penerima (Req 8.2): seluruh pengguna atau subset berdasarkan id.
const segmentSchema = z.union([
  z.object({ type: z.literal("all") }),
  z.object({ type: z.literal("subset"), userIds: z.array(z.string().min(1)) }),
]);

// Skema body pembuatan broadcast. Subjek/isi divalidasi non-kosong setelah trim
// di service (Req 8.4); di sini hanya memastikan tipe dan keberadaan field.
const createSchema = z.object({
  subject: z.string(),
  body: z.string(),
  segment: segmentSchema,
});

/**
 * Resolusi pesan i18n berdasarkan preferensi locale admin.
 * "en" jika dan hanya jika locale tersimpan tepat "en", selain itu "id" (Req 13).
 */
function messagesFor(locale: string | null | undefined) {
  return locale === "en" ? en.emailMarketing : id.emailMarketing;
}

// GET: daftar broadcast (admin) dengan field ringkasan.
// Req 8.3: gating admin dijamin oleh requireAdmin(); memberi admin visibilitas
// status pengiriman tiap broadcast.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const broadcasts = await db.broadcast.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      subject: true,
      status: true,
      segmentType: true,
      totalCount: true,
      sentCount: true,
      failedCount: true,
      createdAt: true,
      sentAt: true,
    },
  });

  return apiSuccess(broadcasts, 200);
}

// POST: buat broadcast baru.
export async function POST(req: NextRequest) {
  const { error, user } = await requireAdmin();
  if (error) return error;

  const t = messagesFor(await adminLocale(user!.id));

  // Validasi body (zod). Format tidak valid → 400.
  const raw = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(t.broadcastInvalidBody, 400, "INVALID_BODY");
  }

  const segment: Segment = parsed.data.segment;

  // Delegasi ke Marketing_Service. Aktor memakai identitas admin terautentikasi
  // dengan role "admin" (service juga memvalidasi role — Req 8.3).
  const result = await createBroadcast(
    { id: user!.id, role: "admin" },
    {
      subject: parsed.data.subject,
      body: parsed.data.body,
      segment,
    },
  );

  if (result.ok) {
    // Req 8.1/8.2: broadcast tersimpan; kembalikan id-nya.
    return apiSuccess(
      { broadcastId: result.broadcastId, message: t.broadcastCreated },
      201,
    );
  }

  if (result.code === "MISSING_FIELDS") {
    // Req 8.4: subjek atau isi kosong setelah trim.
    return apiError(t.broadcastMissingFields, 400, "MISSING_FIELDS");
  }

  // Req 8.3: penolakan akses (fallback; requireAdmin normalnya sudah menahan).
  return apiError(t.broadcastCreateForbidden, 403, "FORBIDDEN");
}

/** Ambil preferensi locale admin untuk pesan i18n. */
async function adminLocale(userId: string): Promise<string | null> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });
  return u?.locale ?? null;
}
