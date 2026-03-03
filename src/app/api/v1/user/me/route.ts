import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
    const user = await authenticateApiKey(req);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const userData = await db.user.findUnique({
            where: { id: user.id },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                phone: true,
                balance: true,
                role: true,
                apiKey: true,
            },
        });

        if (!userData) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Coba ambil field tambahan
        let extras = { webhookUrl: null as string | null, favorites: "", theme: "dark" };
        try {
            const full = await db.user.findUnique({
                where: { id: user.id },
                select: { webhookUrl: true, favorites: true, theme: true },
            });
            if (full) {
                extras = {
                    webhookUrl: full.webhookUrl,
                    favorites: full.favorites,
                    theme: full.theme,
                };
            }
        } catch {
            // New fields might not exist yet
        }

        return NextResponse.json({
            data: { ...userData, ...extras },
        });
    } catch (error) {
        console.error("[v1/user/me] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
