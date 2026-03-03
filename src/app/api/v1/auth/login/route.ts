import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
    try {
        // Rate limit: max 10 login per IP per menit
        const rateLimited = checkRouteRateLimit(req, "v1-auth-login", 10, 60000);
        if (rateLimited) return rateLimited;

        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: "Email dan password wajib diisi" },
                { status: 400 }
            );
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
            return NextResponse.json(
                { success: false, error: "Email atau password salah" },
                { status: 401 }
            );
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return NextResponse.json(
                { success: false, error: "Email atau password salah" },
                { status: 401 }
            );
        }

        if (user.status === "banned") {
            return NextResponse.json(
                { success: false, error: "Akun Anda telah diblokir. Hubungi admin." },
                { status: 403 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                apiKey: user.apiKey,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    phone: user.phone,
                    balance: user.balance,
                },
            },
        });
    } catch (error) {
        console.error("[v1/auth/login] Error:", error);
        return NextResponse.json(
            { success: false, error: "Terjadi kesalahan server" },
            { status: 500 }
        );
    }
}
