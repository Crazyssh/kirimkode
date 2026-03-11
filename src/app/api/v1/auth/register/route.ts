import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { apiSuccess, apiError } from "@/lib/api-response";
import { sendWelcomeEmail } from "@/lib/mail";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(req: NextRequest) {
    try {
        const rateLimited = checkRouteRateLimit(req, "v1-auth-register", 5, 60000);
        if (rateLimited) return rateLimited;

        const body = await req.json();
        const { name, email, password, phone, referralCode } = body;

        if (!name || !email || !password) {
            return apiError("Nama, email, dan password wajib diisi", 400, "MISSING_FIELDS");
        }

        if (password.length < 6) {
            return apiError("Password minimal 6 karakter", 400, "WEAK_PASSWORD");
        }

        const normalizedEmail = email.toLowerCase().trim();

        const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            return apiError("Email sudah terdaftar", 409, "EMAIL_EXISTS");
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

        return apiSuccess(
            {
                id: user.id,
                name: user.name,
                email: user.email,
                message: referrerId
                    ? "Registrasi berhasil! Akun terhubung dengan referral."
                    : "Registrasi berhasil",
            },
            201
        );
    } catch (error) {
        console.error("[v1/auth/register] Error:", error);
        return apiError("Terjadi kesalahan server", 500, "SERVER_ERROR");
    }
}
