import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkWhatsApp, checkTelegram } from "@/lib/checker";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await req.json();
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const order = await db.order.findFirst({
    where: { id: orderId, userId: session.user.id },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Idempotent: skip kalau sudah dicek
  if (order.checkedAt) {
    return NextResponse.json({
      success: true,
      data: {
        waCheck: order.waCheck ? JSON.parse(order.waCheck) : null,
        tgCheck: order.tgCheck ? JSON.parse(order.tgCheck) : null,
      },
    });
  }

  const number = order.number;
  const service = order.service.toLowerCase();

  let waResult = null;
  let tgResult = null;

  if (service === "tg") {
    tgResult = await checkTelegram(number);
  } else if (service === "wa") {
    waResult = await checkWhatsApp(number);
  } else {
    [waResult, tgResult] = await Promise.all([
      checkWhatsApp(number),
      checkTelegram(number),
    ]);
  }

  await db.order.update({
    where: { id: order.id },
    data: {
      waCheck: waResult ? JSON.stringify(waResult) : null,
      tgCheck: tgResult ? JSON.stringify(tgResult) : null,
      checkedAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    data: { waCheck: waResult, tgCheck: tgResult },
  });
}
