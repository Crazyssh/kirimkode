import { NextRequest, NextResponse } from "next/server";
import { getLayanan } from "@/lib/otp";
import { applyPricing } from "@/lib/pricing";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const server = req.nextUrl.searchParams.get("server") as "api1" | "api2" | "api3" | "api4";
  const negara = req.nextUrl.searchParams.get("negara");

  if (!server || !["api1", "api2", "api3", "api4"].includes(server)) {
    return NextResponse.json({ error: "Server parameter required" }, { status: 400 });
  }

  if (!negara) {
    return NextResponse.json({ error: "Parameter negara diperlukan" }, { status: 400 });
  }

  try {
    const negaraId = Number(negara);

    // api1/api2: baca dari database (cached by cron sync)
    if (server === "api1" || server === "api2") {
      // Cari country di DB
      const country = await db.providerCountry.findUnique({
        where: {
          serverId_externalId: {
            serverId: server,
            externalId: negaraId,
          },
        },
        select: { id: true },
      });

      // Kalau country ada di DB, ambil layanan dari DB
      if (country) {
        const services = await db.providerService.findMany({
          where: {
            serverId: server,
            countryId: country.id,
          },
          select: { code: true, name: true, price: true, stock: true },
        });

        // Build response format yang sama dengan JasaOTP: { "negaraId": { "code": { harga, stok, layanan } } }
        const negaraKey = String(negaraId);
        const serviceData: Record<string, { harga: number; stok: number; layanan: string }> = {};

        for (const svc of services) {
          // Apply pricing rules ke harga asli dari DB
          const customPrice = await applyPricing(svc.price, svc.code, negaraId);
          serviceData[svc.code] = {
            harga: customPrice,
            stok: svc.stock,
            layanan: svc.name,
          };
        }

        return NextResponse.json({ [negaraKey]: serviceData }, {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180",
          },
        });
      }

      // Fallback: kalau belum ada di DB, fetch dari API langsung
    }

    // api3/api4 atau fallback: fetch langsung dari provider API
    const data = await getLayanan(server, negaraId);

    // Apply custom pricing (skip for api3, already handled by adapter)
    const negaraKey = String(negaraId);
    let serviceData: Record<string, { harga: number; stok: number; layanan: string }> | null = null;

    if (data?.[negaraKey] && typeof data[negaraKey] === "object") {
      serviceData = data[negaraKey];
    } else if (data?.data?.[negaraKey]) {
      serviceData = data.data[negaraKey];
    }

    if (serviceData && server !== "api3") {
      for (const [code, info] of Object.entries(serviceData)) {
        if (info && typeof info === "object" && "harga" in info) {
          const customPrice = await applyPricing(info.harga, code, negaraId);
          info.harga = customPrice;
        }
      }
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180",
      },
    });
  } catch {
    return NextResponse.json({ error: "Gagal mengambil daftar layanan" }, { status: 500 });
  }
}
