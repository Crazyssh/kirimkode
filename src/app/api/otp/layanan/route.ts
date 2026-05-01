import { NextRequest, NextResponse } from "next/server";
import { getLayanan } from "@/lib/otp";
import { applyPricing } from "@/lib/pricing";
import { db } from "@/lib/db";
import { getUnifiedLayanan } from "@/lib/unified-provider";

export async function GET(req: NextRequest) {
  const server = req.nextUrl.searchParams.get("server") as "api1" | "api2" | "api3" | "api4" | "unified";
  const negara = req.nextUrl.searchParams.get("negara");

  if (!server || !["api1", "api2", "api3", "api4", "unified"].includes(server)) {
    return NextResponse.json({ error: "Server parameter required" }, { status: 400 });
  }

  if (!negara) {
    return NextResponse.json({ error: "Parameter negara diperlukan" }, { status: 400 });
  }

  try {
    const negaraId = Number(negara);

    // unified: merged layanan dari semua provider
    if (server === "unified") {
      const data = await getUnifiedLayanan(negaraId);
      return NextResponse.json(data, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180" },
      });
    }

    // api4: baca dari database (manual entries by admin)
    if (server === "api4") {
      const country = await db.providerCountry.findUnique({
        where: {
          serverId_externalId: {
            serverId: "api4",
            externalId: negaraId,
          },
        },
        select: { id: true },
      });

      const negaraKey = String(negaraId);
      if (!country) {
        return NextResponse.json({ [negaraKey]: {} });
      }

      const services = await db.providerService.findMany({
        where: { serverId: "api4", countryId: country.id },
        select: { code: true, name: true, price: true, stock: true },
        orderBy: [{ name: "asc" }, { price: "asc" }],
      });

      const serviceData: Record<string, { harga: number; stok: number; layanan: string }> = {};
      for (const svc of services) {
        serviceData[svc.code] = {
          harga: svc.price,
          stok: svc.stock,
          layanan: svc.name,
        };
      }

      return NextResponse.json({ [negaraKey]: serviceData }, {
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
      });
    }

    // api1/api2/api3: baca dari database (cached by cron sync)
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

      // Build response format: { "negaraId": { "code": { harga, stok, layanan } } }
      const negaraKey = String(negaraId);
      const serviceData: Record<string, { harga: number; stok: number; layanan: string }> = {};

      for (const svc of services) {
        const skipPricing = server === "api3";
        let customPrice: number;
        if (skipPricing) {
          customPrice = svc.price;
        } else {
          const result = await applyPricing(svc.price, svc.code, negaraId);
          customPrice = result.price;
        }

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

    // Fallback: kalau belum ada di DB, fetch dari provider API langsung
    const data = await getLayanan(server, negaraId);

    // Apply custom pricing
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
          const rawPrice = info.harga;
          const result = await applyPricing(rawPrice, code, negaraId);
          info.harga = result.price;
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
