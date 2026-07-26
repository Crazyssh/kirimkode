import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestRetry } from "@/lib/otp";
import { getOrderTimeoutMs } from "@/lib/pricing";
import { logAction } from "@/lib/audit";

/**
 * POST /api/otp/resend
 * Body: { id: string }  // order.id (UUID), bukan provider activationId
 *
 * Minta SMS baru. Didukung oleh api4 (Neptune, via HeroSMS setStatus=3) dan
 * partner (Pluto, tanpa panggilan upstream — lihat alasannya di bawah).
 * Gratis untuk keduanya — user gak dipotong saldo lagi.
 * Status order tetap "success"; `resendAt` menandai sedang menunggu SMS baru.
 * Code lama tetep tersimpan di DB (gak di-clear) sampai kode baru menggantinya.
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

    // Neptune (api4) and Pluto (partner) support a second code. Everything else
    // has no such concept, so it is refused before any provider call.
    const RESEND_CAPABLE = ["api4", "partner"];
    if (!RESEND_CAPABLE.includes(order.server)) {
      return NextResponse.json(
        { error: "Server ini tidak mendukung resend SMS." },
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

    // Cek umur order — max sesuai timeout per-server
    const ageMs = Date.now() - new Date(order.createdAt).getTime();
    const timeoutMs = getOrderTimeoutMs(order.server);
    if (ageMs > timeoutMs) {
      const min = Math.floor(timeoutMs / 60000);
      return NextResponse.json(
        { error: `Order sudah lebih dari ${min} menit. Buat order baru.` },
        { status: 400 }
      );
    }

    // Pluto needs no upstream call at all. Its listening window is already open
    // from the moment the first OTP arrived: the supplier keeps holding the number
    // until the buyer completes the order or the window expires, and any further
    // SMS on that number is matched to this same order and refreshes its code. So
    // "ask for a new SMS" here means only "start waiting again" — the buyer taps
    // resend inside WhatsApp itself, and the code lands through the normal path.
    //
    // Skipping the remote call is also what keeps it free: no second reserve, no
    // second earning, no second charge.
    if (order.server !== "partner") {
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
