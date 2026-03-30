import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkTransactionStatus } from "@/lib/paymenku";
import { checkPayment as bayarggCheckPayment } from "@/lib/bayargg";
import { sendDepositSuccessEmail } from "@/lib/mail";
import { giveReferralCommission } from "@/lib/referral";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * Cron job: Cek semua deposit pending ke API gateway
 *
 * Support: Paymenku + BAYAR.GG
 * - Deposit dengan expiresAt → auto-expire saat waktu habis (sinkron dgn gateway)
 * - Deposit tanpa expiresAt + > 24 jam → auto-expire (fallback)
 * - Deposit BAYAR.GG → cek via checkPayment API
 * - Deposit Paymenku → cek via checkTransactionStatus API
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
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // === AUTO-EXPIRE ===
    // 1. Deposit yang punya expiresAt dan sudah lewat → expired (sinkron dgn gateway)
    const autoExpiredByGateway = await db.deposit.updateMany({
        where: {
            status: "pending",
            expiresAt: { not: null, lte: now },
        },
        data: { status: "expired" },
    });

    if (autoExpiredByGateway.count > 0) {
        console.log(`[CRON Deposits] Auto-expired ${autoExpiredByGateway.count} deposits (gateway expiresAt passed)`);
    }

    // 2. Deposit tanpa expiresAt + > 24 jam → expired (fallback lama)
    const autoExpiredFallback = await db.deposit.updateMany({
        where: {
            status: "pending",
            expiresAt: null,
            createdAt: { lt: cutoff24h },
        },
        data: { status: "expired" },
    });

    if (autoExpiredFallback.count > 0) {
        console.log(`[CRON Deposits] Auto-expired ${autoExpiredFallback.count} deposits (24h fallback, no expiresAt)`);
    }

    // === CEK STATUS DEPOSIT PENDING ===
    const pendingDeposits = await db.deposit.findMany({
        where: {
            status: "pending",
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
            if (deposit.gateway === "bayargg") {
                // === BAYAR.GG === (checkPayment sudah normalize response)
                const result = await bayarggCheckPayment(deposit.trxId);
                checked++;

                if (result.status === "unknown") {
                    errors++;
                    continue;
                }

                if (result.status === "paid") {
                    const creditAmount = Math.floor(result.final_amount || result.amount) || deposit.amount;

                    const processed = await db.$transaction(async (tx) => {
                        const claimed = await tx.deposit.updateMany({
                            where: { trxId: deposit.trxId, status: "pending" },
                            data: {
                                status: "paid",
                                paidAt: result.paid_at ? new Date(result.paid_at) : new Date(),
                                fee: 0,
                                amount: creditAmount,
                                totalPaid: creditAmount,
                            },
                        });

                        if (claimed.count === 0) return false;

                        await tx.user.update({
                            where: { id: deposit.userId },
                            data: { balance: { increment: creditAmount } },
                        });
                        return true;
                    });

                    if (!processed) {
                        stillPending++;
                        continue;
                    }

                    paid++;
                    console.log(`[CRON Deposits] BAYAR.GG PAID: ${deposit.trxId} | +Rp ${creditAmount} for user ${deposit.userId}`);

                    // Referral commission
                    try {
                        await giveReferralCommission(deposit.userId, creditAmount);
                    } catch (e) {
                        console.error("[CRON] Referral commission error:", e);
                    }

                    // Email notifikasi
                    try {
                        const paidUser = await db.user.findUnique({ where: { id: deposit.userId }, select: { email: true, name: true, balance: true } });
                        if (paidUser?.email) {
                            sendDepositSuccessEmail(paidUser.email, {
                                name: paidUser.name || "User",
                                amount: creditAmount,
                                trxId: deposit.trxId,
                                balance: paidUser.balance,
                            }).catch((e) => console.error("[Mail] Email deposit error:", e));
                        }
                    } catch (e) {
                        console.error("[Mail] Email lookup error:", e);
                    }
                } else if (result.status === "expired") {
                    const updated = await db.deposit.updateMany({
                        where: { trxId: deposit.trxId, status: "pending" },
                        data: { status: "expired" },
                    });
                    if (updated.count > 0) expired++;
                } else if (result.status === "cancelled") {
                    const updated = await db.deposit.updateMany({
                        where: { trxId: deposit.trxId, status: "pending" },
                        data: { status: "cancelled" },
                    });
                    if (updated.count > 0) cancelled++;
                } else {
                    stillPending++;
                }
            } else {
                // === PAYMENKU (existing logic) ===
                const result = await checkTransactionStatus(deposit.trxId);
                checked++;

                if (result.status !== "success" || !result.data) {
                    errors++;
                    continue;
                }

                const apiStatus = result.data.status;

                if (apiStatus === "paid") {
                    const processed = await db.$transaction(async (tx) => {
                        const totalFee = Math.floor(parseFloat(result.data.total_fee || "0"));
                        const amountReceived = Math.floor(
                            parseFloat(result.data.amount_received || result.data.amount)
                        );

                        const claimed = await tx.deposit.updateMany({
                            where: { trxId: deposit.trxId, status: "pending" },
                            data: {
                                status: "paid",
                                fee: totalFee,
                                totalPaid: amountReceived + totalFee,
                                paidAt: result.data.paid_at ? new Date(result.data.paid_at) : new Date(),
                            },
                        });

                        if (claimed.count === 0) return false;

                        await tx.user.update({
                            where: { id: deposit.userId },
                            data: { balance: { increment: deposit.amount } },
                        });

                        // Referral commission
                        const user = await tx.user.findUnique({
                            where: { id: deposit.userId },
                            select: { referredBy: true },
                        });

                        if (user?.referredBy) {
                            const REFERRAL_COMMISSION_PERCENT = 5;
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

                        return true;
                    });

                    if (!processed) {
                        stillPending++;
                        continue;
                    }

                    paid++;

                    const paidUser = await db.user.findUnique({ where: { id: deposit.userId }, select: { email: true, name: true, balance: true } });
                    if (paidUser?.email) {
                        sendDepositSuccessEmail(paidUser.email, {
                            name: paidUser.name || "User",
                            amount: deposit.amount,
                            trxId: deposit.trxId,
                            balance: paidUser.balance,
                        }).catch((e) => console.error("[Mail] Email deposit error:", e));
                    }

                    console.log(
                        `[CRON Deposits] PAYMENKU PAID: ${deposit.trxId} | +Rp ${deposit.amount} for user ${deposit.userId}`
                    );
                } else if (apiStatus === "expired") {
                    const updated = await db.deposit.updateMany({
                        where: { trxId: deposit.trxId, status: "pending" },
                        data: { status: "expired" },
                    });
                    if (updated.count > 0) expired++;
                } else if (apiStatus === "cancelled") {
                    const updated = await db.deposit.updateMany({
                        where: { trxId: deposit.trxId, status: "pending" },
                        data: { status: "cancelled" },
                    });
                    if (updated.count > 0) cancelled++;
                } else {
                    stillPending++;
                }
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
            autoExpiredByGateway: autoExpiredByGateway.count,
            autoExpiredFallback: autoExpiredFallback.count,
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
