import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createOrder, getLayanan } from "@/lib/otp";
import { applyPricing } from "@/lib/pricing";
import { logAction } from "@/lib/audit";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { otpOrderSchema, validateBody } from "@/lib/validations";

/**
 * Ambil harga dari server + apply pricing rules.
 * TIDAK BOLEH percaya harga dari client.
 * Untuk api1/api2: ambil harga dari database (cached by cron sync).
 * Untuk api3: harga sudah final dari adapter (USD→IDR + markup), skip applyPricing.
 * Untuk api4: harga sudah final dari adapter (markup 40%), skip applyPricing.
 */
async function getServerPrice(server: "api1" | "api2" | "api3" | "api4", negara: number, layanan: string): Promise<number> {
  // api1/api2/api3: coba ambil dari database dulu
  if (server === "api1" || server === "api2" || server === "api3") {
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
        // api3: harga sudah final (USD→IDR + markup), skip applyPricing
        if (server === "api3") return service.price;
        return applyPricing(service.price, layanan, negara);
      }
    }

    // Fallback: DB kosong, ambil dari API langsung
  }

  const data = await getLayanan(server, negara);
  const negaraKey = String(negara);

  const serviceData = data?.[negaraKey] ?? data?.data?.[negaraKey];
  const serviceInfo = serviceData?.[layanan];

  if (!serviceInfo || typeof serviceInfo.harga !== "number") {
    throw new Error("Layanan tidak ditemukan atau harga tidak tersedia");
  }

  // api3 & api4: harga sudah termasuk konversi + markup dari adapter
  if (server === "api3" || server === "api4") return serviceInfo.harga;

  return applyPricing(serviceInfo.harga, layanan, negara);
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

    // Harga WAJIB dari server, bukan dari client
    const orderPrice = await getServerPrice(server as "api1" | "api2" | "api3" | "api4", Number(negara), layanan);

    // Step 1: Pre-check user balance + status (quick DB read, no transaction needed)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { balance: true, status: true },
    });

    if (!user) throw new Error("User not found");
    if (user.status === "banned") throw new Error("ACCOUNT_BANNED");
    if (user.balance < orderPrice) throw new Error("INSUFFICIENT_BALANCE");

    // Step 2: Call provider API (bisa lambat, HARUS di luar transaction)
    const data = await createOrder(server as "api1" | "api2" | "api3" | "api4", Number(negara), layanan, operator);

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

    // Deteksi error stok habis dari JasaOTP
    const isStock = /stok|stock|habis|unavailable|empty|sold.?out|not.?available|no.?number/i.test(rawMsg);
    if (isStock) {
      return NextResponse.json(
        { error: "Stok habis untuk layanan ini. Coba negara atau operator lain.", message: "Stok habis" },
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
