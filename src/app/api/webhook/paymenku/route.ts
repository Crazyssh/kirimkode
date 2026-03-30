import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkTransactionStatus } from "@/lib/paymenku";
import { giveReferralCommission } from "@/lib/referral";
import { sendDepositSuccessEmail } from "@/lib/mail";

/**
 * Webhook handler untuk Paymenku
 *
 * Karena Paymenku tidak menyediakan webhook secret/signature,
 * kita pakai strategi CALLBACK VERIFICATION:
 *   1. Terima webhook sebagai trigger saja
 *   2. Panggil check-status API Paymenku untuk verifikasi langsung
 *   3. Cocokkan data dari API dengan database internal
 *   4. Baru proses update balance
 *
 * Set callback URL di dashboard merchant Paymenku:
 * https://yourdomain.com/api/webhook/paymenku
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("[Paymenku Webhook] Received:", JSON.stringify(body, null, 2));

    // Ambil trx_id dari webhook payload (hanya sebagai trigger)
    const trxId: string | undefined = body?.trx_id;
    if (!trxId) {
      console.warn("[Paymenku Webhook] Missing trx_id in payload");
      return NextResponse.json({ status: "ignored" });
    }

    // Cek apakah deposit dengan trx_id ini ada di database kita
    const deposit = await db.deposit.findUnique({
      where: { trxId },
    });

    if (!deposit) {
      console.log(`[Paymenku Webhook] Deposit not found: ${trxId}`);
      return NextResponse.json({ status: "not_found" });
    }

    // Sudah diproses sebelumnya (idempotency)
    if (deposit.status !== "pending") {
      console.log(`[Paymenku Webhook] Already processed: ${trxId} (${deposit.status})`);
      return NextResponse.json({ status: "already_processed" });
    }

    // === CALLBACK VERIFICATION ===
    // Jangan percaya webhook payload — verifikasi langsung ke API Paymenku
    const verified = await checkTransactionStatus(trxId);

    if (verified.status !== "success" || !verified.data) {
      console.error(`[Paymenku Webhook] Verification failed for ${trxId}:`, verified);
      return NextResponse.json({ status: "verification_failed" });
    }

    const apiData = verified.data;

    // Cocokkan reference_id untuk memastikan ini memang transaksi kita
    if (apiData.reference_id !== deposit.referenceId) {
      console.error(`[Paymenku Webhook] Reference ID mismatch: API=${apiData.reference_id}, DB=${deposit.referenceId}`);
      return NextResponse.json({ status: "mismatch" });
    }

    // Cocokkan amount
    const apiAmount = Math.floor(parseFloat(apiData.amount));
    if (apiAmount !== deposit.amount) {
      console.error(`[Paymenku Webhook] Amount mismatch: API=${apiAmount}, DB=${deposit.amount}`);
      return NextResponse.json({ status: "mismatch" });
    }

    // Proses berdasarkan status DARI API (bukan dari webhook payload)
    const apiStatus = apiData.status;

    if (apiStatus === "paid") {
      const fee = Math.floor(parseFloat(apiData.total_fee || "0"));
      const amountReceived = Math.floor(parseFloat(apiData.amount_received || "0"));

      // Interactive transaction dengan re-check untuk prevent race condition
      // (Paymenku bisa kirim webhook 2x hampir bersamaan)
      const processed = await db.$transaction(async (tx) => {
        const claimed = await tx.deposit.updateMany({
          where: { trxId, status: "pending" },
          data: {
            status: "paid",
            paidAt: apiData.paid_at ? new Date(apiData.paid_at) : new Date(),
            fee,
            totalPaid: amountReceived + fee,
          },
        });

        if (claimed.count === 0) {
          console.log(`[Paymenku Webhook] Race condition prevented: ${trxId} already processed`);
          return false;
        }

        await tx.user.update({
          where: { id: deposit.userId },
          data: { balance: { increment: deposit.amount } },
        });
        return true;
      });

      if (!processed) {
        return NextResponse.json({ status: "already_processed" });
      }

      console.log(`[Paymenku] VERIFIED & PAID: ${trxId} | +Rp ${deposit.amount} for user ${deposit.userId}`);

      // Komisi referral (non-blocking, jangan block email)
      try {
        await giveReferralCommission(deposit.userId, deposit.amount);
      } catch (e) {
        console.error("[Paymenku] Referral commission error:", e);
      }

      // Kirim email notifikasi deposit berhasil
      try {
        const user = await db.user.findUnique({ where: { id: deposit.userId }, select: { email: true, name: true, balance: true } });
        if (user?.email) {
          console.log(`[Mail] Sending deposit email to ${user.email}...`);
          await sendDepositSuccessEmail(user.email, {
            name: user.name || "User",
            amount: deposit.amount,
            trxId,
            balance: user.balance,
          });
          console.log(`[Mail] Deposit email sent to ${user.email}`);
        } else {
          console.warn(`[Mail] No email found for user ${deposit.userId}`);
        }
      } catch (e) {
        console.error("[Mail] Email deposit error:", e);
      }
    } else if (apiStatus === "expired" || apiStatus === "cancelled") {
      const updated = await db.deposit.updateMany({
        where: { trxId, status: "pending" },
        data: { status: apiStatus },
      });

      if (updated.count > 0) {
        console.log(`[Paymenku] VERIFIED & ${apiStatus.toUpperCase()}: ${trxId}`);
      }
    } else {
      console.log(`[Paymenku] Status still ${apiStatus} for ${trxId} — no action`);
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
