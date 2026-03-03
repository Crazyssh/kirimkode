import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTurnstile } from "@/lib/turnstile";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { registerSchema, validateBody } from "@/lib/validations";
import { sendWelcomeEmail } from "@/lib/mail";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: max 5 registrasi per IP per menit
    const rateLimited = checkRouteRateLimit(req, "register", 5, 60000);
    if (rateLimited) return rateLimited;

    const body = await req.json();
    const validated = validateBody(registerSchema, body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { name, email, password, phone, captchaToken, referralCode } = validated.data;

    // Verify captcha
    const captchaValid = await verifyTurnstile(captchaToken || "");
    if (!captchaValid) {
      return NextResponse.json(
        { error: "Verifikasi captcha gagal. Silakan coba lagi." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
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
        email: normalizedEmail,
        password: hashedPassword,
        phone: phone || null,
        apiKey,
        balance: 0,
        referralCode: newReferralCode,
        referredBy: referrerId,
      },
    });

    // Kirim welcome email (fire & forget)
    sendWelcomeEmail(user.email, { name: user.name || "User" }).catch(() => { });

    return NextResponse.json({
      success: true,
      message: referrerId
        ? "Registrasi berhasil! Akun terhubung dengan referral."
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
