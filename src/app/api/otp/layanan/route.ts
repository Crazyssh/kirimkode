import { NextRequest, NextResponse } from "next/server";
import * as providerPartner from "@/lib/provider-partner";
import { getLayanan } from "@/lib/otp";
import { applyPricing, applyServerExtraMarkup, applyErisPricing, applyMercuryPricing } from "@/lib/pricing";
import { db } from "@/lib/db";
import { getUnifiedLayanan } from "@/lib/unified-provider";

export async function GET(req: NextRequest) {
  const server = req.nextUrl.searchParams.get("server") as "api1" | "api2" | "api3" | "api4" | "api5" | "api6" | "api7" | "api8" | "api9" | "api10" | "unified" | "partner";
  const negara = req.nextUrl.searchParams.get("negara");

  if (!server || !["api1", "api2", "api3", "api4", "api5", "api6", "api7", "api8", "api9", "api10", "unified", "partner"].includes(server)) {
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

    // api4 (Neptune): LIVE dari HeroSMS /offers (banding 0.01 USD + markup).
    // Harga sudah final di adapter → skip applyPricing.
    // Pluto (partner): harga + stok realtime dari inventory Partner Platform.
    if (server === "partner") {
      const data = await providerPartner.getLayanan(Number(negara));
      return NextResponse.json(data, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (server === "api4") {
      const data = await getLayanan("api4", negaraId);
      return NextResponse.json(data, {
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
      });
    }

    // api1/api2/api3: baca dari database (cached by cron sync)
    // api5 (Earth): juga di-sync ke DB, sama treatment seperti api1
    // api6 (Venus / 5sim): di-sync ke DB, harga sudah final IDR di adapter — skip applyPricing
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
        // api3, api6, api9: harga sudah final (USD→IDR + markup atau langsung IDR), skip applyPricing
        const skipPricing = server === "api3" || server === "api6" || server === "api9";
        let customPrice: number;
        if (server === "api10") {
          // api10 (Eris): pricing rule TERPISAH (namespace "eris:"), tidak ikut rule global.
          const result = await applyErisPricing(svc.price, svc.code, negaraId);
          customPrice = result.price;
        } else if (server === "api8") {
          // api8 (Mercury): pricing rule TERPISAH (namespace "mercury:"), tidak ikut rule global.
          const result = await applyMercuryPricing(svc.price, svc.code, negaraId);
          customPrice = result.price;
        } else if (skipPricing) {
          customPrice = svc.price;
        } else {
          // api1/api2/api5/api7: apply pricing rules (admin markup)
          // api7 (Mars V2) share PriceRule dengan api1 (Mars) karena rule match by serviceCode+countryId
          const result = await applyPricing(svc.price, svc.code, negaraId);
          customPrice = applyServerExtraMarkup(result.price, server);
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

    if (serviceData && server === "api10") {
      // api10 (Eris): pricing rule terpisah (namespace "eris:")
      for (const [code, info] of Object.entries(serviceData)) {
        if (info && typeof info === "object" && "harga" in info) {
          const result = await applyErisPricing(info.harga, code, negaraId);
          info.harga = result.price;
        }
      }
    } else if (serviceData && server === "api8") {
      // api8 (Mercury): pricing rule terpisah (namespace "mercury:")
      for (const [code, info] of Object.entries(serviceData)) {
        if (info && typeof info === "object" && "harga" in info) {
          const result = await applyMercuryPricing(info.harga, code, negaraId);
          info.harga = result.price;
        }
      }
    } else if (serviceData && server !== "api3" && server !== "api6" && server !== "api9") {
      // api1/api2/api5/api7: apply pricing
      // api3/api6/api9: harga sudah final dari adapter, skip
      for (const [code, info] of Object.entries(serviceData)) {
        if (info && typeof info === "object" && "harga" in info) {
          const rawPrice = info.harga;
          const result = await applyPricing(rawPrice, code, negaraId);
          info.harga = applyServerExtraMarkup(result.price, server);
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
