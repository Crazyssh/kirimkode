import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

// GET all price rules
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const rules = await db.priceRule.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: rules });
  } catch {
    return NextResponse.json({ error: "Gagal memuat aturan harga" }, { status: 500 });
  }
}

// POST create or update a price rule
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { serviceCode, countryId, priceType, value, active } = body;

    if (!serviceCode || !priceType || value === undefined) {
      return NextResponse.json(
        { error: "serviceCode, priceType, dan value wajib diisi" },
        { status: 400 }
      );
    }

    if (!["fixed", "multiply", "markup", "floor"].includes(priceType)) {
      return NextResponse.json(
        { error: "priceType harus: fixed, multiply, markup, atau floor" },
        { status: 400 }
      );
    }

    // Upsert: update if exists, create if not
    const rule = await db.priceRule.upsert({
      where: {
        serviceCode_countryId: {
          serviceCode,
          countryId: countryId ?? 0,
        },
      },
      update: {
        priceType,
        value: Number(value),
        active: active ?? true,
      },
      create: {
        serviceCode,
        countryId: countryId ?? 0,
        priceType,
        value: Number(value),
        active: active ?? true,
      },
    });

    return NextResponse.json({ data: rule });
  } catch (err) {
    console.error("Price rule error:", err);
    return NextResponse.json({ error: "Gagal menyimpan aturan harga" }, { status: 500 });
  }
}

// DELETE a price rule
export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id, deleteAll } = await req.json();

    // Hapus semua aturan harga (reset ke harga provider)
    if (deleteAll) {
      const count = await db.priceRule.deleteMany({});
      return NextResponse.json({ success: true, deleted: count.count });
    }

    if (!id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    await db.priceRule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal menghapus aturan harga" }, { status: 500 });
  }
}
