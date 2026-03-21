import { NextRequest, NextResponse } from "next/server";
import { syncAllJasaOTP } from "@/lib/sync-providers";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  // Validasi secret key
  const key = req.nextUrl.searchParams.get("key");

  if (!CRON_SECRET || key !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron] Sync started...");
    const results = await syncAllJasaOTP();
    console.log("[Cron] Sync completed.");

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: results.map((r) => ({
        server: r.server,
        countries: r.countries,
        services: r.services,
        operators: r.operators,
        errors: r.errors.length,
        durationMs: r.durationMs,
      })),
    });
  } catch (error) {
    console.error("[Cron] Sync failed:", error);
    return NextResponse.json(
      { error: "Sync failed", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
