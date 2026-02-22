import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const REFERRAL_COMMISSION_PERCENT = 5;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;

    // Semua dalam 1 interactive transaction untuk prevent race condition
    const result = await db.$transaction(async (tx) => {
      // Re-check status di dalam transaction (atomic)
      const deposit = await tx.deposit.findUnique({ where: { id } });

      if (!deposit) {
        throw new Error("NOT_FOUND");
      }

      if (deposit.status !== "pending") {
        throw new Error(`ALREADY_PROCESSED:${deposit.status}`);
      }

      const updatedDeposit = await tx.deposit.update({
        where: { id },
        data: {
          status: "paid",
          paidAt: new Date(),
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: deposit.userId },
        data: {
          balance: { increment: deposit.amount },
        },
        select: { id: true, balance: true },
      });

      // Referral commission DALAM transaction (atomic)
      const user = await tx.user.findUnique({
        where: { id: deposit.userId },
        select: { referredBy: true },
      });

      if (user?.referredBy) {
        const commission = Math.floor((deposit.amount * REFERRAL_COMMISSION_PERCENT) / 100);
        if (commission > 0) {
          await tx.user.update({
            where: { id: user.referredBy },
            data: { balance: { increment: commission } },
          });
        }
      }

      return { deposit: updatedDeposit, user: updatedUser };
    });

    return NextResponse.json({
      data: {
        deposit: result.deposit,
        user: result.user,
      },
      message: "Deposit confirmed successfully",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";

    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
    }
    if (msg.startsWith("ALREADY_PROCESSED")) {
      const status = msg.split(":")[1];
      return NextResponse.json(
        { error: `Deposit status is '${status}', only 'pending' deposits can be confirmed` },
        { status: 400 }
      );
    }

    console.error("Admin deposit confirm error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
