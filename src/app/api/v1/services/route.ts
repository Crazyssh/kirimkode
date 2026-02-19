import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, checkRateLimit } from "@/lib/api-auth";
import { getLayanan, getNegara } from "@/lib/otp";

export async function GET(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) {
    return NextResponse.json({ status: "error", message: "Invalid API key" }, { status: 401 });
  }
  const rateLimited = checkRateLimit(user.id);
  if (rateLimited) return rateLimited;

  const server = (req.nextUrl.searchParams.get("server") || "api1") as "api1" | "api2";
  const negara = Number(req.nextUrl.searchParams.get("country") || "6");

  if (!["api1", "api2"].includes(server)) {
    return NextResponse.json({ status: "error", message: "Invalid server (api1 or api2)" }, { status: 400 });
  }

  try {
    const data = await getLayanan(server, negara);
    const negaraKey = String(negara);
    const layananData = data?.[negaraKey] || data?.data?.[negaraKey] || {};

    const services = Object.entries(layananData)
      .filter(([, info]) => info && typeof info === "object" && "layanan" in (info as Record<string, unknown>))
      .map(([code, info]) => {
        const item = info as { layanan: string; harga: number; stok: number };
        return {
          code,
          name: item.layanan,
          price: item.harga,
          stock: item.stok,
        };
      });

    return NextResponse.json({ status: "success", data: services });
  } catch {
    return NextResponse.json({ status: "error", message: "Failed to fetch services" }, { status: 500 });
  }
}
