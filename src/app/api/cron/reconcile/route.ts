import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listProviderOrders, cancelOrder, type ServerId } from "@/lib/otp";

const CRON_SECRET = process.env.CRON_SECRET || "";

// Semua server Clowatch (api5/8/9/10) share API key yang sama, dan order di
// Clowatch terikat ke API key (bukan ke versi endpoint). Endpoint list /orders
// HANYA ada di v1 (api5) — v2/v3/v4 balikin 404. Maka:
//   - List & cancel orphan cukup lewat api5 (mencakup semua order lintas v1-v4).
//   - DB comparison tetap pakai semua server Clowatch (order kita bisa tercatat
//     sebagai api8/9/10, tapi orderId-nya muncul di list v1 karena API key sama).
const LIST_SERVER: ServerId = "api5";
const DB_CLOWATCH_SERVERS: ServerId[] = ["api5", "api8", "api9", "api10"];

// Orphan = order PENDING di provider tapi tidak ada record di DB kita.
// Hanya cancel yang umurnya > AGE_THRESHOLD biar gak nabrak order yang
// lagi proses dibuat (race saat createOrder belum sempat simpan record).
const AGE_THRESHOLD_MS = 5 * 60 * 1000; // 5 menit
// Batasi jumlah cancel per run supaya gak hammer provider.
const MAX_CANCEL_PER_RUN = 30;

/**
 * Cron reconcile: deteksi & cancel orphan number di Clowatch.
 *
 * Orphan terjadi kalau createOrder ke Clowatch BERHASIL alokasi nomor, tapi
 * response putus (network drop / timeout) sebelum kita simpan record →
 * saldo user kita refund tapi nomor nyangkut di provider tanpa pemilik.
 *
 * Strategi:
 *   1. Ambil semua order PENDING dari Clowatch via api5 (list v1 mencakup
 *      semua order lintas v1-v4 karena share API key yang sama).
 *   2. Bandingkan dengan set orderId di DB kita (semua server Clowatch).
 *   3. orderId yang ADA di provider tapi TIDAK ADA di DB + umur > 5 menit
 *      → cancel di provider (lepas nomor, balikin stock provider).
 *
 * Trigger: curl -s -H "Authorization: Bearer $CRON_SECRET" https://kirimkode.com/api/cron/reconcile
 */
export async function GET(req: NextRequest) {
  if (!CRON_SECRET && process.env.NODE_ENV === "production") {
    console.error("[RECONCILE] CRON_SECRET not set in production!");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Ambil order pending dari Clowatch via api5 (list v1 = semua order lintas
  // versi karena share API key). Map orderId → createdAt.
  const providerOrders = new Map<number, { createdAt: number | null }>();
  const fetchErrors: Record<string, string> = {};

  try {
    const list = await listProviderOrders(LIST_SERVER, "pending");
    for (const o of list) {
      if (!providerOrders.has(o.orderId)) {
        providerOrders.set(o.orderId, { createdAt: o.createdAt });
      }
    }
  } catch (err) {
    fetchErrors[LIST_SERVER] = (err as Error).message;
  }

  if (providerOrders.size === 0) {
    return NextResponse.json({
      success: true,
      message: "Tidak ada order pending di provider Clowatch.",
      fetchErrors: Object.keys(fetchErrors).length ? fetchErrors : undefined,
    });
  }

  // 2. Set orderId yang KITA punya di DB (semua server Clowatch, 6 jam terakhir).
  // Provider pending list cuma berisi order baru (expire ~20 menit), jadi
  // window 6 jam lebih dari cukup untuk cover semua kandidat.
  const sinceDate = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const dbOrders = await db.order.findMany({
    where: {
      server: { in: DB_CLOWATCH_SERVERS },
      createdAt: { gte: sinceDate },
    },
    select: { orderId: true },
  });
  const dbOrderIds = new Set(dbOrders.map((o) => o.orderId));

  // 3. Cari orphan: ada di provider, tidak ada di DB, umur > threshold.
  const orphans: number[] = [];
  for (const [orderId, info] of providerOrders) {
    if (dbOrderIds.has(orderId)) continue; // legit, ada pemiliknya
    // Skip yang masih terlalu baru (mungkin lagi proses dibuat / belum commit).
    if (info.createdAt != null) {
      const ageMs = (nowSec - info.createdAt) * 1000;
      if (ageMs < AGE_THRESHOLD_MS) continue;
    }
    orphans.push(orderId);
  }

  // 4. Cancel orphan via api5 (dibatasi MAX_CANCEL_PER_RUN per run).
  let cancelled = 0;
  let cancelFailed = 0;
  const toCancel = orphans.slice(0, MAX_CANCEL_PER_RUN);
  for (const orderId of toCancel) {
    try {
      await cancelOrder(LIST_SERVER, orderId);
      cancelled++;
      console.log(`[RECONCILE] Cancel orphan ${orderId}`);
    } catch (err) {
      cancelFailed++;
      console.warn(`[RECONCILE] Gagal cancel orphan ${orderId}:`, (err as Error).message);
    }
  }

  return NextResponse.json({
    success: true,
    results: {
      providerPending: providerOrders.size,
      dbKnown: dbOrderIds.size,
      orphansDetected: orphans.length,
      cancelled,
      cancelFailed,
    },
    fetchErrors: Object.keys(fetchErrors).length ? fetchErrors : undefined,
  });
}
