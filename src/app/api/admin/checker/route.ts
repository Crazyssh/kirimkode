import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { checkWhatsApp, checkTelegramFull } from "@/lib/checker";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { number, platform } = await req.json();

  if (!number || typeof number !== "string") {
    return NextResponse.json({ error: "Nomor telepon diperlukan" }, { status: 400 });
  }

  if (!platform || !["wa", "tg"].includes(platform)) {
    return NextResponse.json({ error: "Platform harus 'wa' atau 'tg'" }, { status: 400 });
  }

  const cleanNumber = number.replace(/[^0-9]/g, "");
  if (cleanNumber.length < 8) {
    return NextResponse.json({ error: "Nomor telepon tidak valid" }, { status: 400 });
  }

  if (platform === "wa") {
    const result = await checkWhatsApp(cleanNumber);
    return NextResponse.json({ success: true, platform: "wa", data: result });
  }

  const result = await checkTelegramFull(cleanNumber);
  return NextResponse.json({ success: true, platform: "tg", data: result });
}
