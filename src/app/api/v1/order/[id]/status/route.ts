import { withApiAuthParams } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { db } from "@/lib/db";
import { checkSms } from "@/lib/otp";
import { extractOtp } from "@/lib/otp-extract";
import { findOrderByAnyId } from "@/lib/order-lookup";

export const GET = withApiAuthParams(async (_req, user, params) => {
  const { id } = params;

  const result = await findOrderByAnyId(id, user.id);
  if (result.status !== "found") {
    return apiError("Order not found", 404, "ORDER_NOT_FOUND");
  }
  const order = result.order;

  // If still waiting, poll for OTP
  if (order.status === "waiting" && !order.code) {
    try {
      const data = await checkSms(
        order.server as "api1" | "api2" | "api3" | "api4" | "api5" | "api6" | "api7" | "api8" | "api9" | "api10",
        order.orderId
      );
      const otp = extractOtp(data as Record<string, unknown>);
      if (otp) {
        await db.order.update({
          where: { id: order.id },
          data: { code: otp, status: "success" },
        });
        return apiSuccess({
          id: order.id,
          order_id: order.orderId,
          number: order.number,
          code: otp,
          status: "success",
          received_at: new Date().toISOString(),
        });
      }
    } catch {
      // poll failed, return current status
    }
  }

  return apiSuccess({
    id: order.id,
    order_id: order.orderId,
    number: order.number,
    code: order.code,
    status: order.status,
    received_at: order.code ? order.updatedAt.toISOString() : null,
    wa_check: order.waCheck ? JSON.parse(order.waCheck) : null,
    tg_check: order.tgCheck ? JSON.parse(order.tgCheck) : null,
    checked_at: order.checkedAt?.toISOString() ?? null,
  });
});
