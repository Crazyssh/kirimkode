import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, checkRateLimit } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { createOrder, getLayanan } from "@/lib/otp";
import { applyPricing } from "@/lib/pricing";

/**
 * Ambil harga dari server JasaOTP + apply pricing rules.
 * TIDAK BOLEH percaya harga dari client.
 */
async function getServerPrice(server: "api1" | "api2", country: number, service: string): Promise<number> {
  const data = await getLayanan(server, country);
  const key = String(country);

  const serviceData = data?.[key] ?? data?.data?.[key];
  const serviceInfo = serviceData?.[service];

  if (!serviceInfo || typeof serviceInfo.harga !== "number") {
    throw new Error("Service not found or price unavailable");
  }

  return applyPricing(serviceInfo.harga, service, country);
}

export async function POST(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) {
    return NextResponse.json({ status: "error", message: "Invalid API key" }, { status: 401 });
  }
  const rateLimited = checkRateLimit(user.id);
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json();
    const { server = "api1", country = 6, service, operator = "any" } = body;

    if (!service) {
      return NextResponse.json({ status: "error", message: "service is required" }, { status: 400 });
    }

    if (!["api1", "api2"].includes(server)) {
      return NextResponse.json({ status: "error", message: "Invalid server (api1 or api2)" }, { status: 400 });
    }

    // Harga WAJIB dari server, bukan dari client
    const orderPrice = await getServerPrice(server as "api1" | "api2", Number(country), service);

    // Atomic balance check + deduct + order creation
    const result = await db.$transaction(async (tx) => {
      const userData = await tx.user.findUnique({
        where: { id: user.id },
        select: { balance: true },
      });

      if (!userData || userData.balance < orderPrice) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const data = await createOrder(server as "api1" | "api2", Number(country), service, operator);
      const orderId = data?.order_id ?? data?.data?.order_id ?? data?.id;
      const number = data?.number ?? data?.data?.number ?? "";

      if (!orderId || !number) {
        throw new Error(data?.message || "Failed to create order");
      }

      await tx.user.update({
        where: { id: user.id },
        data: { balance: { decrement: orderPrice } },
      });

      await tx.order.create({
        data: {
          userId: user.id,
          server,
          orderId: Number(orderId),
          service,
          serviceName: service,
          country: String(country),
          countryId: Number(country),
          number: String(number),
          price: orderPrice,
          status: "waiting",
          operator,
        },
      });

      return { orderId, number: String(number) };
    });

    return NextResponse.json({
      status: "success",
      data: {
        order_id: result.orderId,
        number: result.number,
        service,
        price: orderPrice,
        expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create order";

    if (msg === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ status: "error", message: "Insufficient balance" }, { status: 402 });
    }

    return NextResponse.json({ status: "error", message: msg }, { status: 500 });
  }
}
