import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  CLOWATCH_SERVERS,
  getClowatchHealth,
  setClowatchHealth,
  isClowatchAutoManaged,
  setClowatchAutoManaged,
  invalidateSettingCache,
} from "@/lib/site-settings";
import { runHealthCheck } from "@/lib/clowatch-health";

/**
 * GET /api/admin/clowatch-health
 *   Return: { servers: [{ serverId, status, failCount, lastCheckAt, lastSuccessAt, autoManaged, lastError? }] }
 *
 * POST /api/admin/clowatch-health
 *   Body: { action: "toggleAuto" | "forceCheck" | "forceStatus", serverId, ...args }
 *
 *   Actions:
 *     - toggleAuto: { serverId, enabled: boolean }
 *     - forceCheck: { serverId } — jalankan health check manual sekarang
 *     - forceStatus: { serverId, status: "healthy" | "unhealthy" } — manual override status
 */

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const servers = await Promise.all(
    CLOWATCH_SERVERS.map(async (serverId) => {
      const [health, autoManaged] = await Promise.all([
        getClowatchHealth(serverId),
        isClowatchAutoManaged(serverId),
      ]);
      return {
        serverId,
        status: health.status,
        failCount: health.failCount,
        lastCheckAt: health.lastCheckAt,
        lastSuccessAt: health.lastSuccessAt,
        lastError: health.lastError ?? null,
        autoManaged,
      };
    })
  );

  return NextResponse.json({ data: { servers } });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: { action?: string; serverId?: string; enabled?: boolean; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }

  const { action, serverId } = body;

  if (!serverId || !CLOWATCH_SERVERS.includes(serverId as (typeof CLOWATCH_SERVERS)[number])) {
    return NextResponse.json(
      { error: "serverId tidak valid (harus api5/api8/api9/api10)" },
      { status: 400 }
    );
  }

  if (action === "toggleAuto") {
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled harus boolean" }, { status: 400 });
    }
    await setClowatchAutoManaged(serverId, body.enabled);
    invalidateSettingCache("visible_servers");
    return NextResponse.json({ success: true });
  }

  if (action === "forceCheck") {
    const { state, changed } = await runHealthCheck(serverId);
    if (changed) invalidateSettingCache("visible_servers");
    return NextResponse.json({ success: true, data: state });
  }

  if (action === "forceStatus") {
    if (body.status !== "healthy" && body.status !== "unhealthy") {
      return NextResponse.json(
        { error: "status harus 'healthy' atau 'unhealthy'" },
        { status: 400 }
      );
    }
    const prev = await getClowatchHealth(serverId);
    await setClowatchHealth(serverId, {
      ...prev,
      status: body.status,
      failCount: body.status === "healthy" ? 0 : prev.failCount,
      lastCheckAt: Date.now(),
      lastSuccessAt: body.status === "healthy" ? Date.now() : prev.lastSuccessAt,
    });
    invalidateSettingCache("visible_servers");
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "action tidak dikenal" }, { status: 400 });
}
