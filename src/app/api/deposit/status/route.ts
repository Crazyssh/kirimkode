import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkTransactionStatus } from "@/lib/paymenku";
import { giveReferralCommission } from "@/lib/referral";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");

    if (!orderId) {
      return NextResponse.json(
        { error: "order_id diperlukan" },
        { status: 400 }
      );
    }

    const result = await checkTransactionStatus(orderId);

    // Update deposit & balance if paid
    if (result.data.status === "paid") {
      const deposit = await db.deposit.findUnique({
        where: { trxId: orderId },
      });

      if (deposit && deposit.status !== "paid") {
        const amountReceived = Math.floor(parseFloat(result.data.amount_received || result.data.amount));
        const totalFee = Math.floor(parseFloat(result.data.total_fee || "0"));

        await db.$transaction([
          db.deposit.update({
            where: { trxId: orderId },
            data: {
              status: "paid",
              fee: totalFee,
              totalPaid: amountReceived + totalFee,
              paidAt: result.data.paid_at ? new Date(result.data.paid_at) : new Date(),
            },
          }),
          db.user.update({
            where: { id: deposit.userId },
            data: { balance: { increment: deposit.amount } },
          }),
        ]);

        // Komisi referral 5% untuk inviter
        await giveReferralCommission(deposit.userId, deposit.amount);
      }
    }

    return NextResponse.json({
      status: "success",
      data: {
        trx_id: result.data.trx_id,
        reference_id: result.data.reference_id,
        amount: result.data.amount,
        total_fee: result.data.total_fee,
        amount_received: result.data.amount_received,
        status: result.data.status,
        payment_channel: result.data.payment_channel,
        paid_at: result.data.paid_at,
      },
    });
  } catch (error) {
    console.error("Deposit status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal cek status" },
      { status: 500 }
    );
  }
}
