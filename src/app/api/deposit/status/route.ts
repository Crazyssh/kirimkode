import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkPayment as bayarggCheckPayment } from "@/lib/bayargg";
import { checkTransactionStatus } from "@/lib/paymenku";
import { sendDepositSuccessEmail } from "@/lib/mail";

const REFERRAL_COMMISSION_PERCENT = 5;

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

    const deposit = await db.deposit.findUnique({
      where: { trxId: orderId },
    });

    if (!deposit) {
      return NextResponse.json({ error: "Deposit tidak ditemukan" }, { status: 404 });
    }

    if (deposit.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Cek status berdasarkan gateway
    let apiStatus: string;
    let paidAt: string | null = null;
    let totalFee = 0;
    let amountReceived = 0;

    let creditAmount = deposit.amount;

    if (deposit.gateway === "bayargg") {
      const result = await bayarggCheckPayment(orderId);
      console.log(`[BAYAR.GG Status] Check response for ${orderId}:`, JSON.stringify(result));
      apiStatus = result.status;
      paidAt = result.paid_at || null;
      totalFee = 0;
      creditAmount = Math.floor(result.final_amount || result.amount) || deposit.amount;
      amountReceived = creditAmount;
    } else {
      // Legacy: deposit lama yang masih pakai Paymenku
      const result = await checkTransactionStatus(orderId);
      apiStatus = result.data.status;
      paidAt = result.data.paid_at;
      totalFee = Math.floor(parseFloat(result.data.total_fee || "0"));
      amountReceived = Math.floor(parseFloat(result.data.amount_received || result.data.amount));
    }

    // Update deposit & balance if paid
    if (apiStatus === "paid" && deposit.status !== "paid") {
      const processed = await db.$transaction(async (tx) => {
        const freshDeposit = await tx.deposit.findUnique({ where: { trxId: orderId } });
        if (!freshDeposit || freshDeposit.status === "paid") return false;

        await tx.deposit.update({
          where: { trxId: orderId },
          data: {
            status: "paid",
            fee: 0,
            amount: creditAmount,
            totalPaid: creditAmount,
            paidAt: paidAt ? new Date(paidAt) : new Date(),
          },
        });

        await tx.user.update({
          where: { id: deposit.userId },
          data: { balance: { increment: creditAmount } },
        });

        const user = await tx.user.findUnique({
          where: { id: deposit.userId },
          select: { referredBy: true },
        });
        if (user?.referredBy) {
          const commission = Math.floor((deposit.amount * REFERRAL_COMMISSION_PERCENT) / 100);
          if (commission > 0) {
            await tx.user.update({
              where: { id: user.referredBy },
              data: { balance: { increment: commission } },
            });
          }
        }

        return true;
      });

      if (processed) {
        console.log(`[Deposit Status] PAID (${deposit.gateway}): ${orderId} | +Rp ${deposit.amount} for user ${deposit.userId}`);
        try {
          const user = await db.user.findUnique({
            where: { id: deposit.userId },
            select: { email: true, name: true, balance: true },
          });
          if (user?.email) {
            await sendDepositSuccessEmail(user.email, {
              name: user.name || "User",
              amount: deposit.amount,
              trxId: orderId,
              balance: user.balance,
            });
          }
        } catch (e) {
          console.error("[Mail] Email deposit error:", e);
        }
      }
    }

    return NextResponse.json({
      status: "success",
      data: {
        trx_id: orderId,
        reference_id: deposit.referenceId,
        amount: String(deposit.amount),
        total_fee: String(totalFee),
        amount_received: String(amountReceived),
        status: apiStatus,
        payment_channel: { code: deposit.channelCode, name: deposit.channelName },
        paid_at: paidAt,
      },
    });
  } catch (error) {
    console.error("Deposit status error:", error);
    return NextResponse.json(
      { error: "Gagal cek status" },
      { status: 500 }
    );
  }
}
