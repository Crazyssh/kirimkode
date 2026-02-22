import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code, depositAmount } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Kode voucher diperlukan" }, { status: 400 });
    }

    // Cari voucher
    const voucher = await db.voucher.findFirst({
      where: { code: code.toUpperCase(), active: true },
      include: { _count: { select: { usages: true } } },
    });

    if (!voucher) {
      return NextResponse.json({ error: "Kode voucher tidak valid atau sudah tidak aktif" }, { status: 404 });
    }

    // Cek expired
    if (voucher.expiresAt && new Date() > voucher.expiresAt) {
      return NextResponse.json({ error: "Voucher sudah kadaluarsa" }, { status: 400 });
    }

    // Cek max usage
    if (voucher.maxUsage > 0 && voucher._count.usages >= voucher.maxUsage) {
      return NextResponse.json({ error: "Voucher sudah mencapai batas penggunaan" }, { status: 400 });
    }

    // Cek max per user
    const userUsageCount = await db.voucherUsage.count({
      where: { voucherId: voucher.id, userId: session.user.id },
    });
    if (userUsageCount >= voucher.maxPerUser) {
      return NextResponse.json({ error: "Kamu sudah pernah menggunakan voucher ini" }, { status: 400 });
    }

    // Cek per device — voucher hanya bisa dipakai 1x per perangkat (fingerprint)
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { fingerprint: true },
    });
    if (currentUser?.fingerprint) {
      const usersWithSameDevice = await db.user.findMany({
        where: { fingerprint: currentUser.fingerprint },
        select: { id: true },
      });
      const deviceUserIds = usersWithSameDevice.map((u) => u.id);
      const deviceUsageCount = await db.voucherUsage.count({
        where: { voucherId: voucher.id, userId: { in: deviceUserIds } },
      });
      if (deviceUsageCount > 0) {
        return NextResponse.json({ error: "Voucher sudah pernah digunakan di perangkat ini" }, { status: 400 });
      }
    }

    // Cek first deposit only
    if (voucher.firstDeposit) {
      const paidDeposits = await db.deposit.count({
        where: { userId: session.user.id, status: "paid" },
      });
      if (paidDeposits > 0) {
        return NextResponse.json({ error: "Voucher ini hanya untuk deposit pertama" }, { status: 400 });
      }
    }

    // Cek min deposit
    const amount = depositAmount || 0;
    if (voucher.minDeposit > 0 && amount < voucher.minDeposit) {
      return NextResponse.json({
        error: `Minimal deposit Rp ${voucher.minDeposit.toLocaleString("id-ID")} untuk menggunakan voucher ini`,
      }, { status: 400 });
    }

    // Hitung bonus
    let bonus = 0;
    if (voucher.bonusType === "fixed") {
      bonus = voucher.bonusValue;
    } else if (voucher.bonusType === "percent") {
      bonus = Math.floor((amount * voucher.bonusValue) / 100);
      if (voucher.maxBonus > 0) {
        bonus = Math.min(bonus, voucher.maxBonus);
      }
    }

    // Simpan usage dan tambah saldo
    await db.$transaction([
      db.voucherUsage.create({
        data: {
          voucherId: voucher.id,
          userId: session.user.id,
          bonus,
        },
      }),
      db.user.update({
        where: { id: session.user.id },
        data: { balance: { increment: bonus } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        voucherCode: voucher.code,
        bonus,
        description: voucher.description,
      },
      message: `Voucher berhasil! Bonus Rp ${bonus.toLocaleString("id-ID")} ditambahkan ke saldo.`,
    });
  } catch {
    return NextResponse.json({ error: "Gagal menggunakan voucher" }, { status: 500 });
  }
}
