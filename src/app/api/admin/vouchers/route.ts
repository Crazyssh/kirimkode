import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

// GET: List semua voucher
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const vouchers = await db.voucher.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usages: true } } },
    });
    return NextResponse.json({ data: vouchers });
  } catch {
    return NextResponse.json({ error: "Gagal memuat voucher" }, { status: 500 });
  }
}

// POST: Buat voucher baru
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { code, description, bonusType, bonusValue, maxBonus, minDeposit, maxUsage, maxPerUser, firstDeposit, expiresAt } = body;

    if (!code || !description || !bonusType || !bonusValue) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
    }

    const voucher = await db.voucher.create({
      data: {
        code: code.toUpperCase(),
        description,
        bonusType,
        bonusValue: Number(bonusValue),
        maxBonus: Number(maxBonus) || 0,
        minDeposit: Number(minDeposit) || 0,
        maxUsage: Number(maxUsage) || 0,
        maxPerUser: Number(maxPerUser) || 1,
        firstDeposit: Boolean(firstDeposit),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json({ success: true, data: voucher });
  } catch (err) {
    const msg = err instanceof Error && err.message.includes("Unique") ? "Kode voucher sudah ada" : "Gagal membuat voucher";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: Hapus voucher
export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await req.json();
    await db.voucher.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal menghapus voucher" }, { status: 500 });
  }
}
