import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { cancelOrder } from "@/lib/otp";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateApiKey(req);
  if (!user) {
    return NextResponse.json({ status: "error", message: "Invalid API key" }, { status: 401 });
  }

  const { id } = await params;

  const order = await db.order.findFirst({
    where: { id, userId: user.id, status: "waiting" },
  });

  if (!order) {
    return NextResponse.json({ status: "error", message: "Order not found or already completed" }, { status: 404 });
  }

  try {
    await cancelOrder(order.server as "api1" | "api2", order.orderId);
  } catch {
    // JasaOTP cancel may fail
  }

  await db.$transaction([
    db.order.update({
      where: { id: order.id },
      data: { status: "cancelled" },
    }),
    db.user.update({
      where: { id: user.id },
      data: { balance: { increment: order.price } },
    }),
  ]);

  return NextResponse.json({
    status: "success",
    message: "Order dibatalkan, saldo dikembalikan",
  });
}
