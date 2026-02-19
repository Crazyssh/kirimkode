import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

// GET: Dapatkan kode referral user (buat kalau belum ada)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { referralCode: true, referredBy: true },
    });

    // Generate referral code kalau belum ada
    if (!user?.referralCode) {
      const code = `KK${randomBytes(4).toString("hex").toUpperCase()}`;
      await db.user.update({
        where: { id: session.user.id },
        data: { referralCode: code },
      });
      user = { referralCode: code, referredBy: user?.referredBy || null };
    }

    // Hitung berapa orang yang direferensikan
    const referralCount = await db.user.count({
      where: { referredBy: session.user.id },
    });

    return NextResponse.json({
      data: {
        referralCode: user.referralCode,
        referredBy: user.referredBy,
        referralCount,
      },
    });
  } catch {
    return NextResponse.json({ error: "Gagal memuat data referral" }, { status: 500 });
  }
}
