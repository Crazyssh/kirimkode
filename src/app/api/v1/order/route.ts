import { withApiAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { db } from "@/lib/db";
import { createOrder, getLayanan } from "@/lib/otp";
import { applyPricing, applyServerExtraMarkup, getOrderTimeoutMs } from "@/lib/pricing";

type PublicServer = "api1" | "api2" | "api3" | "api4" | "api5" | "api6" | "api7" | "api8" | "api9";
const VALID_SERVERS: readonly PublicServer[] = ["api1", "api2", "api3", "api4", "api5", "api6", "api7", "api8", "api9"];

// Provider yang harganya sudah final (USD→IDR + markup di adapter, atau langsung IDR) — skip applyPricing.
const FINAL_PRICE_SERVERS = new Set<PublicServer>(["api3", "api4", "api6", "api9"]);

/**
 * Ambil harga dari server provider + apply pricing rules untuk api1/api2 saja.
 * TIDAK BOLEH percaya harga dari client.
 */
async function getServerPrice(
  server: PublicServer,
  country: number,
  service: string
): Promise<number> {
  const data = await getLayanan(server, country);
  const key = String(country);

  const serviceData = data?.[key] ?? data?.data?.[key];
  const serviceInfo = serviceData?.[service];

  if (!serviceInfo || typeof serviceInfo.harga !== "number") {
    throw new Error("Service not found or price unavailable");
  }

  if (FINAL_PRICE_SERVERS.has(server)) {
    // api3/api4 sudah USD→IDR + markup, gak perlu applyPricing lagi
    return serviceInfo.harga;
  }

  const result = await applyPricing(serviceInfo.harga, service, country);
  return applyServerExtraMarkup(result.price, server);
}

export const POST = withApiAuth(async (req, user) => {
  try {
    const body = await req.json();
    const { server = "api1", country = 6, service, operator = "any" } = body;

    if (!service) {
      return apiError("service is required", 400, "MISSING_FIELDS");
    }

    if (!VALID_SERVERS.includes(server)) {
      return apiError(
        "Invalid server (api1, api2, api3, api4, api5, api6, api7, api8, or api9)",
        400,
        "INVALID_SERVER"
      );
    }

    // Harga WAJIB dari server, bukan dari client
    const orderPrice = await getServerPrice(
      server as PublicServer,
      Number(country),
      service
    );

    // Atomic balance check + deduct + order creation
    const result = await db.$transaction(async (tx) => {
      const userData = await tx.user.findUnique({
        where: { id: user.id },
        select: { balance: true },
      });

      if (!userData || userData.balance < orderPrice) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const data = await createOrder(
        server as PublicServer,
        Number(country),
        service,
        operator
      );
      const orderId = data?.order_id ?? data?.data?.order_id ?? data?.id;
      const number = data?.number ?? data?.data?.number ?? "";

      if (!orderId || !number) {
        throw new Error(data?.message || "Failed to create order");
      }

      await tx.user.update({
        where: { id: user.id },
        data: { balance: { decrement: orderPrice } },
      });

      const dbOrder = await tx.order.create({
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
          source: "api",
        },
      });

      return { id: dbOrder.id, orderId, number: String(number) };
    });

    return apiSuccess({
      id: result.id,
      order_id: result.orderId,
      number: result.number,
      service,
      server,
      price: orderPrice,
      expires_at: new Date(Date.now() + getOrderTimeoutMs(server)).toISOString(),
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
