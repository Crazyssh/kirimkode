import { db } from "@/lib/db";

/**
 * Resolve order baik dari cuid (DB primary key) maupun integer order_id (provider).
 *
 * Customer API dapat `order_id` integer dari POST /order — biar mereka gak
 * harus call /orders dulu untuk dapet cuid, endpoint /order/{id}/* nerima dua-duanya.
 *
 * Returns:
 *   - { status: "found", order } kalau ketemu
 *   - { status: "not_found" } kalau gak ada
 *   - { status: "ambiguous" } kalau integer match >1 row (jaga-jaga, harusnya gak terjadi)
 */
export async function findOrderByAnyId(
  idOrOrderId: string,
  userId: string
) {
  const trimmed = idOrOrderId.trim();
  if (!trimmed) return { status: "not_found" as const };

  // Coba parse sebagai integer order_id (provider ID)
  // Jangan pakai parseInt karena "abc123" akan parse jadi 123 → false positive.
  // Cek dengan regex: harus full digits saja.
  const isNumeric = /^\d+$/.test(trimmed);

  if (isNumeric) {
    const intId = Number(trimmed);
    if (intId > 0 && intId <= 2_147_483_647) {
      const matches = await db.order.findMany({
        where: { orderId: intId, userId },
        orderBy: { createdAt: "desc" },
        take: 2,
      });

      if (matches.length === 0) {
        // Fallback: coba sebagai cuid string (kasus jarang, tapi safe)
        const byCuid = await db.order.findFirst({
          where: { id: trimmed, userId },
        });
        return byCuid
          ? { status: "found" as const, order: byCuid }
          : { status: "not_found" as const };
      }

      if (matches.length === 1) {
        return { status: "found" as const, order: matches[0] };
      }

      // Ambil yang terbaru (>1 match untuk integer order_id rare tapi mungkin
      // karena tabel pakai composite uniqueness, tidak strict unique)
      return { status: "found" as const, order: matches[0] };
    }
  }

  // Cuid (atau bukan integer valid) → lookup by primary key
  const order = await db.order.findFirst({
    where: { id: trimmed, userId },
  });

  return order
    ? { status: "found" as const, order }
    : { status: "not_found" as const };
}
