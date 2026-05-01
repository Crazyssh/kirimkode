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

      // Kalau order udah dapet OTP (resend mode), JANGAN refund — user udah dapet value.
      // Cuma mark status sebagai timeout.
      if (order.code) {
        await db.order.updateMany({
          where: { id: order.id, status: "waiting" },
          data: { status: "timeout" },
        });
        expired++;
        console.log(`[CRON] Resend timeout (no refund — already had OTP): order ${order.id}`);
        continue;
      }

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
        // Kalau udah ada OTP, JANGAN refund (resend mode)
        if (order.code) {
          await db.order.updateMany({
            where: { id: order.id, status: "waiting" },
            data: { status: "cancelled" },
          });
          providerCancelled++;
          console.log(`[CRON] Resend provider cancelled (no refund): order ${order.id}`);
          continue;
        }

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
      // Resend mode: kalau provider balikin code yang SAMA dengan order.code,
      // skip — anggap belum ada SMS baru, lanjut polling.
      if (otp && otp === order.code) {
        continue;
      }
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
        // Resend mode: udah ada OTP, gak refund
        if (order.code) {
          await db.order.updateMany({
            where: { id: order.id, status: "waiting" },
            data: { status: "cancelled" },
          });
          providerCancelled++;
          console.log(`[CRON] Resend provider error (no refund): order ${order.id} — ${errMsg}`);
        } else {
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

