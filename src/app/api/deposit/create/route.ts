import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createPayment as bayarggCreatePayment,
  generateDescription as bayarggDescription,
} from "@/lib/bayargg";
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

    const body = await req.json();
    const validated = validateBody(depositCreateSchema, body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { amount } = validated.data;

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
        trxId: result.data.invoice_id,
        referenceId,
        amount,
        fee: 0,
        channelCode: "qris",
        channelName: "QRIS",
        gateway: "bayargg",
        status: "pending",
        payUrl: result.data.payment_url,
        expiresAt: result.data.expires_at ? new Date(result.data.expires_at) : null,
      },
    });

    logAction(user.id, "deposit", JSON.stringify({ trxId: result.data.invoice_id, amount, gateway: "bayargg" }));

    if (user.email) {
      sendDepositPendingEmail(user.email, {
        name: user.name || "User",
        amount,
        trxId: result.data.invoice_id,
        channelName: "QRIS",
        payUrl: result.data.payment_url,
      }).catch((e) => console.error("[Mail] Email deposit pending error:", e));
    }

    // QR image dari createPayment response (use_qris_converter: true)
    const qrImageUrl = result.data.qris_converter?.qr_image_url || null;
    if (qrImageUrl) {
      console.log(`[BAYAR.GG] QRIS inline ready: ${qrImageUrl} (Rp ${result.data.final_amount})`);
    }

    return NextResponse.json({
      status: "success",
      data: {
        trx_id: result.data.invoice_id,
        reference_id: referenceId,
        amount: String(result.data.amount),
        final_amount: String(result.data.final_amount || result.data.amount),
        unique_code: String(result.data.unique_code || 0),
        status: result.data.status,
        pay_url: result.data.payment_url,
        payment_info: {
          transaction_id: result.data.invoice_id,
          transaction_status: result.data.status,
          qr_url: qrImageUrl,
          checkout_url: result.data.payment_url,
          expiration_date: result.data.expires_at,
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
