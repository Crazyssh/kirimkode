import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;

    const deposit = await db.deposit.findUnique({ where: { id } });

    if (!deposit) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
    }

    if (deposit.status !== "pending") {
      return NextResponse.json(
        { error: `Deposit status is '${deposit.status}', only 'pending' deposits can be confirmed` },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
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
    console.error("Admin deposit confirm error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
