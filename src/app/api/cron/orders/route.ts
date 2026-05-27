import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkSms, cancelOrder, type ServerId } from "@/lib/otp";
import { extractOtp } from "@/lib/otp-extract";
import { checkWhatsApp } from "@/lib/checker";
import { getOrderTimeoutMs } from "@/lib/pricing";

const CRON_SECRET = process.env.CRON_SECRET || "";

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
 * Works for all providers: api1/api2 (JasaOTP), api3/api4 (Hero-SMS)
 */
function isProviderExpired(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;

  const d = data as Record<string, unknown>;

  // api3/api4 (Hero-SMS): explicit status field
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
 * Refund order: update status + kembalikan saldo user.
 * Untuk api4: juga restore stock manual di DB (+1 ke entry yang sesuai).
 */
async function refundOrder(
  orderId: string,
  userId: string,
  price: number,
  status: "timeout" | "cancelled",
  meta?: { server?: string; service?: string; countryId?: number }
) {
  return db.$transaction(async (tx) => {
    // Ensure refund runs only once by claiming waiting -> final status first.
    const updated = await tx.order.updateMany({
      where: { id: orderId, userId, status: "waiting" },
      data: { status },
    });

    if (updated.count === 0) return false;

    await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: price } },
    });

    // api4: restore stock entry yang sesuai (+1)
    if (meta?.server === "api4" && meta.service && typeof meta.countryId === "number") {
      const country = await tx.providerCountry.findUnique({
        where: {
          serverId_externalId: { serverId: "api4", externalId: meta.countryId },
        },
        select: { id: true },
      });
      if (country) {
        await tx.providerService.updateMany({
          where: {
            serverId: "api4",
            countryId: country.id,
            code: meta.service, // composite code (e.g. "wa" atau "wa#abc")
          },
          data: { stock: { increment: 1 } },
        });
      }
    }

    return true;
  });
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
  const nowMs = now.getTime();

  // Dua kategori order yang perlu dipolling:
  //   1. status="waiting"     — order normal nunggu OTP pertama
  //   2. resendAt is not null — order udah success, user minta SMS baru (status tetap success)
  const targetOrders = await db.order.findMany({
    where: {
      OR: [
        { status: "waiting" },
        { resendAt: { not: null } },
      ],
    },
    include: { user: { select: { id: true, webhookUrl: true, premiumChecker: true } } },
  });

  let polled = 0;
  let otpReceived = 0;
  let expired = 0;
  let providerCancelled = 0;
  let resendCompleted = 0;
  let resendStopped = 0;

  for (const order of targetOrders) {
    const serverId = order.server as ServerId;
    const isResendMode = !!order.resendAt;
    const orderTimeoutMs = getOrderTimeoutMs(serverId);
    const orderAgeMs = nowMs - order.createdAt.getTime();
    const isExpired = orderAgeMs > orderTimeoutMs;

    // ============================================================
    // RESEND MODE: status="success", lagi nunggu SMS baru
    // ============================================================
    if (isResendMode) {
      // Timeout per server (default 20 menit) → stop polling, status tetap success
      if (isExpired) {
        try { await cancelOrder(serverId, order.orderId); } catch { /* may already be expired */ }
        await db.order.update({
          where: { id: order.id },
          data: { resendAt: null },
        });
        resendStopped++;
        console.log(`[CRON] Resend timeout (status tetap success): order ${order.id}`);
        continue;
      }

      // Polling provider untuk SMS baru
      try {
        const data = await checkSms(serverId, order.orderId);
        polled++;

        if (isProviderExpired(data)) {
          // Provider udah cancel — stop polling, status tetap success
          await db.order.update({
            where: { id: order.id },
            data: { resendAt: null },
          });
          resendStopped++;
          console.log(`[CRON] Resend provider expired (status tetap success): order ${order.id}`);
          continue;
        }

        const otp = extractOtp(data as Record<string, unknown>);
        // SMS baru? Cuma trigger kalau code beda dari yang lama.
        if (otp && otp !== order.code) {
          await db.order.update({
            where: { id: order.id },
            data: { code: otp, resendAt: null },
          });
          resendCompleted++;
          console.log(`[CRON] Resend OTP baru masuk: order ${order.id} → ${otp}`);

          // Webhook untuk SMS baru
          if (order.user.webhookUrl) {
            try {
              await fetch(order.user.webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "otp_resent",
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
        // Else: belum ada SMS baru, terus polling
      } catch (err) {
        const errMsg = (err as Error)?.message || "";
        const lower = errMsg.toLowerCase();
        if (PROVIDER_EXPIRED_KEYWORDS.some((kw) => lower.includes(kw))) {
          await db.order.update({
            where: { id: order.id },
            data: { resendAt: null },
          });
          resendStopped++;
          console.log(`[CRON] Resend provider error (status tetap success): order ${order.id} — ${errMsg}`);
        }
        // Else: network error, retry next cycle
      }
      continue;
    }

    // ============================================================
    // NORMAL MODE: status="waiting", nunggu OTP pertama
    // ============================================================

    // === 1. Local timeout: order > timeout per-server ===
    if (isExpired) {
      try {
        await cancelOrder(serverId, order.orderId);
      } catch { /* provider cancel may fail if already expired */ }

      const refunded = await refundOrder(order.id, order.userId, order.price, "timeout", {
        server: order.server,
        service: order.service,
        countryId: order.countryId,
      });
      if (refunded) {
        expired++;
        console.log(`[CRON] Timeout + refund: order ${order.id} (${order.serviceName}, ${serverId})`);
      }
      continue;
    }

    // === 2. Poll OTP dari provider ===
    try {
      const data = await checkSms(serverId, order.orderId);
      polled++;

      // === 2a. Cek apakah provider sudah cancel/expire order ini ===
      if (isProviderExpired(data)) {
        const refunded = await refundOrder(order.id, order.userId, order.price, "cancelled", {
          server: order.server,
          service: order.service,
          countryId: order.countryId,
        });
        if (refunded) {
          providerCancelled++;
          console.log(`[CRON] Provider cancelled + refund: order ${order.id} (${order.serviceName}, ${serverId})`);
        }
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
        const refunded = await refundOrder(order.id, order.userId, order.price, "cancelled", {
          server: order.server,
          service: order.service,
          countryId: order.countryId,
        });
        if (refunded) {
          providerCancelled++;
          console.log(`[CRON] Provider error (expired) + refund: order ${order.id} — ${errMsg}`);
        }
      }
      // Else: network error, skip silently
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    results: {
      totalTargets: targetOrders.length,
      polled,
      otpReceived,
      expired,
      providerCancelled,
      resendCompleted,
      resendStopped,
    },
  });
}

