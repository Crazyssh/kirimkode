import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkPayment } from "@/lib/bayargg";
import { giveReferralCommission } from "@/lib/referral";
import { sendDepositSuccessEmail } from "@/lib/mail";

/**
 * Webhook handler untuk BAYAR.GG
 *
 * Strategy: CALLBACK VERIFICATION
 *   1. Terima webhook sebagai trigger
 *   2. Panggil check-payment API BAYAR.GG untuk verifikasi
 *   3. Cocokkan data → update balance
 *
 * Set callback URL di BAYAR.GG:
 * https://yourdomain.com/api/webhook/bayargg
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("[BAYAR.GG Webhook] Received:", JSON.stringify(body, null, 2));

    // Ambil invoice_id dari webhook payload
    const invoiceId: string | undefined = body?.invoice_id || body?.data?.invoice_id;
    if (!invoiceId) {
      console.warn("[BAYAR.GG Webhook] Missing invoice_id in payload");
      return NextResponse.json({ status: "ignored" });
    }

    // Cek deposit di database
    const deposit = await db.deposit.findUnique({
      where: { trxId: invoiceId },
    });

    if (!deposit) {
      console.log(`[BAYAR.GG Webhook] Deposit not found: ${invoiceId}`);
      return NextResponse.json({ status: "not_found" });
    }

    // Idempotency
    if (deposit.status !== "pending") {
      console.log(`[BAYAR.GG Webhook] Already processed: ${invoiceId} (${deposit.status})`);
      return NextResponse.json({ status: "already_processed" });
    }

    // === CALLBACK VERIFICATION ===
    // checkPayment() sudah normalize response (flat/nested) dan tidak throw error
    const verified = await checkPayment(invoiceId);
    console.log(`[BAYAR.GG Webhook] Verification response:`, JSON.stringify(verified));

    if (verified.status === "unknown") {
      console.error(`[BAYAR.GG Webhook] Verification failed for ${invoiceId}:`, verified);
      return NextResponse.json({ status: "verification_failed" });
    }

    // Cocokkan amount (skip jika API return 0 = data tidak lengkap)
    if (verified.amount !== 0 && verified.amount !== deposit.amount) {
      console.error(`[BAYAR.GG Webhook] Amount mismatch: API=${verified.amount}, DB=${deposit.amount}`);
      return NextResponse.json({ status: "mismatch" });
    }

    if (verified.status === "paid") {
      // Saldo yang masuk = final_amount (termasuk kode unik)
      // Supaya user tidak rugi bayar lebih dari saldo yang didapat
      const creditAmount = Math.floor(verified.final_amount || verified.amount) || deposit.amount;

      // Interactive transaction dengan re-check
      const processed = await db.$transaction(async (tx) => {
        const claimed = await tx.deposit.updateMany({
          where: { trxId: invoiceId, status: "pending" },
          data: {
            status: "paid",
            paidAt: verified.paid_at ? new Date(verified.paid_at) : new Date(),
            fee: 0,
            amount: creditAmount,
            totalPaid: creditAmount,
          },
        });

        if (claimed.count === 0) {
          console.log(`[BAYAR.GG Webhook] Race condition prevented: ${invoiceId}`);
          return false;
        }

        await tx.user.update({
          where: { id: deposit.userId },
          data: { balance: { increment: creditAmount } },
        });
        return true;
      });

      if (!processed) {
        return NextResponse.json({ status: "already_processed" });
      }

      console.log(`[BAYAR.GG] VERIFIED & PAID: ${invoiceId} | +Rp ${creditAmount} (incl unique code) for user ${deposit.userId}`);

      // Komisi referral (non-blocking)
      try {
        await giveReferralCommission(deposit.userId, creditAmount);
      } catch (e) {
        console.error("[BAYAR.GG] Referral commission error:", e);
      }

      // Email notifikasi
      try {
        const user = await db.user.findUnique({ where: { id: deposit.userId }, select: { email: true, name: true, balance: true } });
        if (user?.email) {
          console.log(`[Mail] Sending deposit email to ${user.email}...`);
          await sendDepositSuccessEmail(user.email, {
            name: user.name || "User",
            amount: deposit.amount,
            trxId: invoiceId,
            balance: user.balance,
          });
          console.log(`[Mail] Deposit email sent to ${user.email}`);
        }
      } catch (e) {
        console.error("[Mail] Email deposit error:", e);
      }
    } else if (verified.status === "expired" || verified.status === "cancelled") {
      const updated = await db.deposit.updateMany({
        where: { trxId: invoiceId, status: "pending" },
        data: { status: verified.status },
      });

      if (updated.count > 0) {
        console.log(`[BAYAR.GG] VERIFIED & ${verified.status.toUpperCase()}: ${invoiceId}`);
      }
    } else {
      console.log(`[BAYAR.GG] Status still ${verified.status} for ${invoiceId} — no action`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[BAYAR.GG Webhook Error]", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
