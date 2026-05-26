import { NextRequest, NextResponse } from "next/server";
import { syncAllProviders, syncProvider } from "@/lib/sync-providers";
import { clearUnifiedCache } from "@/lib/unified-provider";
import { getUsdToIdr } from "@/lib/usd-rate";

const CRON_SECRET = process.env.CRON_SECRET || "";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 menit max (untuk Vercel, ignored di self-host)

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");

  if (!CRON_SECRET || key !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const server = req.nextUrl.searchParams.get("server");

  // Gunakan streaming response supaya Cloudflare gak timeout
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (msg: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(msg + "\n"));
        } catch { /* closed */ }
      };

      // Heartbeat tiap 10s — kirim newline kosong supaya Cloudflare/proxy
      // tidak nge-cut koneksi karena dianggap idle (default timeout 100s).
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode("\n"));
        } catch { /* closed */ }
      }, 10_000);

      try {
        // Refresh USD/IDR rate proactively (api3/api4/api6 use USD prices).
        // Tanpa await race — kurs di-fetch parallel dengan sync.
        try {
          const rate = await getUsdToIdr();
          send(`[Sync] USD/IDR rate: ${rate}`);
        } catch (e) {
          send(`[Sync] WARN refresh rate: ${(e as Error).message}`);
        }

        if (server && ["api1", "api2", "api3", "api5", "api6", "api7"].includes(server)) {
          send(`[Sync] Starting ${server}...`);
          const result = await syncProvider(server as "api1" | "api2" | "api3" | "api5" | "api6" | "api7");
          send(`[Sync] ${server} done: ${result.countries} countries, ${result.services} services in ${result.durationMs}ms`);
          if (result.errors.length > 0) {
            send(`[Sync] ${server} errors: ${result.errors.slice(0, 3).join(", ")}`);
          }
          send(JSON.stringify({ success: true, results: [result] }));
        } else {
          // Sync semua provider satu per satu dengan progress
          // api4 sengaja di-skip — diambil realtime dari API
          const results = [];
          for (const srv of ["api1", "api2", "api3", "api5", "api6", "api7"] as const) {
            send(`[Sync] Starting ${srv}...`);
            const result = await syncProvider(srv);
            send(`[Sync] ${srv} done: ${result.countries} countries, ${result.services} services in ${result.durationMs}ms`);
            if (result.errors.length > 0) {
              send(`[Sync] ${srv} errors (${result.errors.length}): ${result.errors.slice(0, 3).join(", ")}`);
            }
            results.push(result);
          }
          send(JSON.stringify({ success: true, results }));
        }
      } catch (error) {
        send(`[Sync] ERROR: ${(error as Error).message}`);
      }

      // Clear unified cache so normalizedName changes take effect immediately
      clearUnifiedCache();
      send("[Sync] Unified cache cleared.");

      clearInterval(heartbeat);
      closed = true;
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
