import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkSms, cancelOrder, type ServerId } from "@/lib/otp";
import { extractOtp } from "@/lib/otp-extract";
import { checkWhatsApp } from "@/lib/checker";

const CRON_SECRET = process.env.CRON_SECRET || "";
const EXPIRE_MINUTES = 20;

// Keywords dari provider yang menandakan order sudah expired/cancelled di sisi mereka
const PROVIDER_EXPIRED_KEYWORDS = [
  "cancel", "cancelled", "canceled",
  "expired", "expire",
  "timeout", "timed out", "time out",
  "no_activation", "status_cancel",
  "order not found", "not found",
  "bad_status", "wrong_activation_id",
];

/**
 * Cek apakah response dari provider menandakan order sudah expired/cancelled
 * Works for all providers: api1/api2 (JasaOTP), api3 (Hero-SMS)
 */
function isProviderExpired(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;

  const d = data as Record<string, unknown>;

  // api3 (Hero-SMS): explicit status field
  if (d.status === "cancelled" || d.status === "timeout" || d.status === "expired") {
    return true;
  }

  // api1/api2 (JasaOTP): cek berbagai format response
  const statusFields = [d.status, d.code, d.message, d.error, d.data];
  for (const field of statusFields) {
    if (typeof field === "string") {
      const lower = field.toLowerCase();
      if (PROVIDER_EXPIRED_KEYWORDS.some((kw) => lower.includes(kw))) {
        return true;
      }
    }
    // Nested data object
    if (field && typeof field === "object") {
      const nested = field as Record<string, unknown>;
      for (const val of [nested.status, nested.message, nested.error]) {
        if (typeof val === "string") {
          const lower = val.toLowerCase();
          if (PROVIDER_EXPIRED_KEYWORDS.some((kw) => lower.includes(kw))) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Refund order: update status + kembalikan saldo user
 */
async function refundOrder(orderId: string, userId: string, price: number, status: "timeout" | "cancelled") {
  await db.$transaction([
    db.order.update({
      where: { id: orderId },
      data: { status },
    }),
    db.user.update({
      where: { id: userId },
      data: { balance: { increment: price } },
    }),
  ]);
}

// Cron: polls OTP for waiting orders & auto-cancels expired ones
// Trigger via crontab: curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/orders
export async function GET(req: NextRequest) {
  // CRON_SECRET wajib di production
  if (!CRON_SECRET && process.env.NODE_ENV === "production") {
    console.error("[CRON] CRON_SECRET not set in production!");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const expireCutoff = new Date(now.getTime() - EXPIRE_MINUTES * 60 * 1000);

  const waitingOrders = await db.order.findMany({
    where: { status: "waiting" },
    include: { user: { select: { id: true, webhookUrl: true, premiumChecker: true } } },
  });

  let polled = 0;
  let otpReceived = 0;
  let expired = 0;
  let providerCancelled = 0;

  for (const order of waitingOrders) {
    const serverId = order.server as ServerId;

    // === 1. Local timeout: order > 20 menit ===
    if (order.createdAt < expireCutoff) {
      try {
        await cancelOrder(serverId, order.orderId);
      } catch { /* provider cancel may fail if already expired */ }

      await refundOrder(order.id, order.userId, order.price, "timeout");
      expired++;
      console.log(`[CRON] Timeout + refund: order ${order.id} (${order.serviceName}, ${serverId})`);
      continue;
    }

    // === 2. Poll OTP dari provider ===
    try {
      const data = await checkSms(serverId, order.orderId);
      polled++;

      // === 2a. Cek apakah provider sudah cancel/expire order ini ===
      if (isProviderExpired(data)) {
        await refundOrder(order.id, order.userId, order.price, "cancelled");
        providerCancelled++;
        console.log(`[CRON] Provider cancelled + refund: order ${order.id} (${order.serviceName}, ${serverId})`);
        continue;
      }

      // === 2b. Cek apakah OTP sudah masuk ===
      const otp = extractOtp(data as Record<string, unknown>);
      if (otp) {
        let waCheck = null;
        const rawSvc = order.service.toLowerCase();
        const svc = rawSvc.startsWith("wa") || rawSvc.startsWith("whatsapp") ? "wa" : rawSvc;
        if (!order.checkedAt && svc === "wa") {
          try {
            waCheck = await checkWhatsApp(order.number);
          } catch { /* checker failure is non-critical */ }
        }

        await db.order.update({
          where: { id: order.id },
          data: {
            code: otp,
            status: "success",
            ...(order.checkedAt ? {} : {
              waCheck: waCheck ? JSON.stringify(waCheck) : null,
              tgCheck: null,
              checkedAt: new Date(),
            }),
          },
        });
        otpReceived++;

        // Send webhook
        if (order.user.webhookUrl) {
          try {
            await fetch(order.user.webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "otp_received",
                data: {
                  order_id: order.id,
                  service: order.serviceName,
                  number: order.number,
                  code: otp,
                },
              }),
            });
          } catch { /* webhook delivery failure is non-critical */ }
        }
      }
    } catch (err) {
      // === 2c. Error dari provider bisa juga berarti order expired ===
      const errMsg = (err as Error)?.message || "";
      const lower = errMsg.toLowerCase();
      if (PROVIDER_EXPIRED_KEYWORDS.some((kw) => lower.includes(kw))) {
        await refundOrder(order.id, order.userId, order.price, "cancelled");
        providerCancelled++;
        console.log(`[CRON] Provider error (expired) + refund: order ${order.id} — ${errMsg}`);
      }
      // Else: network error, skip silently
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    results: {
      totalWaiting: waitingOrders.length,
      polled,
      otpReceived,
      expired,
      providerCancelled,
    },
  });
}

