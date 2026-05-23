import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createPayment as bayarggCreatePayment,
  generateDescription as bayarggDescription,
  convertQris,
  convertCustomQris,
} from "@/lib/bayargg";
import {
  createTransaction as paymenkuCreateTransaction,
  generateReferenceId as paymenkuRefId,
} from "@/lib/paymenku";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { depositCreateSchema, validateBody } from "@/lib/validations";
import { logAction } from "@/lib/audit";
import { sendDepositPendingEmail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: max 10 deposit per IP per menit
    const rateLimited = checkRouteRateLimit(req, "deposit-create", 10, 60000);
    if (rateLimited) return rateLimited;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Cek apakah deposit sedang dinonaktifkan oleh admin
    const depositSetting = await db.siteSetting.findUnique({
      where: { key: "deposit_enabled" },
    });
    if (depositSetting?.value === "false") {
      return NextResponse.json(
        { error: "Deposit sedang dinonaktifkan oleh admin. Silakan coba lagi nanti." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = validateBody(depositCreateSchema, body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { amount, channel_code } = validated.data;
    const gateway = channel_code === "QRIS" ? "paymenku" : channel_code === "manual_qris" ? "manual_qris" : "bayargg";

    // Anti double charge: cek apakah ada deposit pending yang masih aktif
    const pendingCount = await db.deposit.count({
      where: { userId: session.user.id, status: "pending" },
    });

    if (pendingCount >= 3) {
      return NextResponse.json(
        { error: "Anda sudah memiliki 3 deposit pending. Selesaikan atau batalkan terlebih dahulu." },
        { status: 429 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, phone: true, status: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.status === "banned") {
      return NextResponse.json({ error: "Akun Anda telah diblokir. Hubungi admin." }, { status: 403 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (gateway === "paymenku") {
      // === PAYMENKU QRIS ===
      const referenceId = paymenkuRefId(user.id);

      const result = await paymenkuCreateTransaction(
        {
          reference_id: referenceId,
          amount,
          customer_name: user.name || "KirimKode User",
          customer_email: user.email,
          customer_phone: user.phone || undefined,
          channel_code: "qris", // lowercase per Paymenku docs
          return_url: `${appUrl}/deposit?status=success`,
        },
        { idempotencyKey: referenceId }
      );

      // Safe parse expiration_date — Paymenku kadang return format yang
      // tidak bisa di-parse Date constructor → simpan null daripada throw.
      const expRaw = result.data.payment_info?.expiration_date;
      let expiresAt: Date | null = null;
      if (expRaw) {
        const parsed = new Date(expRaw);
        if (!isNaN(parsed.getTime())) {
          expiresAt = parsed;
        } else {
          console.warn(
            `[Paymenku] Invalid expiration_date format: "${expRaw}" — fallback ke null`
          );
        }
      }

      await db.deposit.create({
        data: {
          userId: user.id,
          trxId: result.data.trx_id,
          referenceId,
          amount,
          fee: 0,
          channelCode: "QRIS",
          channelName: "QRIS (Paymenku)",
          gateway: "paymenku",
          status: "pending",
          payUrl: result.data.pay_url,
          expiresAt,
        },
      });

      logAction(user.id, "deposit", JSON.stringify({ trxId: result.data.trx_id, amount, gateway: "paymenku" }));

      if (user.email) {
        sendDepositPendingEmail(user.email, {
          name: user.name || "User",
          amount,
          trxId: result.data.trx_id,
          channelName: "QRIS (Paymenku)",
          payUrl: result.data.pay_url,
        }).catch((e) => console.error("[Mail] Email deposit pending error:", e));
      }

      return NextResponse.json({
        status: "success",
        data: {
          trx_id: result.data.trx_id,
          reference_id: referenceId,
          amount: result.data.amount,
          final_amount: result.data.amount,
          unique_code: "0",
          status: result.data.status,
          pay_url: result.data.pay_url,
          payment_info: result.data.payment_info,
        },
      });
    }

    if (gateway === "manual_qris") {
      // === MANUAL QRIS (admin confirm) ===
      const manualQrisSetting = await db.siteSetting.findUnique({
        where: { key: "manual_qris_enabled" },
      });
      if (manualQrisSetting?.value !== "true") {
        return NextResponse.json(
          { error: "QRIS Manual sedang dinonaktifkan." },
          { status: 403 }
        );
      }

      const qrisString = process.env.MANUAL_QRIS_STRING;
      if (!qrisString) {
        return NextResponse.json(
          { error: "QRIS Manual belum dikonfigurasi." },
          { status: 500 }
        );
      }

      const fee = 100;
      const finalAmount = amount + fee;
      const referenceId = `MQ-${user.id}-${Date.now()}`;
      const trxId = `MQ${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      // Convert QRIS string to QR image with embedded amount
      let qrImageUrl: string | null = null;
      try {
        const qrisResult = await convertCustomQris(qrisString, finalAmount);
        qrImageUrl = qrisResult.data.qr_image_url;
        console.log(`[MANUAL_QRIS] QRIS ready: ${qrImageUrl} (Rp ${finalAmount})`);
      } catch (e) {
        console.error("[MANUAL_QRIS] QRIS convert gagal:", e);
        return NextResponse.json(
          { error: "Gagal generate QRIS. Silakan coba lagi." },
          { status: 500 }
        );
      }

      // Get admin telegram username
      const telegramSetting = await db.siteSetting.findUnique({
        where: { key: "admin_telegram_username" },
      });
      const adminTelegram = telegramSetting?.value || "";

      await db.deposit.create({
        data: {
          userId: user.id,
          trxId,
          referenceId,
          amount,
          fee,
          channelCode: "manual_qris",
          channelName: "QRIS Manual",
          gateway: "manual_qris",
          status: "pending",
          payUrl: null,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 menit
        },
      });

      logAction(user.id, "deposit", JSON.stringify({ trxId, amount, fee, gateway: "manual_qris" }));

      return NextResponse.json({
        status: "success",
        data: {
          trx_id: trxId,
          reference_id: referenceId,
          amount: String(amount),
          final_amount: String(finalAmount),
          unique_code: "0",
          fee: String(fee),
          status: "pending",
          pay_url: null,
          gateway: "manual_qris",
          admin_telegram: adminTelegram,
          payment_info: {
            transaction_id: trxId,
            transaction_status: "pending",
            qr_url: qrImageUrl,
            checkout_url: null,
            expiration_date: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
        },
      });
    }

    // === BAYAR.GG (default) ===
    const description = bayarggDescription(user.id, amount);

    const result = await bayarggCreatePayment({
      amount,
      description,
      customer_name: user.name || "KirimKode User",
      customer_email: user.email,
      customer_phone: user.phone || undefined,
      callback_url: `${appUrl}/api/webhook/bayargg`,
      redirect_url: `${appUrl}/deposit?status=success`,
      use_qris_converter: true,
    });

    const referenceId = `BGG-${user.id}-${Date.now()}`;

    await db.deposit.create({
      data: {
        userId: user.id,
        trxId: result.payment.invoice_id,
        referenceId,
        amount,
        fee: 0,
        channelCode: "qris",
        channelName: "QRIS",
        gateway: "bayargg",
        status: "pending",
        payUrl: result.payment_url,
        expiresAt: result.payment.expires_at ? new Date(result.payment.expires_at) : null,
      },
    });

    logAction(user.id, "deposit", JSON.stringify({ trxId: result.payment.invoice_id, amount, gateway: "bayargg" }));

    if (user.email) {
      sendDepositPendingEmail(user.email, {
        name: user.name || "User",
        amount,
        trxId: result.payment.invoice_id,
        channelName: "QRIS",
        payUrl: result.payment_url,
      }).catch((e) => console.error("[Mail] Email deposit pending error:", e));
    }

    // Generate QR inline pakai convertQris + BAYARGG_QRIS_STRING
    let qrImageUrl: string | null = null;
    try {
      const finalAmount = result.payment.final_amount || result.payment.amount;
      const qrisResult = await convertQris(finalAmount);
      qrImageUrl = qrisResult.data.qr_image_url;
      console.log(`[BAYAR.GG] QRIS inline ready: ${qrImageUrl} (Rp ${finalAmount})`);
    } catch (e) {
      console.error("[BAYAR.GG] QRIS convert gagal, fallback ke payment URL:", e);
    }

    return NextResponse.json({
      status: "success",
      data: {
        trx_id: result.payment.invoice_id,
        reference_id: referenceId,
        amount: String(result.payment.amount),
        final_amount: String(result.payment.final_amount || result.payment.amount),
        unique_code: String(result.payment.unique_code || 0),
        status: result.payment.status,
        pay_url: result.payment_url,
        payment_info: {
          transaction_id: result.payment.invoice_id,
          transaction_status: result.payment.status,
          qr_url: qrImageUrl,
          checkout_url: result.payment_url,
          expiration_date: result.payment.expires_at,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat deposit";
    console.error("Deposit create error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
