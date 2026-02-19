import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, checkRateLimit } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { createOrder } from "@/lib/otp";

export async function POST(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) {
    return NextResponse.json({ status: "error", message: "Invalid API key" }, { status: 401 });
  }
  const rateLimited = checkRateLimit(user.id);
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json();
    const { server = "api1", country = 6, service, operator = "any", price = 0 } = body;

    if (!service) {
      return NextResponse.json({ status: "error", message: "service is required" }, { status: 400 });
    }

    if (!["api1", "api2"].includes(server)) {
      return NextResponse.json({ status: "error", message: "Invalid server (api1 or api2)" }, { status: 400 });
    }

    // Check balance
    const userData = await db.user.findUnique({
      where: { id: user.id },
      select: { balance: true },
    });

    if (price > 0 && (userData?.balance ?? 0) < price) {
      return NextResponse.json({ status: "error", message: "Insufficient balance" }, { status: 402 });
    }

    const data = await createOrder(server, Number(country), service, operator);
    const orderId = data?.order_id ?? data?.data?.order_id ?? data?.id;
    const number = data?.number ?? data?.data?.number ?? "";

    if (!orderId || !number) {
      return NextResponse.json({
        status: "error",
        message: data?.message || "Failed to create order",
      }, { status: 400 });
    }

    // Deduct balance and save order
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { balance: { decrement: price } },
      }),
      db.order.create({
        data: {
          userId: user.id,
          server,
          orderId: Number(orderId),
          service,
          serviceName: service,
          country: String(country),
          countryId: Number(country),
          number: String(number),
          price,
          status: "waiting",
          operator,
        },
      }),
    ]);

    return NextResponse.json({
      status: "success",
      data: {
        order_id: orderId,
        number: String(number),
        service,
        expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create order";
    return NextResponse.json({ status: "error", message: msg }, { status: 500 });
  }
}
