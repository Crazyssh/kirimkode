import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  getVisibleServers,
  getUnifiedProviders,
  invalidateSettingCache,
} from "@/lib/site-settings";

const ALLOWED_SERVERS = ["unified", "api1", "api4", "api5"];
const ALLOWED_UNIFIED_PROVIDERS = ["api1", "api2", "api3"];

/**
 * GET — Ambil current visibility settings.
 * Returns: { visibleServers: string[], unifiedProviders: string[] }
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [visibleServers, unifiedProviders] = await Promise.all([
    getVisibleServers(),
    getUnifiedProviders(),
  ]);

  return NextResponse.json({ data: { visibleServers, unifiedProviders } });
}

/**
 * POST — Update visibility settings.
 * Body: { visibleServers?: string[], unifiedProviders?: string[] }
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { visibleServers, unifiedProviders } = body;

    if (visibleServers !== undefined) {
      if (!Array.isArray(visibleServers) || !visibleServers.every((s) => typeof s === "string")) {
        return NextResponse.json(
          { error: "visibleServers harus array of string" },
          { status: 400 }
        );
      }
      // Validasi: semua entry harus dari ALLOWED_SERVERS
      const invalid = visibleServers.find((s) => !ALLOWED_SERVERS.includes(s));
      if (invalid) {
        return NextResponse.json(
          { error: `Server '${invalid}' tidak valid. Allowed: ${ALLOWED_SERVERS.join(", ")}` },
          { status: 400 }
        );
      }
      await db.siteSetting.upsert({
        where: { key: "visible_servers" },
        update: { value: JSON.stringify(visibleServers) },
        create: { key: "visible_servers", value: JSON.stringify(visibleServers) },
      });
      invalidateSettingCache("visible_servers");
    }

    if (unifiedProviders !== undefined) {
      if (!Array.isArray(unifiedProviders) || !unifiedProviders.every((s) => typeof s === "string")) {
        return NextResponse.json(
          { error: "unifiedProviders harus array of string" },
          { status: 400 }
        );
      }
      const invalid = unifiedProviders.find((s) => !ALLOWED_UNIFIED_PROVIDERS.includes(s));
      if (invalid) {
        return NextResponse.json(
          { error: `Provider '${invalid}' tidak valid. Allowed: ${ALLOWED_UNIFIED_PROVIDERS.join(", ")}` },
          { status: 400 }
        );
      }
      await db.siteSetting.upsert({
        where: { key: "unified_providers" },
        update: { value: JSON.stringify(unifiedProviders) },
        create: { key: "unified_providers", value: JSON.stringify(unifiedProviders) },
      });
      invalidateSettingCache("unified_providers");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("server-visibility POST error:", err);
    return NextResponse.json({ error: "Gagal menyimpan setting" }, { status: 500 });
  }
}
