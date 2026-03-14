import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "@/lib/otp";

export async function GET(req: NextRequest) {
  const server = req.nextUrl.searchParams.get("server") as "api1" | "api2" | "api3" | "api4";

  if (!server || !["api1", "api2", "api3", "api4"].includes(server)) {
    return NextResponse.json({ error: "Server parameter required" }, { status: 400 });
  }

  try {
    const data = await getBalance(server);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Gagal mengambil saldo" }, { status: 500 });
  }
}
