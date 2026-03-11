import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { apiSuccess, apiError } from "@/lib/api-response";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
    try {
        const rateLimited = checkRouteRateLimit(req, "v1-auth-login", 10, 60000);
        if (rateLimited) return rateLimited;

        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return apiError("Email dan password wajib diisi", 400, "MISSING_FIELDS");
        }

        const normalizedEmail = email.toLowerCase().trim();

        const user = await db.user.findUnique({
            where: { email: normalizedEmail },
            select: {
                id: true,
                name: true,
                email: true,
                password: true,
                apiKey: true,
                balance: true,
                status: true,
                image: true,
                phone: true,
            },
        });

        if (!user || !user.password) {
            return apiError("Email atau password salah", 401, "INVALID_CREDENTIALS");
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return apiError("Email atau password salah", 401, "INVALID_CREDENTIALS");
        }

        if (user.status === "banned") {
            return apiError("Akun Anda telah diblokir. Hubungi admin.", 403, "ACCOUNT_BANNED");
        }

        return apiSuccess({
            api_key: user.apiKey,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                phone: user.phone,
                balance: user.balance,
            },
        });
    } catch (error) {
        console.error("[v1/auth/login] Error:", error);
        return apiError("Terjadi kesalahan server", 500, "SERVER_ERROR");
    }
}
