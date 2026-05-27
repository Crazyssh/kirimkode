import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";

/**
 * POST /api/admin/orders/[id]/refund
 * Body: { reason?: string }
 *
 * Manual refund oleh admin untuk kasus seperti:
 *   - User report OTP salah
 *   - Provider error tapi order sudah masuk status "success"
 *   - Goodwill compensation
 *
 * Aturan:
 *   - Order yang sudah `refunded` tidak bisa di-refund lagi (idempotent)
 *   - Saldo user otomatis di-credit kembali sesuai `order.price`
 *   - Status order di-update ke "refunded"
 *   - Tercatat di audit log dengan reason
 *
 * Note: Kita TIDAK panggil provider cancel API — di banyak kasus, order
 * sudah selesai dari sisi provider (received/finished), refund di sini murni
 * compensation di sisi kita ke user. Provider sudah dibayar/charge.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error, user: admin } = await requireAdmin();
  if (error) return error;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Order ID required" }, { status: 400 });
  }

  let reason = "";
  try {
    const body = await req.json().catch(() => ({}));
    reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  } catch {
    // body optional
  }

  try {
    const order = await db.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        price: true,
        status: true,
        server: true,
        service: true,
        serviceName: true,
        number: true,
        countryId: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    if (order.status === "refunded") {
      return NextResponse.json(
        { error: "Order sudah di-refund sebelumnya" },
        { status: 409 }
      );
    }

    if (order.price <= 0) {
      return NextResponse.json(
        { error: "Harga order Rp 0, tidak ada yang perlu di-refund" },
        { status: 400 }
      );
    }

    const refundResult = await db.$transaction(async (tx) => {
      // Atomic claim: only refund kalau status belum "refunded"
      const updated = await tx.order.updateMany({
        where: { id, status: { not: "refunded" } },
        data: { status: "refunded" },
      });

      if (updated.count === 0) {
        // Race: order sudah di-refund oleh request lain
        return null;
      }

      // Credit balance ke user
      const updatedUser = await tx.user.update({
        where: { id: order.userId },
        data: { balance: { increment: order.price } },
        select: { id: true, email: true, name: true, balance: true },
      });

      // api4 (Neptune): restore stock entry juga (+1)
      // Karena order success → user dapat OTP → stock sudah decrement.
      // Kalau refund, kita anggap "stock balik" supaya bisa dijual lagi.
      if (order.server === "api4" && order.service && order.countryId) {
        const country = await tx.providerCountry.findUnique({
          where: {
            serverId_externalId: { serverId: "api4", externalId: order.countryId },
          },
          select: { id: true },
        });
        if (country) {
          await tx.providerService.updateMany({
            where: {
              serverId: "api4",
              countryId: country.id,
              code: order.service,
            },
            data: { stock: { increment: 1 } },
          });
        }
      }

      return updatedUser;
    });

    if (!refundResult) {
      return NextResponse.json(
        { error: "Order sudah di-refund (race condition)" },
        { status: 409 }
      );
    }

    // Audit log — siapa, kapan, kenapa
    if (admin?.id) {
      logAction(
        admin.id,
        "admin_refund",
        JSON.stringify({
          orderId: order.id,
          targetUserId: order.userId,
          amount: order.price,
          server: order.server,
          service: order.serviceName,
          number: order.number,
          reason: reason || null,
        })
      );
    }

    console.log(
      `[Admin Refund] Order ${order.id} → +Rp ${order.price} ke user ${refundResult.email} (admin: ${admin?.id ?? "unknown"})${reason ? ` — reason: ${reason}` : ""}`
    );

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        refundedAmount: order.price,
        user: {
          id: refundResult.id,
          email: refundResult.email,
          name: refundResult.name,
          newBalance: refundResult.balance,
        },
      },
    });
  } catch (err) {
    console.error("[Admin Refund] Error:", err);
    return NextResponse.json(
      { error: "Gagal melakukan refund" },
      { status: 500 }
    );
  }
}
