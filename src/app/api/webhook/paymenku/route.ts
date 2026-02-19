import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { WebhookPayload } from "@/lib/paymenku";

/**
 * Webhook handler untuk Paymenku
 * Set callback URL di dashboard merchant Paymenku:
 * https://yourdomain.com/api/webhook/paymenku
 */
export async function POST(req: NextRequest) {
  try {
    const payload: WebhookPayload = await req.json();

    console.log("[Paymenku Webhook]", JSON.stringify(payload, null, 2));

    if (payload.event !== "payment.status_updated") {
      return NextResponse.json({ status: "ignored" });
    }

    const { trx_id, status } = payload;

    const deposit = await db.deposit.findUnique({
      where: { trxId: trx_id },
    });

    if (!deposit) {
      console.log(`[Paymenku] Deposit not found: ${trx_id}`);
      return NextResponse.json({ status: "not_found" });
    }

    if (status === "paid" && deposit.status !== "paid") {
      // Update deposit status and add balance
      await db.$transaction([
        db.deposit.update({
          where: { trxId: trx_id },
          data: {
            status: "paid",
            paidAt: payload.paid_at ? new Date(payload.paid_at) : new Date(),
            fee: Math.floor(parseFloat(payload.total_fee || "0")),
            totalPaid: Math.floor(parseFloat(payload.amount_received || "0")) + Math.floor(parseFloat(payload.total_fee || "0")),
          },
        }),
        db.user.update({
          where: { id: deposit.userId },
          data: { balance: { increment: deposit.amount } },
        }),
      ]);

      console.log(`[Paymenku] PAID: ${trx_id} | +${deposit.amount} for user ${deposit.userId}`);
    } else if ((status === "expired" || status === "cancelled") && deposit.status === "pending") {
      await db.deposit.update({
        where: { trxId: trx_id },
        data: { status },
      });

      console.log(`[Paymenku] ${status.toUpperCase()}: ${trx_id}`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[Paymenku Webhook Error]", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
