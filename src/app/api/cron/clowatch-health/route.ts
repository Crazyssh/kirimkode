import { NextRequest, NextResponse } from "next/server";
import { runHealthCheck, shouldCheck } from "@/lib/clowatch-health";
import { CLOWATCH_SERVERS, invalidateSettingCache } from "@/lib/site-settings";

const CRON_SECRET = process.env.CRON_SECRET || "";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/clowatch-health
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 *
 * Jalankan via crontab tiap 30 detik:
 *   * * * * * sleep 0 ; curl -s -H "Authorization: Bearer $SECRET" https://kirimkode.com/api/cron/clowatch-health
 *   * * * * * sleep 30; curl -s -H "Authorization: Bearer $SECRET" https://kirimkode.com/api/cron/clowatch-health
 *
 * Logic:
 *   - Untuk tiap server Clowatch yang auto-managed:
 *     - Skip kalau lastCheckAt < interval (10 menit healthy, 30 detik unhealthy)
 *     - Run health check (test order WA → TG)
 *     - Update status di DB
 *   - Server yang status berubah → invalidate cache visible_servers
 */
export async function GET(req: NextRequest) {
  if (!CRON_SECRET && process.env.NODE_ENV === "production") {
    console.error("[CRON] CRON_SECRET not set in production!");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{
    serverId: string;
    skipped: boolean;
    status?: string;
    failCount?: number;
    changed?: boolean;
    error?: string;
  }> = [];

  for (const serverId of CLOWATCH_SERVERS) {
    try {
      const should = await shouldCheck(serverId);
      if (!should) {
        results.push({ serverId, skipped: true });
        continue;
      }

      const { state, changed } = await runHealthCheck(serverId);
      results.push({
        serverId,
        skipped: false,
        status: state.status,
        failCount: state.failCount,
        changed,
        error: state.lastError,
      });

      if (changed) {
        // Status berubah → invalidate effective visible_servers cache
        invalidateSettingCache("visible_servers");
      }
    } catch (err) {
      console.error(`[ClowatchHealth] Error checking ${serverId}:`, err);
      results.push({
        serverId,
        skipped: false,
        error: (err as Error)?.message?.slice(0, 200),
      });
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
