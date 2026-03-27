import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { code, depositAmount } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Kode voucher diperlukan" }, { status: 400 });
    }

    // === ANTI-ABUSE: Wajib phone verified ===
    const currentUserData = await db.user.findUnique({
      where: { id: userId },
      select: { phoneVerified: true, phone: true, fingerprint: true },
    });

    if (!currentUserData?.phoneVerified) {
      return NextResponse.json(
        { error: "Verifikasi nomor WhatsApp dulu di halaman Pengaturan sebelum bisa pakai voucher" },
        { status: 400 }
      );
    }

    // === ANTI-ABUSE: Wajib fingerprint ter-track ===
    if (!currentUserData?.fingerprint) {
      return NextResponse.json(
        { error: "Sesi perangkat belum terdeteksi. Coba refresh halaman dan tunggu beberapa detik." },
        { status: 400 }
      );
    }

    // Ambil IP dari request
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";

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

    // Cek max usage global
    if (voucher.maxUsage > 0 && voucher._count.usages >= voucher.maxUsage) {
      return NextResponse.json({ error: "Voucher sudah mencapai batas penggunaan" }, { status: 400 });
    }

    // Cek first deposit only
    if (voucher.firstDeposit) {
      const paidDeposits = await db.deposit.count({
        where: { userId, status: "paid" },
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

    // ============================================================
    // ATOMIC TRANSACTION: Semua check + create dalam satu transaction
    // Mencegah race condition DAN multi-akun abuse
    // ============================================================
    try {
      await db.$transaction(async (tx) => {
        // 1. Cek per user
        const userUsageCount = await tx.voucherUsage.count({
          where: { voucherId: voucher.id, userId },
        });
        if (userUsageCount >= voucher.maxPerUser) {
          throw new Error("ALREADY_USED");
        }

        // 2. Cek per device (fingerprint) — anti multi-akun via device
        const currentUser = await tx.user.findUnique({
          where: { id: userId },
          select: { fingerprint: true },
        });
        if (currentUser?.fingerprint) {
          const usersWithSameDevice = await tx.user.findMany({
            where: { fingerprint: currentUser.fingerprint },
            select: { id: true },
          });
          const deviceUserIds = usersWithSameDevice.map((u) => u.id);
          const deviceUsageCount = await tx.voucherUsage.count({
            where: { voucherId: voucher.id, userId: { in: deviceUserIds } },
          });
          if (deviceUsageCount > 0) {
            throw new Error("DEVICE_USED");
          }
        }

        // 3. Cek per IP — anti multi-akun via IP address
        if (ip !== "unknown") {
          const ipUsageCount = await tx.voucherUsage.count({
            where: { voucherId: voucher.id, ip },
          });
          if (ipUsageCount > 0) {
            throw new Error("IP_USED");
          }
        }

        // 4. Cek per phone — anti multi-akun via nomor HP yang sama
        if (currentUserData.phone) {
          const usersWithSamePhone = await tx.user.findMany({
            where: { phone: currentUserData.phone, phoneVerified: true },
            select: { id: true },
          });
          const phoneUserIds = usersWithSamePhone.map((u) => u.id);
          if (phoneUserIds.length > 1) {
            const phoneUsageCount = await tx.voucherUsage.count({
              where: { voucherId: voucher.id, userId: { in: phoneUserIds } },
            });
            if (phoneUsageCount > 0) {
              throw new Error("PHONE_USED");
            }
          }
        }

        // 4. Re-check max usage global di dalam transaction
        const currentTotalUsage = await tx.voucherUsage.count({
          where: { voucherId: voucher.id },
        });
        if (voucher.maxUsage > 0 && currentTotalUsage >= voucher.maxUsage) {
          throw new Error("MAX_USAGE_REACHED");
        }

        // 5. Buat usage record (dengan IP)
        await tx.voucherUsage.create({
          data: {
            voucherId: voucher.id,
            userId,
            bonus,
            ip,
          },
        });

        // 6. Tambah saldo
        await tx.user.update({
          where: { id: userId },
          data: { balance: { increment: bonus } },
        });
      });
    } catch (txError) {
      const msg = txError instanceof Error ? txError.message : "";

      if (msg === "ALREADY_USED") {
        return NextResponse.json({ error: "Kamu sudah pernah menggunakan voucher ini" }, { status: 400 });
      }
      if (msg === "DEVICE_USED") {
        return NextResponse.json({ error: "Voucher sudah pernah digunakan di perangkat ini" }, { status: 400 });
      }
      if (msg === "IP_USED") {
        return NextResponse.json({ error: "Voucher sudah pernah digunakan dari jaringan ini" }, { status: 400 });
      }
      if (msg === "PHONE_USED") {
        return NextResponse.json({ error: "Voucher sudah pernah digunakan dengan nomor HP ini" }, { status: 400 });
      }
      if (msg === "MAX_USAGE_REACHED") {
        return NextResponse.json({ error: "Voucher sudah mencapai batas penggunaan" }, { status: 400 });
      }

      // Unique constraint violation (database-level protection)
      if (msg.includes("Unique constraint")) {
        return NextResponse.json({ error: "Kamu sudah pernah menggunakan voucher ini" }, { status: 400 });
      }

      throw txError;
    }

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
