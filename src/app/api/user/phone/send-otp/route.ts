import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { sendOtpWhatsApp } from "@/lib/whatsapp";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  // Rate limit: max 3 OTP per 5 menit per IP
  const rateLimited = checkRouteRateLimit(req, "phone-otp-send", 3, 300000);
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { phone } = await req.json();

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Nomor HP wajib diisi" }, { status: 400 });
    }

    // Normalisasi nomor: hapus spasi, dash, dll
    const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, "");

    // Validasi format: harus 628xxx (10-15 digit)
    if (!/^628\d{8,12}$/.test(cleanPhone)) {
      return NextResponse.json(
        { error: "Format nomor harus 628xxxxxxxxxx (contoh: 6281234567890)" },
        { status: 400 }
      );
    }

    // Cek apakah nomor sudah dipakai akun lain yang sudah verified
    const existingUser = await db.user.findFirst({
      where: {
        phone: cleanPhone,
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

    // Cek apakah OTP terakhir masih berlaku (anti spam)
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { phoneOtpExp: true },
    });

    if (currentUser?.phoneOtpExp && new Date() < currentUser.phoneOtpExp) {
      const remainingSec = Math.ceil(
        (currentUser.phoneOtpExp.getTime() - Date.now()) / 1000
      );
      if (remainingSec > 240) {
        // OTP baru dikirim kurang dari 1 menit lalu — jangan spam
        return NextResponse.json(
          { error: `Tunggu ${remainingSec - 240} detik sebelum kirim ulang` },
          { status: 429 }
        );
      }
    }

    // Generate OTP 6 digit
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExp = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    // Simpan OTP + phone ke database
    await db.user.update({
      where: { id: session.user.id },
      data: {
        phone: cleanPhone,
        phoneOtp: otp,
        phoneOtpExp: otpExp,
        phoneVerified: false, // reset kalau ganti nomor
      },
    });

    // Kirim OTP via WhatsApp
    const result = await sendOtpWhatsApp(cleanPhone, otp);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Gagal mengirim OTP via WhatsApp" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Kode OTP dikirim ke WhatsApp kamu",
      expiresIn: 300, // 5 menit dalam detik
    });
  } catch (err) {
    console.error("[send-otp] Error:", err);
    return NextResponse.json(
      { error: "Gagal mengirim OTP" },
      { status: 500 }
    );
  }
}
