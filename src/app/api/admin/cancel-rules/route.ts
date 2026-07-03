import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { CANCEL_RULES_KEY, clearCancelRulesCache } from "@/lib/pricing";

/**
 * GET: ambil aturan cancel per-layanan.
 * Response: { rules: { "<serviceCode>": <menit> } }
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const row = await db.siteSetting.findUnique({ where: { key: CANCEL_RULES_KEY } });
    const rules = row?.value ? JSON.parse(row.value) : {};
    return NextResponse.json({ rules: rules && typeof rules === "object" ? rules : {} });
  } catch {
    return NextResponse.json({ rules: {} });
  }
}

/**
 * POST: simpan aturan cancel per-layanan.
 * Body: { rules: { "<serviceCode>": <menit> } }
 * Validasi: menit 0..15 (harus < timeout 20 menit biar window cancel tetap ada).
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const input = body?.rules;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return NextResponse.json({ error: "Format rules tidak valid" }, { status: 400 });
    }

    // Sanitasi: key = kode layanan (lowercase, trim), value = menit (0..15).
    const clean: Record<string, number> = {};
    for (const [rawKey, rawVal] of Object.entries(input)) {
      const key = String(rawKey).trim().toLowerCase();
      if (!key) continue;
      const mins = Number(rawVal);
      if (!Number.isFinite(mins) || mins < 0) continue;
      if (mins > 15) {
        return NextResponse.json(
          { error: `Menit untuk "${key}" maksimal 15 (harus di bawah timeout 20 menit).` },
          { status: 400 }
        );
      }
      clean[key] = mins;
    }

    await db.siteSetting.upsert({
      where: { key: CANCEL_RULES_KEY },
      update: { value: JSON.stringify(clean) },
      create: { key: CANCEL_RULES_KEY, value: JSON.stringify(clean) },
    });

    clearCancelRulesCache();

    return NextResponse.json({ success: true, rules: clean });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan aturan cancel" }, { status: 500 });
  }
}
