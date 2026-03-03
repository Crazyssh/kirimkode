import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

    // Ownership check — user hanya bisa cek deposit miliknya sendiri
    const deposit = await db.deposit.findUnique({
      where: { trxId: orderId },
    });

    if (!deposit) {
      return NextResponse.json({ error: "Deposit tidak ditemukan" }, { status: 404 });
    }

    if (deposit.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await checkTransactionStatus(orderId);

    // Update deposit & balance if paid (atomic transaction + re-check)
    if (result.data.status === "paid" && deposit.status !== "paid") {
      const amountReceived = Math.floor(parseFloat(result.data.amount_received || result.data.amount));
      const totalFee = Math.floor(parseFloat(result.data.total_fee || "0"));

      const processed = await db.$transaction(async (tx) => {
        // Re-check status dalam transaction untuk prevent race condition
        const freshDeposit = await tx.deposit.findUnique({ where: { trxId: orderId } });
        if (!freshDeposit || freshDeposit.status === "paid") return false;

        await tx.deposit.update({
          where: { trxId: orderId },
          data: {
            status: "paid",
            fee: totalFee,
            totalPaid: amountReceived + totalFee,
            paidAt: result.data.paid_at ? new Date(result.data.paid_at) : new Date(),
          },
        });

        await tx.user.update({
          where: { id: deposit.userId },
          data: { balance: { increment: deposit.amount } },
        });

        // Referral commission DALAM transaction
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

      // Kirim email deposit berhasil (di luar transaction)
      if (processed) {
        console.log(`[Deposit Status] PAID: ${orderId} | +Rp ${deposit.amount} for user ${deposit.userId}`);
        try {
          const user = await db.user.findUnique({
            where: { id: deposit.userId },
            select: { email: true, name: true, balance: true },
          });
          if (user?.email) {
            console.log(`[Mail] Sending deposit email to ${user.email}...`);
            await sendDepositSuccessEmail(user.email, {
              name: user.name || "User",
              amount: deposit.amount,
              trxId: orderId,
              balance: user.balance,
            });
            console.log(`[Mail] Deposit email sent to ${user.email}`);
          }
        } catch (e) {
          console.error("[Mail] Email deposit error:", e);
        }
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
      { error: "Gagal cek status" },
      { status: 500 }
    );
  }
}
