import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { checkRouteRateLimit } from "@/lib/rate-limit";

const BOT_OTP_PRICE = 15000; // Rp 15.000 per OTP

/**
 * POST /api/v1/bot/deduct
 * Dipanggil oleh Telegram bot saat OTP berhasil diterima.
 * Potong saldo user + buat Order record.
 *
 * Headers: x-api-key
 * Body: { number, otp, service, serviceName, country, countryId }
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimited = checkRouteRateLimit(req, "v1-bot-deduct", 30, 60000);
    if (rateLimited) return rateLimited;

    const user = await authenticateApiKey(req);
    if (!user) {
      return apiError("Invalid API key", 401, "UNAUTHORIZED");
    }

    const body = await req.json();
    const { number, otp, service, serviceName, country, countryId } = body;

    if (!number || !otp) {
      return apiError("number dan otp wajib diisi", 400, "MISSING_FIELDS");
    }

    // Atomic: cek saldo + deduct + buat order
    const result = await db.$transaction(async (tx) => {
      const userData = await tx.user.findUnique({
        where: { id: user.id },
        select: { balance: true },
      });

      if (!userData) throw new Error("USER_NOT_FOUND");
      if (userData.balance < BOT_OTP_PRICE) throw new Error("INSUFFICIENT_BALANCE");

      // Deduct balance
      await tx.user.update({
        where: { id: user.id },
        data: { balance: { decrement: BOT_OTP_PRICE } },
      });

      // Buat order record
      // orderId harus fit di Int PostgreSQL (max 2,147,483,647)
      // Date.now() = ~1.7 triliun → overflow! Pakai modular + random
      const safeOrderId = (Date.now() % 1_000_000_000) + Math.floor(Math.random() * 1000);
      const order = await tx.order.create({
        data: {
          userId: user.id,
          server: "bot",
          orderId: safeOrderId,
          service: service || "wa",
          serviceName: serviceName || "WhatsApp",
          country: country || "unknown",
          countryId: Number(countryId) || 0,
          number: String(number),
          code: String(otp),
          price: BOT_OTP_PRICE,
          status: "success",
          operator: "any",
          source: "bot",
        },
      });

      return {
        orderId: order.id,
        newBalance: userData.balance - BOT_OTP_PRICE,
      };
    });

    return apiSuccess({
      deducted: BOT_OTP_PRICE,
      balance: result.newBalance,
      orderId: result.orderId,
    });
  } catch (error) {
    console.error("[v1/bot/deduct] Error:", error);
    const msg = error instanceof Error ? error.message : "";

    if (msg === "INSUFFICIENT_BALANCE") {
      return apiError("Saldo tidak cukup", 402, "INSUFFICIENT_BALANCE");
    }
    if (msg === "USER_NOT_FOUND") {
      return apiError("User tidak ditemukan", 404, "USER_NOT_FOUND");
    }

    return apiError("Gagal memproses", 500, "SERVER_ERROR");
  }
}
