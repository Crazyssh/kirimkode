import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { apiSuccess, apiError } from "@/lib/api-response";
import { authenticateApiKey } from "@/lib/api-auth";
import {
    createTransaction,
    generateReferenceId,
} from "@/lib/paymenku";

export async function POST(req: NextRequest) {
    try {
        const rateLimited = checkRouteRateLimit(req, "v1-deposit-create", 10, 60000);
        if (rateLimited) return rateLimited;

        const authUser = await authenticateApiKey(req);
        if (!authUser) {
            return apiError("Invalid API key", 401, "UNAUTHORIZED");
        }

        const body = await req.json();
        const { amount, channel } = body;

        if (!amount || !channel) {
            return apiError("amount and channel are required", 400, "MISSING_FIELDS");
        }

        if (amount < 5000) {
            return apiError("Minimal deposit Rp 5.000", 400, "MIN_AMOUNT");
        }

        // Anti double charge
        const pendingCount = await db.deposit.count({
            where: { userId: authUser.id, status: "pending" },
        });

        if (pendingCount >= 3) {
            return apiError("Anda sudah memiliki 3 deposit pending", 429, "MAX_PENDING");
        }

        // Fetch full user data for payment
        const user = await db.user.findUnique({
            where: { id: authUser.id },
            select: { id: true, name: true, email: true, phone: true },
        });

        if (!user) {
            return apiError("User not found", 404, "USER_NOT_FOUND");
        }

        const referenceId = generateReferenceId(user.id);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        const result = await createTransaction({
            reference_id: referenceId,
            amount: Number(amount),
            customer_name: user.name || "KirimKode User",
            customer_email: user.email || "",
            customer_phone: user.phone || "",
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

        return apiSuccess({
            trx_id: result.data.trx_id,
            amount: result.data.amount,
            pay_url: result.data.pay_url,
        });
    } catch (error) {
        console.error("[v1/deposit] Error:", error);
        return apiError("Gagal membuat deposit", 500, "DEPOSIT_FAILED");
    }
}
