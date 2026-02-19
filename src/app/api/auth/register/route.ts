import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTurnstile } from "@/lib/turnstile";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone, captchaToken, referralCode } = await req.json();

    // Verify captcha
    const captchaValid = await verifyTurnstile(captchaToken || "");
    if (!captchaValid) {
      return NextResponse.json(
        { error: "Verifikasi captcha gagal. Silakan coba lagi." },
        { status: 400 }
      );
    }

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nama, email, dan password wajib diisi" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password minimal 8 karakter" },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const apiKey = `kk_${crypto.randomBytes(24).toString("hex")}`;
    const newReferralCode = `KK${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    // Cek referral code kalau ada
    let referrerId: string | null = null;
    const REFERRAL_BONUS = 1000; // Bonus saldo untuk yang mereferensikan dan yang direferensikan

    if (referralCode) {
      const referrer = await db.user.findFirst({
        where: { referralCode: referralCode.toUpperCase() },
        select: { id: true },
      });
      if (referrer) {
        referrerId = referrer.id;
      }
    }

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone: phone || null,
        apiKey,
        balance: referrerId ? REFERRAL_BONUS : 0,
        referralCode: newReferralCode,
        referredBy: referrerId,
      },
    });

    // Beri bonus ke yang mereferensikan
    if (referrerId) {
      await db.user.update({
        where: { id: referrerId },
        data: { balance: { increment: REFERRAL_BONUS } },
      });
    }

    return NextResponse.json({
      success: true,
      message: referrerId
        ? `Registrasi berhasil! Bonus ${REFERRAL_BONUS} saldo dari referral.`
        : "Registrasi berhasil",
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
