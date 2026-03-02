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

    // Cancel on JasaOTP
    await cancelOrder(server, Number(id));

    // Refund balance and update order status
    const order = await db.order.findFirst({
      where: {
        orderId: Number(id),
        server,
        userId: session.user.id,
        status: "waiting",
      },
    });

    if (order) {
      await db.$transaction([
        db.order.update({
          where: { id: order.id },
          data: { status: "cancelled" },
        }),
        db.user.update({
          where: { id: session.user.id },
          data: { balance: { increment: order.price } },
        }),
      ]);
    }

    logAction(session.user.id, "cancel", JSON.stringify({ orderId: id, server }));

    return NextResponse.json({ success: true, message: "Pesanan dibatalkan, saldo dikembalikan" });
  } catch {
    return NextResponse.json({ error: "Gagal membatalkan pesanan" }, { status: 500 });
  }
}
