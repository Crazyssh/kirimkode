import { withApiAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
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

  const result = await applyPricing(serviceInfo.harga, service, country);
  return result.price;
}

export const POST = withApiAuth(async (req, user) => {
  try {
    const body = await req.json();
    const { server = "api1", country = 6, service, operator = "any" } = body;

    if (!service) {
      return apiError("service is required", 400, "MISSING_FIELDS");
    }

    if (!["api1", "api2"].includes(server)) {
      return apiError("Invalid server (api1 or api2)", 400, "INVALID_SERVER");
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

    return apiSuccess({
      order_id: result.orderId,
      number: result.number,
      service,
      price: orderPrice,
      expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : "";

    if (rawMsg === "INSUFFICIENT_BALANCE") {
      return apiError("Insufficient balance", 402, "INSUFFICIENT_BALANCE");
    }

    const isStock = /stok|stock|habis|unavailable|empty|sold.?out|not.?available|no.?number/i.test(rawMsg);
    if (isStock) {
      return apiError("Out of stock for this service", 409, "OUT_OF_STOCK");
    }

    return apiError("Failed to create order", 500, "ORDER_FAILED");
  }
});
