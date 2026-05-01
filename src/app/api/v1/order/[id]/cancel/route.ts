import { withApiAuthParams } from "@/lib/api-auth";
import { apiMessage, apiError } from "@/lib/api-response";
import { db } from "@/lib/db";
import { cancelOrder } from "@/lib/otp";

export const POST = withApiAuthParams(async (_req, user, params) => {
  const { id } = params;

  const order = await db.order.findFirst({
    where: { id, userId: user.id, status: "waiting" },
  });

  if (!order) {
    return apiError("Order not found or already completed", 404, "ORDER_NOT_FOUND");
  }

  // Check 3-minute rule
  const diffMs = Date.now() - new Date(order.createdAt).getTime();
  if (diffMs < 3 * 60 * 1000) {
    return apiError("Cannot cancel within 3 minutes of order", 400, "CANCEL_TOO_EARLY");
  }

  let jasaotpWarning: string | undefined;
  try {
    await cancelOrder(order.server as "api1" | "api2", order.orderId);
  } catch (e) {
    console.warn("[v1/order/cancel] JasaOTP error (proceeding with refund):", e);
    jasaotpWarning = "JasaOTP returned an error but refund was processed";
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

    // api4: restore stock manual entry (+1)
    if (order.server === "api4") {
      const country = await tx.providerCountry.findUnique({
        where: {
          serverId_externalId: { serverId: "api4", externalId: order.countryId },
        },
        select: { id: true },
      });
      if (country) {
        await tx.providerService.updateMany({
          where: {
            serverId: "api4",
            countryId: country.id,
            code: order.service,
          },
          data: { stock: { increment: 1 } },
        });
      }
    }

    return true;
  });

  if (!refunded) {
    return apiError("Order already processed", 409, "ORDER_ALREADY_PROCESSED");
  }

  return apiMessage(
    jasaotpWarning
      ? `Order cancelled and balance refunded. Warning: ${jasaotpWarning}`
      : "Order cancelled and balance refunded"
  );
});
