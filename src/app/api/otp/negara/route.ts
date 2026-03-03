import { NextRequest, NextResponse } from "next/server";
import { getNegara } from "@/lib/otp";

export async function GET(req: NextRequest) {
  const server = req.nextUrl.searchParams.get("server") as "api1" | "api2";

  if (!server || !["api1", "api2"].includes(server)) {
    return NextResponse.json({ error: "Server parameter required (api1 or api2)" }, { status: 400 });
  }

  try {
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
