import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { checkSms } from "@/lib/otp";
import { extractOtp } from "@/lib/otp-extract";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateApiKey(req);
  if (!user) {
    return NextResponse.json({ status: "error", message: "Invalid API key" }, { status: 401 });
  }

  const { id } = await params;

  const order = await db.order.findFirst({
    where: { id, userId: user.id },
  });

  if (!order) {
    return NextResponse.json({ status: "error", message: "Order not found" }, { status: 404 });
  }

  // If still waiting, poll for OTP
  if (order.status === "waiting" && !order.code) {
    try {
      const data = await checkSms(order.server as "api1" | "api2", order.orderId);
      const otp = extractOtp(data as Record<string, unknown>);
      if (otp) {
        await db.order.update({
          where: { id: order.id },
          data: { code: otp, status: "success" },
        });
        return NextResponse.json({
          status: "success",
          data: {
            order_id: order.id,
            number: order.number,
            code: otp,
            status: "success",
            received_at: new Date().toISOString(),
          },
        });
      }
    } catch {
      // poll failed, return current status
    }
  }

  return NextResponse.json({
    status: "success",
    data: {
      order_id: order.id,
      number: order.number,
      code: order.code,
      status: order.status,
      received_at: order.code ? order.updatedAt.toISOString() : null,
      wa_check: order.waCheck ? JSON.parse(order.waCheck) : null,
      tg_check: order.tgCheck ? JSON.parse(order.tgCheck) : null,
      checked_at: order.checkedAt?.toISOString() ?? null,
    },
  });
}

