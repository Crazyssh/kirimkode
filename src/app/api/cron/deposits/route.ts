import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkTransactionStatus } from "@/lib/paymenku";

const CRON_SECRET = process.env.CRON_SECRET || "";
const REFERRAL_COMMISSION_PERCENT = 5;

/**
 * Cron job: Cek semua deposit pending ke API Paymenku
 * 
 * Ini FALLBACK jika webhook Paymenku gagal (timeout, network error, dll).
 * Jalankan setiap 2 menit via Vercel Cron atau external scheduler.
 * 
 * Trigger: GET /api/cron/deposits
 * Auth: Bearer {CRON_SECRET}
 */
export async function GET(req: NextRequest) {
    // Auth check
    if (!CRON_SECRET && process.env.NODE_ENV === "production") {
        console.error("[CRON Deposits] CRON_SECRET not set in production!");
        return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const authHeader = req.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    // Hanya cek deposit pending yang dibuat dalam 24 jam terakhir
    // Deposit lebih lama dari itu kemungkinan sudah expired di Paymenku
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const pendingDeposits = await db.deposit.findMany({
        where: {
            status: "pending",
            createdAt: { gte: cutoff24h },
        },
        orderBy: { createdAt: "asc" },
    });

    let checked = 0;
    let paid = 0;
    let expired = 0;
    let cancelled = 0;
    let stillPending = 0;
    let errors = 0;

    for (const deposit of pendingDeposits) {
        try {
            const result = await checkTransactionStatus(deposit.trxId);
            checked++;

            if (result.status !== "success" || !result.data) {
                errors++;
                continue;
            }

            const apiStatus = result.data.status;

            if (apiStatus === "paid") {
                // Atomic transaction dengan re-check untuk prevent race condition
                // (webhook dan cron bisa jalan bersamaan)
                await db.$transaction(async (tx) => {
                    const freshDeposit = await tx.deposit.findUnique({
                        where: { trxId: deposit.trxId },
                    });

                    // Sudah di-update oleh webhook atau user polling
                    if (!freshDeposit || freshDeposit.status !== "pending") return;

                    const totalFee = Math.floor(parseFloat(result.data.total_fee || "0"));
                    const amountReceived = Math.floor(
                        parseFloat(result.data.amount_received || result.data.amount)
                    );

                    await tx.deposit.update({
                        where: { trxId: deposit.trxId },
                        data: {
                            status: "paid",
                            fee: totalFee,
                            totalPaid: amountReceived + totalFee,
                            paidAt: result.data.paid_at ? new Date(result.data.paid_at) : new Date(),
                        },
                    });

                    await tx.user.update({
                        where: { id: deposit.userId },
                        data: { balance: { increment: deposit.amount } },
                    });

                    // Referral commission dalam transaction
                    const user = await tx.user.findUnique({
                        where: { id: deposit.userId },
                        select: { referredBy: true },
                    });

                    if (user?.referredBy) {
                        const commission = Math.floor(
                            (deposit.amount * REFERRAL_COMMISSION_PERCENT) / 100
                        );
                        if (commission > 0) {
                            await tx.user.update({
                                where: { id: user.referredBy },
                                data: { balance: { increment: commission } },
                            });
                        }
                    }
                });

                paid++;
                console.log(
                    `[CRON Deposits] PAID: ${deposit.trxId} | +Rp ${deposit.amount} for user ${deposit.userId}`
                );
            } else if (apiStatus === "expired") {
                await db.deposit.update({
                    where: { trxId: deposit.trxId },
                    data: { status: "expired" },
                });
                expired++;
            } else if (apiStatus === "cancelled") {
                await db.deposit.update({
                    where: { trxId: deposit.trxId },
                    data: { status: "cancelled" },
                });
                cancelled++;
            } else {
                stillPending++;
            }
        } catch (error) {
            console.error(`[CRON Deposits] Error checking ${deposit.trxId}:`, error);
            errors++;
        }
    }

    console.log(
        `[CRON Deposits] Done: ${checked} checked, ${paid} paid, ${expired} expired, ${cancelled} cancelled, ${stillPending} still pending, ${errors} errors`
    );

    return NextResponse.json({
        success: true,
        timestamp: now.toISOString(),
        results: {
            totalPending: pendingDeposits.length,
            checked,
            paid,
            expired,
            cancelled,
            stillPending,
            errors,
        },
    });
}
