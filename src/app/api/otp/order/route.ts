import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createOrder, getLayanan } from "@/lib/otp";
import { applyPricing, applyServerExtraMarkup, applyErisPricing, applyMercuryPricing } from "@/lib/pricing";
import { logAction } from "@/lib/audit";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { otpOrderSchema, validateBody } from "@/lib/validations";
import { getEffectiveVisibleServers, getUnifiedProviders } from "@/lib/site-settings";

/**
 * Refund saldo (rollback reserve) dengan retry + log jelas.
 *
 * PENTING: jangan pernah pakai .catch(() => {}) untuk refund — kalau gagal silent,
 * saldo user kepotong tapi gak balik = hilang tanpa jejak. Helper ini retry 3x,
 * dan kalau tetap gagal, log CRITICAL biar bisa refund manual.
 */
async function refundBalance(userId: string, amount: number, reason: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await db.user.update({
        where: { id: userId },
        data: { balance: { increment: amount } },
      });
      return true;
    } catch (err) {
      console.error(`[Order] Refund gagal (attempt ${attempt}/3) user=${userId} amount=${amount} reason=${reason}:`, (err as Error).message);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  // Semua attempt gagal — log CRITICAL untuk refund manual
  console.error(`[Order] CRITICAL REFUND_LOST: user=${userId} amount=${amount} reason=${reason} — SALDO HILANG, REFUND MANUAL DIPERLUKAN`);
  return false;
}

/**
 * Restore stock api4 (+1) dengan retry. Best-effort, tapi log kalau gagal.
 */
async function restoreApi4Stock(serviceId: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await db.providerService.updateMany({
        where: { id: serviceId },
        data: { stock: { increment: 1 } },
      });
      return;
    } catch (err) {
      console.error(`[Order] Restore stock gagal (attempt ${attempt}/3) service=${serviceId}:`, (err as Error).message);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  console.error(`[Order] CRITICAL STOCK_LOST: service=${serviceId} — stock tidak ter-restore`);
}

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
async function getServerPrice(server: "api1" | "api2" | "api3" | "api5" | "api6" | "api7" | "api8" | "api9" | "api10", negara: number, layanan: string): Promise<number> {
  // api3, api6, api9: harga sudah final (USD→IDR atau langsung IDR), skip applyPricing
  // api1/api2/api5/api7/api8: harga raw dari provider, apply admin pricing rules
  // api8 (Mercury) tambah flat markup +Rp 115 di atas Earth's pricing
  // api10 (Eris): pricing rule TERPISAH namespace "eris:" (applyErisPricing)
  const skipPricing = server === "api3" || server === "api6" || server === "api9";
  const isEris = server === "api10";
  const isMercury = server === "api8";

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
      if (isEris) {
        const result = await applyErisPricing(service.price, layanan, negara);
        return result.price;
      }
      if (isMercury) {
        const result = await applyMercuryPricing(service.price, layanan, negara);
        return result.price;
      }
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

  if (isEris) {
    const result = await applyErisPricing(serviceInfo.harga, layanan, negara);
    return result.price;
  }
  if (isMercury) {
    const result = await applyMercuryPricing(serviceInfo.harga, layanan, negara);
    return result.price;
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

    // === Validasi server visibility (anti-bypass) ===
    // User TIDAK boleh order ke server yang di-hide admin, walau kirim param langsung.
    // Server boleh kalau: (a) visible di /buy, ATAU (b) ikut Bimasakti (unified providers)
    // — karena order via Bimasakti memang pakai serverId provider asli.
    const [visibleServers, unifiedProviders] = await Promise.all([
      getEffectiveVisibleServers(),
      getUnifiedProviders(),
    ]);
    const unifiedVisible = visibleServers.includes("unified");
    const allowed =
      visibleServers.includes(server) ||
      (unifiedVisible && unifiedProviders.includes(server));
    if (!allowed) {
      return NextResponse.json(
        { error: "Server tidak tersedia. Silakan pilih server lain." },
        { status: 403 }
      );
    }

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
      orderPrice = await getServerPrice(server as "api1" | "api2" | "api3" | "api5" | "api6" | "api7" | "api8" | "api9" | "api10", Number(negara), layanan);
    }

    // === ALUR CHARGE-AFTER: dapat nomor DULU, baru potong saldo ===
    // Pre-check status user
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { status: true, balance: true },
    });
    if (!user) throw new Error("User not found");
    if (user.status === "banned") throw new Error("ACCOUNT_BANNED");

    // Pre-check saldo (cek kasar dulu sebelum panggil provider — hemat call provider
    // kalau jelas-jelas saldo gak cukup). Potong final tetap atomic setelah dapat nomor.
    if (user.balance < orderPrice) throw new Error("INSUFFICIENT_BALANCE");

    // api4: cek + decrement stock dulu (race-safe) sebelum panggil provider.
    if (api4ServiceId) {
      const stockUpdate = await db.providerService.updateMany({
        where: { id: api4ServiceId, stock: { gt: 0 } },
        data: { stock: { decrement: 1 } },
      });
      if (stockUpdate.count === 0) throw new Error("STOK_HABIS");
    }

    // Step 1: Call provider API untuk dapat nomor. Kalau GAGAL → restore stock api4.
    // Saldo BELUM dipotong di tahap ini.
    let data;
    try {
      data = await createOrder(server as "api1" | "api2" | "api3" | "api4" | "api5" | "api6" | "api7" | "api8" | "api9" | "api10", Number(negara), layanan, operator, {
        noTimeout: isBulk,
        maxPriceUsd: api4MaxPriceUsd,
        fixedPrice: api4FixedPrice,
      });
    } catch (providerErr) {
      if (api4ServiceId) await restoreApi4Stock(api4ServiceId);
      throw providerErr;
    }

    const orderId = data?.order_id ?? data?.data?.order_id ?? data?.id;
    const number = data?.number ?? data?.data?.number ?? "";

    if (!orderId || !number) {
      if (api4ServiceId) await restoreApi4Stock(api4ServiceId);
      throw new Error(data?.message || "Gagal membuat pesanan, respons tidak valid");
    }

    // Step 2: Sudah dapat nomor → POTONG saldo sekarang (atomic conditional).
    // Atomic `WHERE balance >= price` mencegah saldo minus saat order parallel:
    // walau 5 request dapat nomor bareng, cuma yang saldonya cukup yang ter-charge.
    const charge = await db.user.updateMany({
      where: { id: userId, balance: { gte: orderPrice } },
      data: { balance: { decrement: orderPrice } },
    });
    if (charge.count === 0) {
      // Saldo gak cukup (keduluan order lain) → batalkan nomor di provider + restore stock.
      // User TIDAK kena charge karena potong saldo gagal.
      try {
        const { cancelOrder } = await import("@/lib/otp");
        await cancelOrder(
          server as "api1" | "api2" | "api3" | "api4" | "api5" | "api6" | "api7" | "api8" | "api9" | "api10",
          Number(orderId)
        );
      } catch (cancelErr) {
        console.error(`[Order] Saldo kurang setelah dapat nomor, tapi gagal cancel ${orderId} (${server}):`, (cancelErr as Error).message);
      }
      if (api4ServiceId) await restoreApi4Stock(api4ServiceId);
      throw new Error("INSUFFICIENT_BALANCE");
    }

    // Step 3: Simpan order record. Saldo SUDAH dipotong di Step 2.
    // Kalau create gagal → refund saldo + restore stock + cancel di provider biar gak orphan.
    let result;
    try {
      const order = await db.order.create({
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
      result = { orderId, number: String(number), order };
    } catch (txErr) {
      // Gagal simpan order → refund saldo (yg sudah dipotong) + restore stock + cancel di provider
      await refundBalance(userId, orderPrice, `gagal simpan order record (${server}, orderId=${orderId})`);
      if (api4ServiceId) await restoreApi4Stock(api4ServiceId);
      try {
        const { cancelOrder } = await import("@/lib/otp");
        await cancelOrder(
          server as "api1" | "api2" | "api3" | "api4" | "api5" | "api6" | "api7" | "api8" | "api9" | "api10",
          Number(orderId)
        );
      } catch (cancelErr) {
        console.error(`[Order] ORPHAN ALERT: order ${orderId} (${server}) gagal disimpan DAN gagal cancel di provider. Cek manual:`, (cancelErr as Error).message);
      }
      throw txErr;
    }

    logAction(session.user.id, "order", JSON.stringify({
      orderId: result.orderId,
      server,
      service: serviceName || layanan,
      country: countryName || String(negara),
      price: orderPrice,
    }));

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
