import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkSms, cancelOrder } from "@/lib/otp";
import { extractOtp } from "@/lib/otp-extract";
import { checkWhatsApp, checkTelegram, checkTelegramFull } from "@/lib/checker";

const CRON_SECRET = process.env.CRON_SECRET || "";
const EXPIRE_MINUTES = 20;

// Vercel Cron or manual trigger: polls OTP for waiting orders & auto-cancels expired ones
export async function GET(req: NextRequest) {
  // CRON_SECRET wajib di production — tanpa secret, siapapun bisa trigger cron
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

  // Get all waiting orders with user webhook info
  const waitingOrders = await db.order.findMany({
    where: { status: "waiting" },
    include: { user: { select: { id: true, webhookUrl: true, premiumChecker: true } } },
  });

  let polled = 0;
  let otpReceived = 0;
  let expired = 0;
  let cancelled = 0;

  for (const order of waitingOrders) {
    const isExpired = order.createdAt < expireCutoff;

    if (isExpired) {
      // Auto-cancel expired order + refund
      try {
        await cancelOrder(order.server as "api1" | "api2", order.orderId);
      } catch {
        // JasaOTP cancel may fail if already expired on their end
      }

      await db.$transaction([
        db.order.update({
          where: { id: order.id },
          data: { status: "timeout" },
        }),
        db.user.update({
          where: { id: order.userId },
          data: { balance: { increment: order.price } },
        }),
      ]);
      expired++;
      cancelled++;
      continue;
    }

    // Poll OTP for non-expired orders
    try {
      const data = await checkSms(order.server as "api1" | "api2", order.orderId);
      polled++;

      const otp = extractOtp(data as Record<string, unknown>);
      if (otp) {
        // Auto-check nomor di WA jika belum dicek (TG checker dimatikan)
        let waCheck = null;
        const svc = order.service.toLowerCase();
        if (!order.checkedAt && (svc === "wa" || svc === "tg")) {
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
              checkedAt: new Date(),
            }),
          },
        });
        otpReceived++;

        // Send webhook if configured
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
    } catch {
      // silently skip failed polls
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
      cancelled,
    },
  });
}

