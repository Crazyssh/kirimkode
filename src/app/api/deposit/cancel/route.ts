import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkTransactionStatus } from "@/lib/paymenku";
import { checkPayment as bayarggCheckPayment } from "@/lib/bayargg";
import { giveReferralCommission } from "@/lib/referral";
import { sendDepositSuccessEmail } from "@/lib/mail";
import { logAction } from "@/lib/audit";
import { checkRouteRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/deposit/cancel
 * Body: { trx_id: string }
 *
 * Membatalkan deposit yang masih pending.
 *
 * Race-protection:
 *  1. Sebelum mark cancelled, verify ke gateway (Paymenku/BAYAR.GG).
 *  2. Kalau gateway bilang sudah "paid" — JANGAN cancel, proses sebagai paid.
 *  3. Atomic updateMany dengan filter status="pending" mencegah double-action.
 *
 * Catatan: Paymenku/BAYAR.GG tidak punya endpoint cancel publik —
 * untuk VA/QRIS, transaksi akan auto-expire kalau tidak dibayar.
 * Kita hanya menandai cancelled di DB supaya UI bisa lepas dari state "pending"
 * dan user bisa bikin deposit baru tanpa terkena limit pending count.
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimited = checkRouteRateLimit(req, "deposit-cancel", 20, 60000);
    if (rateLimited) return rateLimited;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const trxId = typeof body?.trx_id === "string" ? body.trx_id.trim() : "";
    if (!trxId) {
      return NextResponse.json({ error: "trx_id diperlukan" }, { status: 400 });
    }

    const deposit = await db.deposit.findUnique({ where: { trxId } });
    if (!deposit) {
      return NextResponse.json(
        { error: "Deposit tidak ditemukan" },
        { status: 404 }
      );
    }

    if (deposit.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (deposit.status !== "pending") {
      return NextResponse.json(
        {
          status: "noop",
          message: `Deposit sudah berstatus ${deposit.status}, tidak bisa dibatalkan.`,
          data: { status: deposit.status },
        },
        { status: 409 }
      );
    }

    // === VERIFY ke gateway dulu ===
    // Manual QRIS tidak punya gateway check — langsung mark cancelled.
    let apiStatus: string = "pending";
    let paidAt: string | null = null;
    let totalFee = 0;
    let amountReceived = deposit.amount;

    if (deposit.gateway === "paymenku") {
      try {
        const result = await checkTransactionStatus(trxId);
        if (result.status === "success" && result.data) {
          apiStatus = result.data.status;
          paidAt = result.data.paid_at;
          totalFee = Math.floor(parseFloat(result.data.total_fee || "0"));
          amountReceived = Math.floor(
            parseFloat(result.data.amount_received || result.data.amount)
          );
        }
      } catch (e) {
        console.warn(
          `[Deposit Cancel] Paymenku verify gagal ${trxId}, lanjut cancel:`,
          e
        );
      }
    } else if (deposit.gateway === "bayargg") {
      try {
        const result = await bayarggCheckPayment(trxId);
        if (result.status && result.status !== "unknown") {
          apiStatus = result.status;
          paidAt = result.paid_at || null;
        }
      } catch (e) {
        console.warn(
          `[Deposit Cancel] BAYAR.GG verify gagal ${trxId}, lanjut cancel:`,
          e
        );
      }
    }

    // === Kalau ternyata sudah paid, proses paid bukan cancel ===
    if (apiStatus === "paid") {
      const fee = deposit.gateway === "paymenku" ? totalFee : 0;
      const totalPaid = deposit.gateway === "paymenku"
        ? amountReceived + totalFee
        : deposit.amount;

      const processed = await db.$transaction(async (tx) => {
        const claimed = await tx.deposit.updateMany({
          where: { trxId, status: "pending" },
          data: {
            status: "paid",
            paidAt: paidAt ? new Date(paidAt) : new Date(),
            fee,
            totalPaid,
          },
        });
        if (claimed.count === 0) return false;

        await tx.user.update({
          where: { id: deposit.userId },
          data: { balance: { increment: deposit.amount } },
        });
        return true;
      });

      if (processed) {
        console.log(
          `[Deposit Cancel] Was already PAID, credited instead: ${trxId} | +Rp ${deposit.amount}`
        );

        try {
          await giveReferralCommission(deposit.userId, deposit.amount);
        } catch (e) {
          console.error("[Deposit Cancel] Referral commission error:", e);
        }

        try {
          const user = await db.user.findUnique({
            where: { id: deposit.userId },
            select: { email: true, name: true, balance: true },
          });
          if (user?.email) {
            sendDepositSuccessEmail(user.email, {
              name: user.name || "User",
              amount: deposit.amount,
              trxId,
              balance: user.balance,
            }).catch((e) =>
              console.error("[Mail] Email deposit cancel→paid error:", e)
            );
          }
        } catch (e) {
          console.error("[Mail] Email lookup error:", e);
        }
      }

      return NextResponse.json({
        status: "paid",
        message:
          "Pembayaran sudah berhasil terdeteksi. Deposit tidak dapat dibatalkan, saldo sudah ditambahkan.",
        data: { status: "paid" },
      });
    }

    // === Kalau sudah terminal non-paid di gateway, sync DB saja ===
    if (
      apiStatus === "expired" ||
      apiStatus === "cancelled" ||
      apiStatus === "failed" ||
      apiStatus === "refunded"
    ) {
      await db.deposit.updateMany({
        where: { trxId, status: "pending" },
        data: { status: apiStatus },
      });
      return NextResponse.json({
        status: apiStatus,
        message: `Deposit sudah ${apiStatus} di payment gateway.`,
        data: { status: apiStatus },
      });
    }

    // === Mark cancelled (atomic) ===
    const cancelled = await db.deposit.updateMany({
      where: { trxId, status: "pending" },
      data: { status: "cancelled" },
    });

    if (cancelled.count === 0) {
      // Status berubah di sela-sela check & update. Re-read untuk balasan akurat.
      const fresh = await db.deposit.findUnique({
        where: { trxId },
        select: { status: true },
      });
      return NextResponse.json({
        status: fresh?.status || "unknown",
        message: "Status deposit berubah, silakan refresh.",
        data: { status: fresh?.status || "unknown" },
      });
    }

    logAction(
      session.user.id,
      "deposit_cancel",
      JSON.stringify({ trxId, amount: deposit.amount, gateway: deposit.gateway })
    );

    console.log(
      `[Deposit Cancel] CANCELLED: ${trxId} | user=${deposit.userId} | gateway=${deposit.gateway}`
    );

    return NextResponse.json({
      status: "cancelled",
      message: "Deposit berhasil dibatalkan.",
      data: { status: "cancelled" },
    });
  } catch (error) {
    console.error("[Deposit Cancel] Error:", error);
    return NextResponse.json(
      { error: "Gagal membatalkan deposit" },
      { status: 500 }
    );
  }
}
