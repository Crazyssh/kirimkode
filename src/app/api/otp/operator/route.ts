import { NextRequest, NextResponse } from "next/server";
import { getOperator } from "@/lib/otp";

export async function GET(req: NextRequest) {
  const server = req.nextUrl.searchParams.get("server") as "api1" | "api2";
  const negara = req.nextUrl.searchParams.get("negara");

  if (!server || !["api1", "api2"].includes(server)) {
    return NextResponse.json({ error: "Server parameter required (api1 or api2)" }, { status: 400 });
  }

  if (!negara) {
    return NextResponse.json({ error: "Parameter negara diperlukan" }, { status: 400 });
  }

  try {
    const data = await getOperator(server, Number(negara));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Gagal mengambil daftar operator" }, { status: 500 });
  }
}
