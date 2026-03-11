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

  return apiMessage(
    jasaotpWarning
      ? `Order cancelled and balance refunded. Warning: ${jasaotpWarning}`
      : "Order cancelled and balance refunded"
  );
});
