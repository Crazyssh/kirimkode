import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkTransactionStatus } from "@/lib/paymenku";
import { giveReferralCommission } from "@/lib/referral";

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

      await db.$transaction([
        db.deposit.update({
          where: { trxId },
          data: {
            status: "paid",
            paidAt: apiData.paid_at ? new Date(apiData.paid_at) : new Date(),
            fee,
            totalPaid: amountReceived + fee,
          },
        }),
        db.user.update({
          where: { id: deposit.userId },
          data: { balance: { increment: deposit.amount } },
        }),
      ]);

      // Komisi referral 5% untuk inviter
      await giveReferralCommission(deposit.userId, deposit.amount);

      console.log(`[Paymenku] VERIFIED & PAID: ${trxId} | +Rp ${deposit.amount} for user ${deposit.userId}`);
    } else if (apiStatus === "expired" || apiStatus === "cancelled") {
      await db.deposit.update({
        where: { trxId },
        data: { status: apiStatus },
      });

      console.log(`[Paymenku] VERIFIED & ${apiStatus.toUpperCase()}: ${trxId}`);
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
