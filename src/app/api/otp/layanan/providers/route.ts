import { NextRequest, NextResponse } from "next/server";
import { getServiceProviders } from "@/lib/unified-provider";

/**
 * GET /api/otp/layanan/providers?negara=<virtualId>&code=<serviceCode>
 * Returns all provider options for a specific service.
 * User clicks "WhatsApp" → sees api1/api2/api3 with prices.
 */
export async function GET(req: NextRequest) {
  const negara = req.nextUrl.searchParams.get("negara");
  const code = req.nextUrl.searchParams.get("code");

  if (!negara) {
    return NextResponse.json({ error: "Parameter negara diperlukan" }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "Parameter code diperlukan" }, { status: 400 });
  }

  try {
    const data = await getServiceProviders(Number(negara), code);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180",
      },
    });
  } catch {
    return NextResponse.json({ error: "Gagal mengambil data provider" }, { status: 500 });
  }
}
