import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { checkWhatsApp } from "@/lib/checker";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { number } = await req.json();

  if (!number || typeof number !== "string") {
    return NextResponse.json({ error: "Nomor telepon diperlukan" }, { status: 400 });
  }

  const cleanNumber = number.replace(/[^0-9]/g, "");
  if (cleanNumber.length < 8) {
    return NextResponse.json({ error: "Nomor telepon tidak valid" }, { status: 400 });
  }

  const result = await checkWhatsApp(cleanNumber);
  return NextResponse.json({ success: true, platform: "wa", data: result });
}
