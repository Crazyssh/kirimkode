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
    const rawVerified = await checkPayment(invoiceId);
    console.log(`[BAYAR.GG Webhook] Verification response:`, JSON.stringify(rawVerified));
    // Handle nested response: { data: { status } } or { status }
    const verified = (rawVerified as any).data || rawVerified;

    if (!rawVerified.success && !(rawVerified as any).data) {
      console.error(`[BAYAR.GG Webhook] Verification failed for ${invoiceId}:`, verified);
      return NextResponse.json({ status: "verification_failed" });
    }

    // Cocokkan amount
    if (verified.amount !== deposit.amount) {
      console.error(`[BAYAR.GG Webhook] Amount mismatch: API=${verified.amount}, DB=${deposit.amount}`);
      return NextResponse.json({ status: "mismatch" });
    }

    if (verified.status === "paid") {
      // Saldo yang masuk = final_amount (termasuk kode unik)
      // Supaya user tidak rugi bayar lebih dari saldo yang didapat
      const creditAmount = verified.final_amount || deposit.amount;

      // Interactive transaction dengan re-check
      const processed = await db.$transaction(async (tx) => {
        const freshDeposit = await tx.deposit.findUnique({ where: { trxId: invoiceId } });
        if (!freshDeposit || freshDeposit.status !== "pending") {
          console.log(`[BAYAR.GG Webhook] Race condition prevented: ${invoiceId}`);
          return false;
        }

        await tx.deposit.update({
          where: { trxId: invoiceId },
          data: {
            status: "paid",
            paidAt: verified.paid_at ? new Date(verified.paid_at) : new Date(),
            fee: 0,
            amount: creditAmount,
            totalPaid: creditAmount,
          },
        });
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
      await db.deposit.update({
        where: { trxId: invoiceId },
        data: { status: verified.status },
      });

      console.log(`[BAYAR.GG] VERIFIED & ${verified.status.toUpperCase()}: ${invoiceId}`);
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
