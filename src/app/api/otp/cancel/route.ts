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

    const CLOWATCH_SERVERS = ["api5", "api8", "api9", "api10"];
    const isClowatch = CLOWATCH_SERVERS.includes(server);

    // STEP 1: Ambil order dari DB DULU (sebelum cancel ke provider).
    // Penting: kalau order sudah dapat OTP, JANGAN cancel — user udah dapat value.
    const order = await db.order.findFirst({
      where: {
        orderId: Number(id),
        server,
        userId,
        status: "waiting",
      },
    });

    if (!order) {
      // Order tidak ditemukan / sudah diproses (cancelled/success/timeout)
      console.warn(`[Cancel] Order ${id} not found or already processed for user ${userId}`);
      return NextResponse.json(
        { error: "Order tidak ditemukan atau sudah diproses." },
        { status: 404 }
      );
    }

    // Resend mode guard: order sudah pernah dapat OTP → JANGAN refund/cancel ke provider.
    // Balikin status ke "success" (user sudah dapat value). Cegah double-dip.
    if (order.code) {
      await db.order.updateMany({
        where: { id: order.id, userId, status: "waiting" },
        data: { status: "success" },
      });
      console.log(`[Cancel] Skip cancel for order ${id}: already had OTP — restored to success`);
      return NextResponse.json({
        success: false,
        error: "Order sudah menerima OTP, tidak bisa dibatalkan.",
      }, { status: 400 });
    }

    // STEP 2: Cancel di provider.
    let providerError = "";
    try {
      await cancelOrder(server, Number(id));
    } catch (e) {
      providerError = (e as Error).message || "Unknown error";
      console.warn(`[Cancel] Provider cancel error for order ${id} (${server}): ${providerError}`);

      // Clowatch: provider cancel gagal → STOP, jangan refund di web.
      // (Mencegah: web cancel + refund, tapi Clowatch masih jalan → rugi.)
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

    // STEP 3: Refund balance + update status atomically.
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
      // Edge case: order keburu berubah status di request lain (race).
      // Provider sudah ke-cancel tapi refund gak jalan → log buat audit manual.
      console.warn(`[Cancel] Order ${id} cancelled di provider tapi refund skip (race condition / already processed)`);
    }

    logAction(userId, "cancel", JSON.stringify({
      orderId: id,
      server,
      service: order.serviceName,
      country: order.country,
      price: order.price,
      providerError,
      refunded,
    }));

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

