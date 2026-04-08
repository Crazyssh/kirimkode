import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const ALLOWED_KEYS = ["wa_number"] as const;

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

  await db.siteSetting.upsert({
    where: { key },
    update: { value: value.trim() },
    create: { key, value: value.trim() },
  });

  return NextResponse.json({ success: true, data: { key, value: value.trim() } });
}
