import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const ALLOWED_KEYS = [
  "wa_number",
  "deposit_enabled",
  "manual_qris_enabled",
  "paymenku_enabled",
  "bayargg_enabled",
  "admin_telegram_username",
] as const;

// GET: Ambil semua settings
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const settings = await db.siteSetting.findMany();
  const result: Record<string, string> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }

  return NextResponse.json({ data: result });
}

// PATCH: Update satu setting
export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { key, value } = body;

  if (!key || typeof key !== "string" || !ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number])) {
    return NextResponse.json({ error: "Key tidak valid" }, { status: 400 });
  }

  if (typeof value !== "string") {
    return NextResponse.json({ error: "Value harus berupa string" }, { status: 400 });
  }

  // Validasi khusus wa_number
  if (key === "wa_number") {
    const clean = value.replace(/\D/g, "");
    if (!clean || clean.length < 8 || clean.length > 15) {
      return NextResponse.json({ error: "Nomor WA tidak valid" }, { status: 400 });
    }

    await db.siteSetting.upsert({
      where: { key },
      update: { value: clean },
      create: { key, value: clean },
    });

    return NextResponse.json({ success: true, data: { key, value: clean } });
  }

  // Validasi khusus deposit_enabled & manual_qris_enabled & paymenku_enabled & bayargg_enabled (hanya "true" atau "false")
  if (
    key === "deposit_enabled" ||
    key === "manual_qris_enabled" ||
    key === "paymenku_enabled" ||
    key === "bayargg_enabled"
  ) {
    if (value !== "true" && value !== "false") {
      return NextResponse.json({ error: "Value harus 'true' atau 'false'" }, { status: 400 });
    }

    await db.siteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    return NextResponse.json({ success: true, data: { key, value } });
  }

  await db.siteSetting.upsert({
    where: { key },
    update: { value: value.trim() },
    create: { key, value: value.trim() },
  });

  return NextResponse.json({ success: true, data: { key, value: value.trim() } });
}
