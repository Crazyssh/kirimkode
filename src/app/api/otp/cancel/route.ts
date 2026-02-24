import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cancelOrder } from "@/lib/otp";
import { checkRouteRateLimit } from "@/lib/rate-limit";

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
    const { server, id } = body;

    if (!server || !["api1", "api2"].includes(server)) {
      return NextResponse.json({ error: "Server parameter required (api1 or api2)" }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({ error: "Parameter id diperlukan" }, { status: 400 });
    }

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

    return NextResponse.json({ success: true, message: "Pesanan dibatalkan, saldo dikembalikan" });
  } catch {
    return NextResponse.json({ error: "Gagal membatalkan pesanan" }, { status: 500 });
  }
}
