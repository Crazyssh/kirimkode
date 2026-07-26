import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { completePartnerHold } from "@/lib/partner-order";

/**
 * POST /api/otp/finish
 * Body: { id: string }  // order.id (UUID), bukan provider activationId
 *
 * Menutup "listening window" order Pluto lebih awal dan melepas nomor supplier
 * supaya bisa dijual lagi.
 *
 * Hanya berlaku untuk server `partner`: provider lain melepas nomornya begitu OTP
 * pertama masuk, jadi tidak ada apa pun untuk ditutup. Untuk Pluto, nomor sengaja
 * DITAHAN selama window masih terbuka agar buyer masih bisa menerima kode ulang —
 * dan supaya nomornya tidak dijual ke buyer lain sementara SMS susulan buyer ini
 * masih mungkin datang.
 *
 * Bersifat opsional, bukan wajib: kalau buyer tidak menekannya, sweep di sisi
 * Partner akan menutup window yang kedaluwarsa sendiri. Karena itu kegagalan
 * melepas TIDAK dilaporkan sebagai kegagalan aksi — buyer sudah memegang kodenya,
 * dan tidak ada uang yang bergerak di sini.
 *
 * Status order tetap `success`: order ini memang berhasil, dan yang berakhir hanya
 * penahanan nomornya.
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

    const order = await db.order.findFirst({
      where: { id, userId },
      select: {
        id: true,
        server: true,
        code: true,
        providerOrderRef: true,
        resendAt: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    if (order.server !== "partner") {
      return NextResponse.json(
        { error: "Server ini tidak perlu ditutup — nomor sudah dilepas otomatis." },
        { status: 400 },
      );
    }

    if (!order.code) {
      return NextResponse.json(
        { error: "Tunggu OTP dulu sebelum menyelesaikan pesanan." },
        { status: 400 },
      );
    }

    const released = await completePartnerHold(order.providerOrderRef, `main:user:${userId}`);

    // Berhenti menunggu SMS baru: buyer menyatakan sudah selesai.
    if (order.resendAt) {
      await db.order.update({ where: { id: order.id }, data: { resendAt: null } });
    }

    logAction(
      userId,
      "finish_order",
      JSON.stringify({ orderId: order.id, server: order.server, released }),
    );

    return NextResponse.json({
      success: true,
      // `released: false` berarti sweep di sisi Partner yang akan menutupnya nanti;
      // dari sisi buyer tetap selesai.
      released,
      message: released
        ? "Pesanan diselesaikan, nomor dilepas."
        : "Pesanan diselesaikan. Nomor akan dilepas otomatis.",
    });
  } catch (err) {
    console.error("Finish route error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
