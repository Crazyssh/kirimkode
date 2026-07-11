import { withApiAuthParams } from "@/lib/api-auth";
import { apiMessage, apiError } from "@/lib/api-response";
import { db } from "@/lib/db";
import { cancelOrder } from "@/lib/otp";
import { findOrderByAnyId } from "@/lib/order-lookup";
import { getCancelMinMsFor } from "@/lib/pricing";

export const POST = withApiAuthParams(async (_req, user, params) => {
  const { id } = params;

  const lookup = await findOrderByAnyId(id, user.id);
  if (lookup.status !== "found") {
    return apiError("Order not found", 404, "ORDER_NOT_FOUND");
  }
  if (lookup.order.status !== "waiting") {
    return apiError(
      "Order not found or already completed",
      404,
      "ORDER_NOT_FOUND"
    );
  }
  const order = lookup.order;

  // Cancel rule: per-LAYANAN (admin-configurable) dulu, fallback per-server.
  const cancelMinMs = await getCancelMinMsFor(order.server, order.service);
  const cancelMinSec = cancelMinMs / 1000;
  const diffMs = Date.now() - new Date(order.createdAt).getTime();
  if (diffMs < cancelMinMs) {
    const min = Math.floor(cancelMinSec / 60);
    const sec = cancelMinSec % 60;
    const label = sec > 0 ? `${min} minute(s) ${sec} second(s)` : `${min} minute(s)`;
    return apiError(
      `Cannot cancel within ${label} of order`,
      400,
      "CANCEL_TOO_EARLY"
    );
  }

  let providerWarning: string | undefined;
  try {
    await cancelOrder(
      order.server as "api1" | "api2" | "api3" | "api4" | "api5" | "api6" | "api7" | "api8" | "api9" | "api10",
      order.orderId
    );
  } catch (e) {
    console.warn(`[v1/order/cancel] ${order.server} error (proceeding with refund):`, e);
    providerWarning = `Provider ${order.server} returned an error but refund was processed`;
  }

  const refunded = await db.$transaction(async (tx) => {
    // Claim refund atomically: only transition waiting -> cancelled once.
    const updated = await tx.order.updateMany({
      where: { id: order.id, userId: user.id, status: "waiting" },
      data: { status: "cancelled" },
    });

    if (updated.count === 0) return false;

    await tx.user.update({
      where: { id: user.id },
      data: { balance: { increment: order.price } },
    });

    // api4 (Neptune): stok realtime dari /offers, TIDAK ada stok DB yang perlu di-restore.

    return true;
  });

  if (!refunded) {
    return apiError("Order already processed", 409, "ORDER_ALREADY_PROCESSED");
  }

  return apiMessage(
    providerWarning
      ? `Order cancelled and balance refunded. Warning: ${providerWarning}`
      : "Order cancelled and balance refunded"
  );
});
