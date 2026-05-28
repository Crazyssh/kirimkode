import { NextRequest, NextResponse } from "next/server";
import { getLayanan } from "@/lib/otp";
import { applyPricing, applyServerExtraMarkup } from "@/lib/pricing";
import { db } from "@/lib/db";
import { getUnifiedLayanan } from "@/lib/unified-provider";

export async function GET(req: NextRequest) {
  const server = req.nextUrl.searchParams.get("server") as "api1" | "api2" | "api3" | "api4" | "api5" | "api6" | "api7" | "api8" | "api9" | "unified";
  const negara = req.nextUrl.searchParams.get("negara");

  if (!server || !["api1", "api2", "api3", "api4", "api5", "api6", "api7", "api8", "api9", "unified"].includes(server)) {
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

      // Khusus api9 (Uranus): provider expose banyak varian operator dengan nama
      // sama (mis. "Whatsapp" dengan code wa, wa#virtual53, wa#virtual58).
      // Group by nama, pilih varian termurah dengan stok > 0, sum total stok.
      if (server === "api9") {
        const grouped = new Map<
          string,
          { bestCode: string; bestPrice: number; totalStock: number; layanan: string }
        >();

        for (const svc of services) {
          if (svc.stock <= 0) continue;
          const key = svc.name.toLowerCase();
          const existing = grouped.get(key);
          if (existing) {
            existing.totalStock += svc.stock;
            if (svc.price < existing.bestPrice) {
              existing.bestPrice = svc.price;
              existing.bestCode = svc.code;
            }
          } else {
            grouped.set(key, {
              bestCode: svc.code,
              bestPrice: svc.price,
              totalStock: svc.stock,
              layanan: svc.name,
            });
          }
        }

        for (const info of grouped.values()) {
          serviceData[info.bestCode] = {
            harga: info.bestPrice,
            stok: info.totalStock,
            layanan: info.layanan,
          };
        }

        return NextResponse.json({ [negaraKey]: serviceData }, {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180",
          },
        });
      }

      for (const svc of services) {
        // api3, api6: harga sudah final (USD→IDR + markup), skip applyPricing
        // (api9 sudah di-handle di blok atas dan return early)
        const skipPricing = server === "api3" || server === "api6";
        let customPrice: number;
        if (skipPricing) {
          customPrice = svc.price;
        } else {
          // api1/api2/api5/api7/api8: apply pricing rules (admin markup)
          // api7 (Mars V2) share PriceRule dengan api1 (Mars) karena rule match by serviceCode+countryId
          // api8 (Mercury) share PriceRule dengan api5 (Earth) + flat extra markup
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

    if (serviceData && server !== "api3" && server !== "api6" && server !== "api9") {
      // api1/api2/api5/api7/api8: apply pricing + flat extra markup (api8)
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
