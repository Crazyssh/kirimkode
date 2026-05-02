import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestRetry } from "@/lib/otp";
import { logAction } from "@/lib/audit";

/**
 * POST /api/otp/resend
 * Body: { id: string }  // order.id (UUID), bukan provider activationId
 *
 * Minta SMS baru ke HeroSMS (setStatus=3). Cuma support api4 (Neptune).
 * Gratis — user gak dipotong saldo lagi (sesuai HeroSMS standard).
 * Order status balik ke "waiting" sambil tunggu SMS baru.
 * Code lama tetep tersimpan di DB (gak di-clear).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Order id wajib" }, { status: 400 });
    }

    // Cari order milik user
    const order = await db.order.findFirst({
      where: { id, userId },
      select: {
        id: true,
        server: true,
        orderId: true,
        status: true,
        code: true,
        createdAt: true,
        resendAt: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    // Cuma api4 yang support resend
    if (order.server !== "api4") {
      return NextResponse.json(
        { error: "Server ini tidak mendukung resend SMS. Cuma Neptune yang support." },
        { status: 400 }
      );
    }

    // Order belum dapet OTP pertama — gak boleh resend
    if (!order.code) {
      return NextResponse.json(
        { error: "Tunggu OTP pertama dulu sebelum minta SMS baru." },
        { status: 400 }
      );
    }

    // Lagi nunggu SMS baru — cegah double-click
    if (order.resendAt) {
      return NextResponse.json(
        { error: "Sedang menunggu SMS baru, sabar bentar." },
        { status: 400 }
      );
    }

    // Cek umur order — max 20 menit dari order pertama
    const ageMs = Date.now() - new Date(order.createdAt).getTime();
    if (ageMs > 20 * 60 * 1000) {
      return NextResponse.json(
        { error: "Order sudah lebih dari 20 menit. Buat order baru." },
        { status: 400 }
      );
    }

    // Panggil HeroSMS setStatus=3
    try {
      await requestRetry(order.server as "api4", order.orderId);
    } catch (err) {
      const msg = (err as Error).message || "";
      // Translate error HeroSMS umum
      if (msg.includes("BAD_STATUS") || msg.includes("STATUS_CANCEL") || msg.includes("STATUS_FINISH")) {
        return NextResponse.json(
          { error: "Order sudah selesai/dibatalkan di HeroSMS. Tidak bisa resend." },
          { status: 400 }
        );
      }
      console.error("Resend error:", msg);
      return NextResponse.json(
        { error: "Gagal request SMS baru ke provider. Coba lagi." },
        { status: 500 }
      );
    }

    // Status TETAP "success" — user udah dapat OTP pertama, jadi order memang berhasil.
    // Set resendAt biar cron/SSE tau lagi nunggu SMS baru. Code lama tetap kelihatan
    // sampai SMS baru masuk dan replace-nya.
    await db.order.update({
      where: { id: order.id },
      data: { resendAt: new Date() },
    });

    logAction(userId, "resend_sms", JSON.stringify({ orderId: order.id, server: order.server }));

    return NextResponse.json({
      success: true,
      message: "Permintaan SMS baru terkirim. Tunggu beberapa saat.",
    });
  } catch (err) {
    console.error("Resend route error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
