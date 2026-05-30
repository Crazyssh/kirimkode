import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveVisibleServers } from "@/lib/site-settings";

// Hanya key ini yang boleh diakses publik
const PUBLIC_KEYS = ["wa_number", "deposit_enabled", "visible_servers"] as const;
type PublicKey = (typeof PUBLIC_KEYS)[number];

// GET /api/settings?key=wa_number
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const key = searchParams.get("key") as PublicKey | null;

  if (!key || !PUBLIC_KEYS.includes(key as PublicKey)) {
    return NextResponse.json({ error: "Key tidak valid" }, { status: 400 });
  }

  // visible_servers: apply auto-hide untuk Clowatch yang unhealthy
  if (key === "visible_servers") {
    const list = await getEffectiveVisibleServers();
    return NextResponse.json({ data: { key, value: list } });
  }

  const setting = await db.siteSetting.findUnique({ where: { key } });

  return NextResponse.json({
    data: { key, value: setting?.value ?? null },
  });
}
