import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/server-health";

/**
 * GET /api/health/status
 * Return current server health status (public, no auth).
 * Polled by frontend every 30 seconds.
 */
export async function GET() {
  const status = getHealthStatus();

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
