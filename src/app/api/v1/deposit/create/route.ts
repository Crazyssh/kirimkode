import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
    createTransaction,
    generateReferenceId,
} from "@/lib/paymenku";
import { checkRouteRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
    try {
        const rateLimited = checkRouteRateLimit(req, "v1-deposit-create", 10, 60000);
        if (rateLimited) return rateLimited;

        const user = await authenticateApiKey(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { amount, channel } = body;

        if (!amount || !channel) {
            return NextResponse.json(
                { error: "amount and channel are required" },
                { status: 400 }
            );
        }

        if (amount < 5000) {
            return NextResponse.json(
                { error: "Minimal deposit Rp 5.000" },
                { status: 400 }
            );
        }

        // Anti double charge
        const pendingCount = await db.deposit.count({
            where: { userId: user.id, status: "pending" },
        });

        if (pendingCount >= 3) {
            return NextResponse.json(
                { error: "Anda sudah memiliki 3 deposit pending" },
                { status: 429 }
            );
        }

        const referenceId = generateReferenceId(user.id);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        const result = await createTransaction({
            reference_id: referenceId,
            amount: Number(amount),
            customer_name: user.name || "KirimKode User",
            customer_email: user.email || "",
            customer_phone: (user as Record<string, unknown>).phone as string || "",
            channel_code: channel,
            return_url: `${appUrl}/deposit?status=success`,
        });

        await db.deposit.create({
            data: {
                userId: user.id,
                trxId: result.data.trx_id,
                referenceId: result.data.reference_id,
                amount: Number(amount),
                channelCode: channel,
                channelName: channel.toUpperCase(),
                status: "pending",
                payUrl: result.data.pay_url,
            },
        });

        return NextResponse.json({
            status: "success",
            data: {
                trx_id: result.data.trx_id,
                amount: result.data.amount,
                pay_url: result.data.pay_url,
                payment_url: result.data.pay_url,
            },
        });
    } catch (error) {
        console.error("[v1/deposit] Error:", error);
        return NextResponse.json(
            { error: "Gagal membuat deposit" },
            { status: 500 }
        );
    }
}
