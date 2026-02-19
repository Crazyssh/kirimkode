import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "@/lib/otp";

export async function GET(req: NextRequest) {
  const server = req.nextUrl.searchParams.get("server") as "api1" | "api2";

  if (!server || !["api1", "api2"].includes(server)) {
    return NextResponse.json({ error: "Server parameter required (api1 or api2)" }, { status: 400 });
  }

  try {
    const data = await getBalance(server);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Gagal mengambil saldo" }, { status: 500 });
  }
}
