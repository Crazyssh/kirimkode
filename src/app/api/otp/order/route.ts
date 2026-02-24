import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createOrder, getLayanan } from "@/lib/otp";
import { applyPricing } from "@/lib/pricing";
import { logAction } from "@/lib/audit";
import { checkRouteRateLimit } from "@/lib/rate-limit";

/**
 * Ambil harga dari server JasaOTP + apply pricing rules.
 * TIDAK BOLEH percaya harga dari client.
 */
async function getServerPrice(server: "api1" | "api2", negara: number, layanan: string): Promise<number> {
  const data = await getLayanan(server, negara);
  const negaraKey = String(negara);

  const serviceData = data?.[negaraKey] ?? data?.data?.[negaraKey];
  const serviceInfo = serviceData?.[layanan];

  if (!serviceInfo || typeof serviceInfo.harga !== "number") {
    throw new Error("Layanan tidak ditemukan atau harga tidak tersedia");
  }

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
    const { server, negara, layanan, operator, serviceName, countryName } = body;

    if (!server || !["api1", "api2"].includes(server)) {
      return NextResponse.json({ error: "Server parameter required (api1 or api2)" }, { status: 400 });
    }

    if (!negara || !layanan || !operator) {
      return NextResponse.json({ error: "Parameter negara, layanan, dan operator diperlukan" }, { status: 400 });
    }

    // Harga WAJIB dari server, bukan dari client
    const orderPrice = await getServerPrice(server as "api1" | "api2", Number(negara), layanan);

    // Atomic balance check + deduct dalam interactive transaction
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });

      if (!user) throw new Error("User not found");

      if (user.balance < orderPrice) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // Call JasaOTP untuk buat order
      const data = await createOrder(server as "api1" | "api2", Number(negara), layanan, operator);

      const orderId = data?.order_id ?? data?.data?.order_id ?? data?.id;
      const number = data?.number ?? data?.data?.number ?? "";

      if (!orderId || !number) {
        throw new Error(data?.message || "Gagal membuat pesanan, respons tidak valid");
      }

      // Deduct balance dan simpan order (atomic)
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
      },
    });
  } catch (error) {
    console.error("Order error:", error);
    const rawMsg = error instanceof Error ? error.message : "";

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

    return NextResponse.json({ error: "Gagal membuat pesanan" }, { status: 500 });
  }
}
