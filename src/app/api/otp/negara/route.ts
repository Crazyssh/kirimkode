import { NextRequest, NextResponse } from "next/server";
import { getNegara } from "@/lib/otp";
import { db } from "@/lib/db";
import { getUnifiedNegara } from "@/lib/unified-provider";

export async function GET(req: NextRequest) {
  const server = req.nextUrl.searchParams.get("server") as "api1" | "api2" | "api3" | "api4" | "api5" | "api6" | "api7" | "api8" | "api9" | "api10" | "unified";

  if (!server || !["api1", "api2", "api3", "api4", "api5", "api6", "api7", "api8", "api9", "api10", "unified"].includes(server)) {
    return NextResponse.json({ error: "Server parameter required" }, { status: 400 });
  }

  try {
    // unified: merged negara dari semua provider
    if (server === "unified") {
      const data = await getUnifiedNegara();
      return NextResponse.json(data, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      });
    }

    // api4 (Neptune): LIVE dari HeroSMS getCountries (semua negara), bukan DB.
    if (server === "api4") {
      const data = await getNegara("api4");
      return NextResponse.json(data, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      });
    }

    // api1/api2/api3/api5/api6/api7/api8/api9/api10: baca dari database (cached by cron sync)
    if (["api1", "api2", "api3", "api5", "api6", "api7", "api8", "api9", "api10"].includes(server)) {
      const countries = await db.providerCountry.findMany({
        where: { serverId: server },
        select: { externalId: true, name: true },
        orderBy: { name: "asc" },
      });

      // Kalau DB kosong (belum pernah sync), fallback ke API langsung
      if (countries.length === 0) {
        const data = await getNegara(server);
        return NextResponse.json(data, {
          headers: {
            "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: countries.map((c) => ({
          id_negara: c.externalId,
          nama_negara: c.name,
        })),
      }, {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
        },
      });
    }

    // fallback: fetch langsung dari provider API
    const data = await getNegara(server);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    });
  } catch {
    return NextResponse.json({ error: "Gagal mengambil daftar negara" }, { status: 500 });
  }
}
