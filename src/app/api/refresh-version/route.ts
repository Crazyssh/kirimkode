import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/refresh-version
 * Endpoint publik (ringan, no auth) — return timestamp `force_refresh_at`.
 *
 * Client polling tiap 30 detik. Kalau timestamp lebih besar dari yang
 * tersimpan di localStorage, client otomatis hard refresh.
 *
 * Use case: admin update kode/setting yang berdampak ke semua user
 * (misal server visibility), tanpa harus logout / kirim email.
 */
export async function GET() {
  try {
    const setting = await db.siteSetting.findUnique({
      where: { key: "force_refresh_at" },
      select: { value: true },
    });

    const ts = setting?.value ? Number(setting.value) || 0 : 0;

    return NextResponse.json(
      { ts },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch {
    return NextResponse.json({ ts: 0 });
  }
}
