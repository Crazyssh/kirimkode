import { NextRequest, NextResponse } from "next/server";
import { getLayanan } from "@/lib/otp";
import { applyPricing } from "@/lib/pricing";

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
    const data = await getLayanan(server, Number(negara));

    // Apply custom pricing from admin rules
    const negaraId = Number(negara);

    // Find the service data object in the response
    // JasaOTP response format: { "6": { "wa": { harga, stok, layanan }, ... } }
    const negaraKey = String(negaraId);
    let serviceData: Record<string, { harga: number; stok: number; layanan: string }> | null = null;

    if (data?.[negaraKey] && typeof data[negaraKey] === "object") {
      serviceData = data[negaraKey];
    } else if (data?.data?.[negaraKey]) {
      serviceData = data.data[negaraKey];
    }

    if (serviceData) {
      // Apply pricing rules to each service
      for (const [code, info] of Object.entries(serviceData)) {
        if (info && typeof info === "object" && "harga" in info) {
          const customPrice = await applyPricing(info.harga, code, negaraId);
          info.harga = customPrice;
        }
      }
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Gagal mengambil daftar layanan" }, { status: 500 });
  }
}
