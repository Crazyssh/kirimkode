import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cancelOrder } from "@/lib/otp";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { logAction } from "@/lib/audit";
import { otpCancelSchema, validateBody } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: max 50 cancel per IP per menit
    const rateLimited = checkRouteRateLimit(req, "otp-cancel", 50, 60000);
    if (rateLimited) return rateLimited;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json();
    const validated = validateBody(otpCancelSchema, body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { server, id } = validated.data;

    // Server Clowatch: cancel HARUS sukses di provider dulu. Kalau gagal,
    // JANGAN cancel/refund di web — biar order tetap jalan & user bisa coba lagi.
    // (Mencegah kasus: web cancel + refund, tapi Clowatch masih jalan → rugi.)
    const CLOWATCH_SERVERS = ["api5", "api8", "api9", "api10"];
    const isClowatch = CLOWATCH_SERVERS.includes(server);

    // Cancel on provider
    let providerError = "";
    try {
      await cancelOrder(server, Number(id));
    } catch (e) {
      providerError = (e as Error).message || "Unknown error";
      console.warn(`[Cancel] Provider cancel error for order ${id} (${server}): ${providerError}`);

      // Clowatch: provider cancel gagal → STOP, jangan refund di web.
      if (isClowatch) {
        return NextResponse.json(
          {
            error: providerError.includes("tunggu") || providerError.includes("TOO_EARLY")
              ? providerError
              : "Gagal membatalkan di provider. Order masih aktif, coba lagi sebentar.",
          },
          { status: 400 }
        );
      }
      // Server non-Clowatch: lanjut refund — provider mungkin sudah cancel sebelumnya
    }

    // Refund balance and update order status atomically
    const order = await db.order.findFirst({
      where: {
        orderId: Number(id),
        server,
        userId,
        status: "waiting",
      },
    });

    if (order) {
      // Resend mode guard: kalau order udah pernah dapet OTP (code ada),
      // user udah dapet value — JANGAN refund. Balikin status ke "success".
      // Ini cegah double-dip dari fitur resend SMS (Neptune).
      if (order.code) {
        await db.order.updateMany({
          where: { id: order.id, userId, status: "waiting" },
          data: { status: "success" },
        });
        console.log(`[Cancel] Skip refund for order ${id}: already had OTP (resend mode) — restored to success`);
      } else {
        const refunded = await db.$transaction(async (tx) => {
          const updated = await tx.order.updateMany({
            where: { id: order.id, userId, status: "waiting" },
            data: { status: "cancelled" },
          });

          if (updated.count === 0) return false;

          await tx.user.update({
            where: { id: userId },
            data: { balance: { increment: order.price } },
          });

          return true;
        });

        if (refunded) {
          console.log(`[Cancel] Refunded Rp ${order.price} for order ${id} to user ${userId}`);
        } else {
          console.warn(`[Cancel] Skip refund for order ${id}: already processed`);
        }
      }
    } else {
      console.warn(`[Cancel] Order ${id} not found or already cancelled for user ${userId}`);
    }

    logAction(userId, "cancel", JSON.stringify({ orderId: id, server, providerError }));

    return NextResponse.json({
      success: true,
      message: "Pesanan dibatalkan, saldo dikembalikan",
      ...(providerError ? { warning: providerError } : {}),
    });
  } catch (error) {
    console.error("[Cancel] Error:", error);
    return NextResponse.json({ error: "Gagal membatalkan pesanan" }, { status: 500 });
  }
}

