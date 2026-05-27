import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createOrder, getLayanan } from "@/lib/otp";
import { applyPricing, applyServerExtraMarkup } from "@/lib/pricing";
import { logAction } from "@/lib/audit";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { otpOrderSchema, validateBody } from "@/lib/validations";

/**
 * Ambil entry api4 dari DB — manual stock by admin.
 * Throws "STOK_HABIS" kalau stock = 0, "LAYANAN_NOT_FOUND" kalau gak ada.
 */
async function getApi4Entry(negara: number, layanan: string): Promise<{
  serviceId: string;
  price: number;
  stock: number;
  maxPriceUsd: number | null;
  fixedPrice: boolean;
}> {
  const country = await db.providerCountry.findUnique({
    where: {
      serverId_externalId: { serverId: "api4", externalId: negara },
    },
    select: { id: true },
  });

  if (!country) throw new Error("LAYANAN_NOT_FOUND");

  const service = await db.providerService.findUnique({
    where: {
      serverId_countryId_code: {
        serverId: "api4",
        countryId: country.id,
        code: layanan,
      },
    },
    select: { id: true, price: true, stock: true, maxPriceUsd: true, fixedPrice: true },
  });

  if (!service) throw new Error("LAYANAN_NOT_FOUND");
  if (service.stock <= 0) throw new Error("STOK_HABIS");

  return {
    serviceId: service.id,
    price: service.price,
    stock: service.stock,
    maxPriceUsd: service.maxPriceUsd,
    fixedPrice: service.fixedPrice,
  };
}

/**
 * Ambil harga dari server + apply pricing rules.
 * TIDAK BOLEH percaya harga dari client.
 * Untuk api1/api2/api5/api7: ambil harga dari database (cached by cron sync), apply pricing.
 * Untuk api3 & api6: harga sudah final dari adapter (USD→IDR + markup), skip applyPricing.
 * (api4 di-handle terpisah di POST handler — pake getApi4Entry)
 *
 * Note: api7 (Mars V2) share PriceRule dengan api1 (Mars) karena format country ID
 * sama (JasaOTP-style) dan rule kita match by serviceCode+countryId tanpa server.
 */
async function getServerPrice(server: "api1" | "api2" | "api3" | "api5" | "api6" | "api7" | "api8", negara: number, layanan: string): Promise<number> {
  // api3 & api6: harga sudah final (USD→IDR), skip applyPricing
  // api1/api2/api5/api7/api8: harga raw dari provider, apply admin pricing rules
  // api8 (Mercury) tambah flat markup +Rp 115 di atas Earth's pricing
  const skipPricing = server === "api3" || server === "api6";

  // Coba ambil dari database dulu (synced by cron)
  const country = await db.providerCountry.findUnique({
    where: {
      serverId_externalId: {
        serverId: server,
        externalId: negara,
      },
    },
    select: { id: true },
  });

  if (country) {
    const service = await db.providerService.findUnique({
      where: {
        serverId_countryId_code: {
          serverId: server,
          countryId: country.id,
          code: layanan,
        },
      },
      select: { price: true },
    });

    if (service) {
      if (skipPricing) return service.price;
      const result = await applyPricing(service.price, layanan, negara);
      return applyServerExtraMarkup(result.price, server);
    }
  }

  // Fallback: DB kosong, ambil dari API langsung

  const data = await getLayanan(server, negara);
  const negaraKey = String(negara);

  const serviceData = data?.[negaraKey] ?? data?.data?.[negaraKey];
  const serviceInfo = serviceData?.[layanan];

  if (!serviceInfo || typeof serviceInfo.harga !== "number") {
    throw new Error("Layanan tidak ditemukan atau harga tidak tersedia");
  }

  if (skipPricing) return serviceInfo.harga;

  const result = await applyPricing(serviceInfo.harga, layanan, negara);
  return applyServerExtraMarkup(result.price, server);
}


export async function POST(req: NextRequest) {
  try {
    // Rate limit: max 50 order per IP per menit
    const rateLimited = checkRouteRateLimit(req, "otp-order", 50, 60000);
    if (rateLimited) return rateLimited;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const body = await req.json();
    const validated = validateBody(otpOrderSchema, body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { server, negara, layanan, operator, serviceName, countryName } = validated.data;
    const isBulk = body.bulk === true;

    // Untuk api4: ambil entry dari DB (price + maxPriceUsd + stock + serviceId)
    // Untuk api1/api2/api3: ambil harga dari server (DB atau API)
    let orderPrice: number;
    let api4ServiceId: string | null = null;
    let api4MaxPriceUsd: number | null = null;
    let api4FixedPrice: boolean = true;

    if (server === "api4") {
      const entry = await getApi4Entry(Number(negara), layanan);
      orderPrice = entry.price;
      api4ServiceId = entry.serviceId;
      api4MaxPriceUsd = entry.maxPriceUsd;
      api4FixedPrice = entry.fixedPrice;
    } else {
      // Harga WAJIB dari server, bukan dari client
      orderPrice = await getServerPrice(server as "api1" | "api2" | "api3" | "api5" | "api6" | "api7" | "api8", Number(negara), layanan);
    }

    // Step 1: Pre-check user balance + status (quick DB read, no transaction needed)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { balance: true, status: true },
    });

    if (!user) throw new Error("User not found");
    if (user.status === "banned") throw new Error("ACCOUNT_BANNED");
    if (user.balance < orderPrice) throw new Error("INSUFFICIENT_BALANCE");

    // Step 2: Call provider API (bisa lambat, HARUS di luar transaction)
    // Bulk order: tanpa timeout, nunggu sampai server respon
    const data = await createOrder(server as "api1" | "api2" | "api3" | "api4" | "api5" | "api6" | "api7" | "api8", Number(negara), layanan, operator, {
      noTimeout: isBulk,
      maxPriceUsd: api4MaxPriceUsd,
      fixedPrice: api4FixedPrice,
    });

    const orderId = data?.order_id ?? data?.data?.order_id ?? data?.id;
    const number = data?.number ?? data?.data?.number ?? "";

    if (!orderId || !number) {
      throw new Error(data?.message || "Gagal membuat pesanan, respons tidak valid");
    }

    // Step 3: Atomic deduct + save order (cepat, hanya DB operations)
    const result = await db.$transaction(async (tx) => {
      // Re-check balance di dalam transaction (race condition protection)
      const freshUser = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });

      if (!freshUser || freshUser.balance < orderPrice) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: orderPrice } },
      });

      // api4: decrement stock manual entry (race-safe pakai update conditional)
      if (api4ServiceId) {
        const stockUpdate = await tx.providerService.updateMany({
          where: { id: api4ServiceId, stock: { gt: 0 } },
          data: { stock: { decrement: 1 } },
        });
        // Kalau gagal decrement (stock keburu habis di tab lain) → throw
        if (stockUpdate.count === 0) {
          throw new Error("STOK_HABIS");
        }
      }

      const order = await tx.order.create({
        data: {
          userId,
          server,
          orderId: Number(orderId),
          service: layanan,
          serviceName: serviceName || layanan,
          country: countryName || String(negara),
          countryId: Number(negara),
          number: String(number),
          price: orderPrice,
          status: "waiting",
          operator: operator || "any",
          source: "web",
        },
      });

      return { orderId, number: String(number), order };
    });

    logAction(session.user.id, "order", JSON.stringify({ orderId: result.orderId, service: layanan, server }));

    return NextResponse.json({
      success: true,
      data: {
        order_id: result.orderId,
        number: result.number,
        id: result.order.id,
      },
    });
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : "";
    console.error("Order error:", rawMsg);

    if (rawMsg === "ACCOUNT_BANNED") {
      return NextResponse.json(
        { error: "Akun Anda telah diblokir. Hubungi admin." },
        { status: 403 }
      );
    }

    if (rawMsg === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "Saldo tidak cukup. Silakan deposit terlebih dahulu." },
        { status: 402 }
      );
    }

    if (rawMsg === "STOK_HABIS") {
      return NextResponse.json(
        { error: "Stok habis untuk layanan ini.", message: "Stok habis" },
        { status: 409 }
      );
    }

    if (rawMsg === "LAYANAN_NOT_FOUND") {
      return NextResponse.json(
        { error: "Layanan tidak tersedia. Coba server atau negara lain." },
        { status: 404 }
      );
    }

    // Deteksi error stok habis dari provider (JasaOTP / HeroSMS NO_NUMBERS)
    const isStock = /stok|stock|habis|unavailable|empty|sold.?out|not.?available|no.?number/i.test(rawMsg);
    if (isStock) {
      return NextResponse.json(
        { error: "Stok habis untuk layanan ini.", message: "Stok habis" },
        { status: 409 }
      );
    }

    // Deteksi error harga/layanan tidak ditemukan
    const isPriceError = /layanan tidak ditemukan|harga tidak tersedia|not found/i.test(rawMsg);
    if (isPriceError) {
      return NextResponse.json(
        { error: "Layanan tidak tersedia untuk negara ini. Coba server atau negara lain." },
        { status: 404 }
      );
    }

    // Forward error message asli dari provider
    // Translate error teknis ke pesan user-friendly
    let userMsg = "Gagal membuat pesanan. Coba lagi atau pilih server/negara lain.";
    if (rawMsg && !["fetch failed", "This operation was aborted"].includes(rawMsg)) {
      userMsg = rawMsg;
    } else if (/aborted|timeout/i.test(rawMsg)) {
      userMsg = "Server provider terlalu lambat merespons. Coba lagi dalam beberapa detik.";
    }

    return NextResponse.json({ error: userMsg }, { status: 500 });
  }
}
