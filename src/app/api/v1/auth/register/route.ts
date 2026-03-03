import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { sendWelcomeEmail } from "@/lib/mail";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(req: NextRequest) {
    try {
        // Rate limit: max 5 registrasi per IP per menit
        const rateLimited = checkRouteRateLimit(req, "v1-auth-register", 5, 60000);
        if (rateLimited) return rateLimited;

        const body = await req.json();
        const { name, email, password, phone, referralCode } = body;

        if (!name || !email || !password) {
            return NextResponse.json(
                { success: false, error: "Nama, email, dan password wajib diisi" },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { success: false, error: "Password minimal 6 karakter" },
                { status: 400 }
            );
        }

        const normalizedEmail = email.toLowerCase().trim();

        const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            return NextResponse.json(
                { success: false, error: "Email sudah terdaftar" },
                { status: 409 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const apiKey = `kk_${crypto.randomBytes(24).toString("hex")}`;
        const newReferralCode = `KK${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

        // Cek referral
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

        // Welcome email (fire & forget)
        sendWelcomeEmail(user.email, { name: user.name || "User" }).catch((e) =>
            console.error("[Mail] Welcome email error:", e)
        );

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
    } catch (error) {
        console.error("[v1/auth/register] Error:", error);
        return NextResponse.json(
            { success: false, error: "Terjadi kesalahan server" },
            { status: 500 }
        );
    }
}
