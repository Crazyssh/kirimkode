import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { logAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  // Rate limit: max 5 attempt per 5 menit per IP
  const rateLimited = checkRouteRateLimit(req, "phone-otp-verify", 5, 300000);
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { otp } = await req.json();

    if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: "Kode OTP harus 6 digit angka" },
        { status: 400 }
      );
    }

    // Ambil data OTP dari database
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        phoneOtp: true,
        phoneOtpExp: true,
        phone: true,
      },
    });

    if (!user?.phoneOtp || !user?.phoneOtpExp) {
      return NextResponse.json(
        { error: "Belum ada OTP yang dikirim. Kirim OTP dulu." },
        { status: 400 }
      );
    }

    // Cek expired
    if (new Date() > user.phoneOtpExp) {
      // Hapus OTP yang expired
      await db.user.update({
        where: { id: session.user.id },
        data: { phoneOtp: null, phoneOtpExp: null },
      });
      return NextResponse.json(
        { error: "Kode OTP sudah kadaluarsa. Kirim ulang OTP." },
        { status: 400 }
      );
    }

    // Cek OTP cocok
    if (otp !== user.phoneOtp) {
      return NextResponse.json(
        { error: "Kode OTP salah" },
        { status: 400 }
      );
    }

    // Double check: pastikan nomor belum dipakai akun lain
    const existingUser = await db.user.findFirst({
      where: {
        phone: user.phone!,
        phoneVerified: true,
        id: { not: session.user.id },
      },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Nomor ini sudah digunakan oleh akun lain" },
        { status: 400 }
      );
    }

    // Berhasil! Set verified + hapus OTP
    await db.user.update({
      where: { id: session.user.id },
      data: {
        phoneVerified: true,
        phoneOtp: null,
        phoneOtpExp: null,
      },
    });

    // Audit log
    logAction(
      session.user.id,
      "phone_verified",
      JSON.stringify({ phone: user.phone })
    );

    return NextResponse.json({
      success: true,
      message: "Nomor WhatsApp berhasil diverifikasi!",
    });
  } catch (err) {
    console.error("[verify-otp] Error:", err);
    return NextResponse.json(
      { error: "Gagal memverifikasi OTP" },
      { status: 500 }
    );
  }
}
