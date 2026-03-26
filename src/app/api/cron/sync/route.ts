import { NextRequest, NextResponse } from "next/server";
import { syncAllProviders, syncProvider } from "@/lib/sync-providers";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  // Validasi secret key
  const key = req.nextUrl.searchParams.get("key");

  if (!CRON_SECRET || key !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional: sync 1 provider aja (untuk hindari timeout)
  // ?server=api1 | api2 | api3
  const server = req.nextUrl.searchParams.get("server");

  try {
    if (server && ["api1", "api2", "api3"].includes(server)) {
      console.log(`[Cron] Sync ${server} started...`);
      const result = await syncProvider(server as "api1" | "api2" | "api3");
      console.log(`[Cron] Sync ${server} completed.`);

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        results: [{
          server: result.server,
          countries: result.countries,
          services: result.services,
          operators: result.operators,
          errors: result.errors.length,
          durationMs: result.durationMs,
        }],
      });
    }

    // Sync semua provider (api1 + api2 + api3)
    console.log("[Cron] Sync all started...");
    const results = await syncAllProviders();
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
