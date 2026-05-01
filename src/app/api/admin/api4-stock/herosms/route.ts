import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import * as provider4 from "@/lib/provider4";

/**
 * Helper buat dropdown di admin UI:
 *   - ?type=countries → list negara HeroSMS
 *   - ?type=services&country=<id> → list service untuk country tertentu (dengan harga USD live)
 *
 * Pake provider4 (PROVIDER4_API_KEY).
 */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const type = req.nextUrl.searchParams.get("type");

  try {
    if (type === "countries") {
      const data = await provider4.getNegara();
      return NextResponse.json(data);
    }

    if (type === "services") {
      const countryParam = req.nextUrl.searchParams.get("country");
      if (!countryParam) {
        return NextResponse.json({ error: "Parameter country wajib" }, { status: 400 });
      }
      const country = Number(countryParam);
      const data = await provider4.getLayananRaw(country);
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "type harus 'countries' atau 'services'" }, { status: 400 });
  } catch (err) {
    console.error("herosms helper error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Gagal fetch dari HeroSMS" },
      { status: 500 }
    );
  }
}
