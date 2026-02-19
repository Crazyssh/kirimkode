import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createOrder } from "@/lib/otp";
import { logAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { server, negara, layanan, operator, serviceName, countryName, price } = body;

    if (!server || !["api1", "api2"].includes(server)) {
      return NextResponse.json({ error: "Server parameter required (api1 or api2)" }, { status: 400 });
    }

    if (!negara || !layanan || !operator) {
      return NextResponse.json({ error: "Parameter negara, layanan, dan operator diperlukan" }, { status: 400 });
    }

    // Check user balance
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const orderPrice = price || 0;

    if (orderPrice > 0 && user.balance < orderPrice) {
      return NextResponse.json(
        { error: "Saldo tidak cukup. Silakan deposit terlebih dahulu." },
        { status: 402 }
      );
    }

    const data = await createOrder(server, Number(negara), layanan, operator);

    // Extract order info from JasaOTP response
    const orderId = data?.order_id ?? data?.data?.order_id ?? data?.id;
    const number = data?.number ?? data?.data?.number ?? "";

    if (!orderId || !number) {
      return NextResponse.json({
        success: false,
        message: data?.message || "Gagal membuat pesanan, respons tidak valid",
      }, { status: 400 });
    }

    // Deduct balance and save order in a transaction
    await db.$transaction([
      db.user.update({
        where: { id: session.user.id },
        data: { balance: { decrement: orderPrice } },
      }),
      db.order.create({
        data: {
          userId: session.user.id,
          server,
          orderId: Number(orderId),
          service: layanan,
          serviceName: serviceName || layanan,
          country: countryName || String(negara),
          countryId: Number(negara),
          number: String(number),
          price: orderPrice,
          status: "waiting",
          operator: operator || "any",
        },
      }),
    ]);

    logAction(session.user.id, "order", JSON.stringify({ orderId, service: layanan, server }));

    return NextResponse.json({
      success: true,
      data: {
        order_id: orderId,
        number: String(number),
      },
    });
  } catch (error) {
    console.error("Order error:", error);
    const msg = error instanceof Error ? error.message : "Gagal membuat pesanan";
    return NextResponse.json({ error: msg, message: msg }, { status: 500 });
  }
}
