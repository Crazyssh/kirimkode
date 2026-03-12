import { NextRequest, NextResponse } from "next/server";
import { runHealthCheck, getHealthStatus } from "@/lib/server-health";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * GET /api/cron/health
 * Trigger health check untuk server api1 & api2.
 * Auth: Bearer {CRON_SECRET}
 * Dipanggil oleh cron setiap 3 menit.
 */
export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get("authorization") || "";

  if (!CRON_SECRET && process.env.NODE_ENV === "production") {
    console.error("[CRON Health] CRON_SECRET not set in production!");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Run health checks in parallel
    const [api1Status, api2Status] = await Promise.all([
      runHealthCheck("api1"),
      runHealthCheck("api2"),
    ]);

    const result = getHealthStatus();

    console.log(`[CRON Health] api1=${api1Status}, api2=${api2Status}`);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[CRON Health] Error:", (err as Error).message);
    return NextResponse.json({ error: "Health check failed" }, { status: 500 });
  }
}
