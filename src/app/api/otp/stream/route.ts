import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkSms } from "@/lib/otp";
import { extractOtp } from "@/lib/otp-extract";

const POLL_INTERVAL = 1000; // 1 detik
const LINGER_AFTER_FIRST_OTP = 5 * 60 * 1000; // 5 menit setelah OTP pertama
const MAX_LIFETIME_MS = 20 * 60 * 1000; // 20 menit max (batas waktu nomor)

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.id;

    const orderIds = req.nextUrl.searchParams.get("orders")?.split(",").filter(Boolean) || [];
    if (orderIds.length === 0) {
        return new Response("No orders specified", { status: 400 });
    }

    const orders = await db.order.findMany({
        where: { id: { in: orderIds }, userId },
        select: { id: true, server: true, orderId: true, status: true, code: true, number: true, service: true },
    });

    if (orders.length === 0) {
        return new Response("No valid orders", { status: 404 });
    }

    const encoder = new TextEncoder();
    const startTime = Date.now();

    const stream = new ReadableStream({
        async start(controller) {
            const knownCodes: Record<string, string> = {};
            let firstOtpAt: number | null = null; // Waktu OTP pertama masuk
            let closed = false;

            // Initialize known codes dari existing data
            for (const order of orders) {
                if (order.code) {
                    knownCodes[order.id] = order.code;
                    if (!firstOtpAt) firstOtpAt = Date.now();
                }
            }

            const send = (data: Record<string, unknown>) => {
                if (closed) return;
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                } catch {
                    closed = true;
                }
            };

            const cleanup = () => {
                if (!closed) {
                    closed = true;
                    try { controller.close(); } catch { /* already closed */ }
                }
            };

            const poll = async () => {
                if (closed) return;

                const now = Date.now();

                // Max lifetime exceeded (20 min)
                if (now - startTime > MAX_LIFETIME_MS) {
                    send({ type: "close", reason: "max_lifetime" });
                    cleanup();
                    return;
                }

                // 5 menit setelah OTP pertama → tutup SSE
                if (firstOtpAt && now - firstOtpAt > LINGER_AFTER_FIRST_OTP) {
                    send({ type: "close", reason: "linger_timeout" });
                    cleanup();
                    return;
                }

                // Get fresh order data
                const freshOrders = await db.order.findMany({
                    where: { id: { in: orderIds }, userId },
                    select: { id: true, server: true, orderId: true, status: true, code: true, number: true, service: true },
                });

                let hasActiveOrders = false;

                for (const order of freshOrders) {
                    if (order.status === "cancelled" || order.status === "timeout") {
                        send({ type: "status", orderId: order.id, status: order.status });
                        continue;
                    }

                    hasActiveOrders = true;

                    // Poll JasaOTP
                    if (order.server && order.orderId) {
                        try {
                            const data = await checkSms(order.server as "api1" | "api2" | "api3" | "api4", order.orderId);
                            const otp = extractOtp(data as Record<string, unknown>);

                            if (otp && otp !== knownCodes[order.id]) {
                                knownCodes[order.id] = otp;

                                // Set timer OTP pertama
                                if (!firstOtpAt) firstOtpAt = now;

                                // Update DB
                                await db.order.update({
                                    where: { id: order.id },
                                    data: { code: otp, status: "success" },
                                });

                                send({
                                    type: "otp",
                                    orderId: order.id,
                                    code: otp,
                                    number: order.number,
                                    service: order.service,
                                });
                            }
                        } catch {
                            // Retry next cycle
                        }
                    }
                }

                // Semua order selesai dan tidak ada yang menunggu linger
                if (!hasActiveOrders && !firstOtpAt) {
                    send({ type: "close", reason: "all_done" });
                    cleanup();
                    return;
                }

                // Semua order selesai tapi masih dalam linger period (nunggu resend)
                // → tetap jalan sampai linger timeout

                if (!closed) {
                    send({ type: "keepalive", t: now });
                    setTimeout(poll, POLL_INTERVAL);
                }
            };

            poll();

            req.signal.addEventListener("abort", () => {
                cleanup();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
