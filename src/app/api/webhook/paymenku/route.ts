import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  checkTransactionStatus,
  verifyWebhookSignature,
  isWebhookSecretConfigured,
} from "@/lib/paymenku";
import { giveReferralCommission } from "@/lib/referral";
import { sendDepositSuccessEmail } from "@/lib/mail";

/**
 * Webhook handler untuk Paymenku.
 *
 * Defense-in-depth dua lapis:
 *   1. HMAC-SHA256 signature verification (header X-PaymenKu-Signature)
 *      - formula: HMAC(timestamp + "." + raw_body, PAYMENKU_WEBHOOK_SECRET)
 *      - kalau secret belum diset, di-skip dan langsung jalan ke step 2
 *   2. Callback verification — call check-status API & match reference_id+amount
 *      sebelum credit balance, supaya payload nakal tidak bisa fake "paid".
 *
 * Set callback URL di dashboard merchant Paymenku:
 *   https://yourdomain.com/api/webhook/paymenku
 */
export async function POST(req: NextRequest) {
  try {
    // Body harus dibaca sebagai TEXT mentah dulu — kalau pakai req.json()
    // langsung, signature verification bakal gagal karena byte berubah.
    const rawBody = await req.text();

    // === LAYER 1: HMAC signature verification ===
    if (isWebhookSecretConfigured()) {
      const signature = req.headers.get("x-paymenku-signature") || "";
      const timestamp = req.headers.get("x-paymenku-timestamp") || "";

      const valid = await verifyWebhookSignature(rawBody, timestamp, signature);
      if (!valid) {
        console.warn("[Paymenku Webhook] Invalid signature — rejected");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    console.log("[Paymenku Webhook] Received:", JSON.stringify(body));

    // Validate event field (saat ini cuma payment.status_updated)
    const event = typeof body.event === "string" ? body.event : "";
    if (event && event !== "payment.status_updated") {
      console.log(`[Paymenku Webhook] Ignored event: ${event}`);
      return NextResponse.json({ status: "ignored" });
    }

    const trxId = typeof body.trx_id === "string" ? body.trx_id : "";
    if (!trxId) {
      console.warn("[Paymenku Webhook] Missing trx_id in payload");
      return NextResponse.json({ status: "ignored" });
    }

    const deposit = await db.deposit.findUnique({
      where: { trxId },
    });

    if (!deposit) {
      console.log(`[Paymenku Webhook] Deposit not found: ${trxId}`);
      return NextResponse.json({ status: "not_found" });
    }

    // Sudah credit sebelumnya — idempotent skip
    if (deposit.status === "paid" || deposit.status === "refunded") {
      console.log(
        `[Paymenku Webhook] Already processed: ${trxId} (${deposit.status})`
      );
      return NextResponse.json({ status: "already_processed" });
    }

    // === LAYER 2: callback verification ===
    const verified = await checkTransactionStatus(trxId);

    if (verified.status !== "success" || !verified.data) {
      console.error(
        `[Paymenku Webhook] Verification failed for ${trxId}:`,
        verified
      );
      return NextResponse.json({ status: "verification_failed" });
    }

    const apiData = verified.data;

    if (apiData.reference_id !== deposit.referenceId) {
      console.error(
        `[Paymenku Webhook] Reference ID mismatch: API=${apiData.reference_id}, DB=${deposit.referenceId}`
      );
      return NextResponse.json({ status: "mismatch" });
    }

    // Paymenku mengirim 2 angka:
    //   - apiData.amount         = total yang user bayar (sudah include fee gateway)
    //   - apiData.amount_received = nominal bersih yang masuk ke merchant
    //                              = nominal deposit yang kita simpan di DB
    //
    // Jadi compare-nya pakai amount_received, BUKAN amount.
    // Fallback: kalau amount_received tidak ada, terima selama apiData.amount >= deposit.amount
    // (gateway boleh tambah fee, tapi gak boleh kurangi).
    const apiAmount = Math.floor(parseFloat(apiData.amount || "0"));
    const apiReceived = Math.floor(parseFloat(apiData.amount_received || "0"));

    let amountValid = false;
    if (apiReceived > 0) {
      amountValid = apiReceived === deposit.amount;
    } else {
      amountValid = apiAmount >= deposit.amount;
    }

    if (!amountValid) {
      console.error(
        `[Paymenku Webhook] Amount mismatch: API.amount=${apiAmount}, API.received=${apiReceived}, DB=${deposit.amount}`
      );
      return NextResponse.json({ status: "mismatch" });
    }

    const apiStatus = apiData.status;

    if (apiStatus === "paid") {
      const fee = Math.floor(parseFloat(apiData.total_fee || "0"));
      const amountReceived = Math.floor(
        parseFloat(apiData.amount_received || "0")
      );

      const processed = await db.$transaction(async (tx) => {
        // Allow revival dari cancelled/expired/failed kalau ternyata gateway konfirm paid
        const claimed = await tx.deposit.updateMany({
          where: { trxId, status: { not: "paid" } },
          data: {
            status: "paid",
            paidAt: apiData.paid_at ? new Date(apiData.paid_at) : new Date(),
            fee,
            totalPaid: amountReceived + fee,
          },
        });

        if (claimed.count === 0) {
          console.log(
            `[Paymenku Webhook] Race condition prevented: ${trxId} already processed`
          );
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

      console.log(
        `[Paymenku] VERIFIED & PAID: ${trxId} | +Rp ${deposit.amount} for user ${deposit.userId}`
      );

      try {
        await giveReferralCommission(deposit.userId, deposit.amount);
      } catch (e) {
        console.error("[Paymenku] Referral commission error:", e);
      }

      try {
        const user = await db.user.findUnique({
          where: { id: deposit.userId },
          select: { email: true, name: true, balance: true },
        });
        if (user?.email) {
          await sendDepositSuccessEmail(user.email, {
            name: user.name || "User",
            amount: deposit.amount,
            trxId,
            balance: user.balance,
          });
          console.log(`[Mail] Deposit email sent to ${user.email}`);
        }
      } catch (e) {
        console.error("[Mail] Email deposit error:", e);
      }
    } else if (
      apiStatus === "expired" ||
      apiStatus === "cancelled" ||
      apiStatus === "failed" ||
      apiStatus === "refunded"
    ) {
      const updated = await db.deposit.updateMany({
        where: { trxId, status: "pending" },
        data: { status: apiStatus },
      });

      if (updated.count > 0) {
        console.log(
          `[Paymenku] VERIFIED & ${apiStatus.toUpperCase()}: ${trxId}`
        );
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
