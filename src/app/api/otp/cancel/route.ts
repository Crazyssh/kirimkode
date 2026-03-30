import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cancelOrder } from "@/lib/otp";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { logAction } from "@/lib/audit";
import { otpCancelSchema, validateBody } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: max 50 cancel per IP per menit
    const rateLimited = checkRouteRateLimit(req, "otp-cancel", 50, 60000);
    if (rateLimited) return rateLimited;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = validateBody(otpCancelSchema, body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { server, id } = validated.data;

    // Cancel on JasaOTP (jangan block refund kalau JasaOTP error)
    let jasaotpError = "";
    try {
      await cancelOrder(server, Number(id));
    } catch (e) {
      jasaotpError = (e as Error).message || "Unknown error";
      console.warn(`[Cancel] JasaOTP cancel error for order ${id}: ${jasaotpError}`);
      // Lanjut proses refund — JasaOTP mungkin sudah cancel sebelumnya
    }

    // Refund balance and update order status atomically
    const order = await db.order.findFirst({
      where: {
        orderId: Number(id),
        server,
        userId: session.user.id,
        status: "waiting",
      },
    });

    if (order) {
      const refunded = await db.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id: order.id, userId: session.user.id, status: "waiting" },
          data: { status: "cancelled" },
        });

        if (updated.count === 0) return false;

        await tx.user.update({
          where: { id: session.user.id },
          data: { balance: { increment: order.price } },
        });

        return true;
      });

      if (refunded) {
        console.log(`[Cancel] Refunded Rp ${order.price} for order ${id} to user ${session.user.id}`);
      } else {
        console.warn(`[Cancel] Skip refund for order ${id}: already processed`);
      }
    } else {
      console.warn(`[Cancel] Order ${id} not found or already cancelled for user ${session.user.id}`);
    }

    logAction(session.user.id, "cancel", JSON.stringify({ orderId: id, server, jasaotpError }));

    return NextResponse.json({
      success: true,
      message: "Pesanan dibatalkan, saldo dikembalikan",
      ...(jasaotpError ? { warning: jasaotpError } : {}),
    });
  } catch (error) {
    console.error("[Cancel] Error:", error);
    return NextResponse.json({ error: "Gagal membatalkan pesanan" }, { status: 500 });
  }
}

