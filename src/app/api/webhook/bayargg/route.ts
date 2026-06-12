import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkPayment, verifyWebhookSignature } from "@/lib/bayargg";
import { giveReferralCommission } from "@/lib/referral";
import { sendDepositSuccessEmail } from "@/lib/mail";

/**
 * Webhook handler untuk BAYAR.GG v2
 *
 * Strategy: SIGNATURE VERIFICATION + CALLBACK VERIFICATION fallback
 *   1. Verifikasi HMAC signature dari header X-Webhook-Signature
 *   2. Jika signature valid, proses langsung dari payload
 *   3. Jika signature tidak ada/invalid, fallback ke check-payment API
 *
 * Webhook headers (v2):
 *   X-Webhook-Event: payment.paid
 *   X-Webhook-Signature: HMAC SHA256 signature
 *   X-Webhook-Timestamp: Unix timestamp
 *   X-Invoice-ID: Invoice ID
 *
 * Set callback URL di BAYAR.GG:
 * https://yourdomain.com/api/webhook/bayargg
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("[BAYAR.GG Webhook] Received:", JSON.stringify(body, null, 2));

    // v2 headers
    const webhookSignature = req.headers.get("x-webhook-signature") || "";
    const webhookTimestamp = req.headers.get("x-webhook-timestamp") || "";
    const webhookEvent = req.headers.get("x-webhook-event") || "";

    // Ambil invoice_id dari webhook payload
    const invoiceId: string | undefined = body?.invoice_id || body?.data?.invoice_id;
    if (!invoiceId) {
      console.warn("[BAYAR.GG Webhook] Missing invoice_id in payload");
      return NextResponse.json({ status: "ignored" });
    }

    // === SIGNATURE VERIFICATION (v2) ===
    let signatureValid = false;
    if (webhookSignature && webhookTimestamp) {
      signatureValid = await verifyWebhookSignature(
        invoiceId,
        body.status || "",
        body.final_amount || 0,
        webhookTimestamp,
        webhookSignature
      );

      if (!signatureValid) {
        console.warn(`[BAYAR.GG Webhook] Invalid signature for ${invoiceId}`);
      } else {
        console.log(`[BAYAR.GG Webhook] Signature verified for ${invoiceId} (event: ${webhookEvent})`);
      }
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

    // Tentukan status & data dari signature atau fallback ke API check
    let verifiedStatus: string;
    let verifiedAmount: number;
    let verifiedFinalAmount: number;
    let verifiedPaidAt: string | null;

    if (signatureValid) {
      // Signature valid — trust payload langsung
      verifiedStatus = body.status || "unknown";
      verifiedAmount = body.amount || 0;
      verifiedFinalAmount = body.final_amount || body.amount || 0;
      verifiedPaidAt = body.paid_at || null;
    } else {
      // Fallback: verifikasi via check-payment API
      const verified = await checkPayment(invoiceId);
      console.log(`[BAYAR.GG Webhook] Fallback verification response:`, JSON.stringify(verified));

      if (verified.status === "unknown") {
        console.error(`[BAYAR.GG Webhook] Verification failed for ${invoiceId}:`, verified);
        return NextResponse.json({ status: "verification_failed" });
      }

      verifiedStatus = verified.status;
      verifiedAmount = verified.amount;
      verifiedFinalAmount = verified.final_amount || verified.amount;
      verifiedPaidAt = verified.paid_at || null;
    }

    // Cocokkan amount (skip jika 0 = data tidak lengkap).
    // verifiedAmount dari BAYAR.GG = nominal yang dikirim saat create (gross).
    // Untuk Livin, gross = amount + fee 0.5% (tersimpan di totalPaid). Untuk channel lain,
    // gross = amount. Bandingkan ke nilai yang sesuai supaya gak false-mismatch.
    const expectedGross = deposit.totalPaid && deposit.totalPaid > 0 ? deposit.totalPaid : deposit.amount;
    if (verifiedAmount !== 0 && verifiedAmount !== expectedGross && verifiedAmount !== deposit.amount) {
      console.error(`[BAYAR.GG Webhook] Amount mismatch: verified=${verifiedAmount}, expectedGross=${expectedGross}, net=${deposit.amount}`);
      return NextResponse.json({ status: "mismatch" });
    }

    if (verifiedStatus === "paid") {
      // Saldo yang dikredit = deposit.amount (NET). Fee 0.5% (Livin) / 2.1% (BAYAR GG)
      // sudah ditanggung user di gross — user tetap dapat saldo sesuai nominal net.
      const creditAmount = deposit.amount;

      const processed = await db.$transaction(async (tx) => {
        const claimed = await tx.deposit.updateMany({
          where: { trxId: invoiceId, status: "pending" },
          data: {
            status: "paid",
            paidAt: verifiedPaidAt ? new Date(verifiedPaidAt) : new Date(),
            // fee & totalPaid sudah di-set saat create (Livin) — jangan timpa jadi 0.
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
    } else if (verifiedStatus === "expired" || verifiedStatus === "cancelled") {
      const updated = await db.deposit.updateMany({
        where: { trxId: invoiceId, status: "pending" },
        data: { status: verifiedStatus },
      });

      if (updated.count > 0) {
        console.log(`[BAYAR.GG] VERIFIED & ${verifiedStatus.toUpperCase()}: ${invoiceId}`);
      }
    } else {
      console.log(`[BAYAR.GG] Status still ${verifiedStatus} for ${invoiceId} — no action`);
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
