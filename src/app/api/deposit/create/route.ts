import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createTransaction,
  generateReferenceId,
} from "@/lib/paymenku";
import {
  createPayment as bayarggCreatePayment,
  generateDescription as bayarggDescription,
  calculateFee as bayarggFee,
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

    const { amount, channel_code } = validated.data;
    const gateway: string = body.gateway || "paymenku";

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
      select: { id: true, name: true, email: true, phone: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ─── BAYAR.GG GATEWAY ───────────────────────────────
    if (gateway === "bayargg") {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const description = bayarggDescription(user.id, amount);
      const { fee } = bayarggFee(amount);

      const result = await bayarggCreatePayment({
        amount,
        description,
        customer_name: user.name || "KirimKode User",
        customer_email: user.email,
        customer_phone: user.phone || undefined,
        callback_url: `${appUrl}/api/webhook/bayargg`,
        redirect_url: `${appUrl}/deposit?status=success`,
      });

      const referenceId = `BGG-${user.id}-${Date.now()}`;

      await db.deposit.create({
        data: {
          userId: user.id,
          trxId: result.data.invoice_id,
          referenceId,
          amount,
          fee,
          channelCode: "gopay_qris",
          channelName: "GoPay QRIS (BAYAR.GG)",
          gateway: "bayargg",
          status: "pending",
          payUrl: result.data.payment_url,
        },
      });

      logAction(user.id, "deposit", JSON.stringify({ trxId: result.data.invoice_id, amount, gateway: "bayargg", channel: "gopay_qris" }));

      if (user.email) {
        sendDepositPendingEmail(user.email, {
          name: user.name || "User",
          amount,
          trxId: result.data.invoice_id,
          channelName: "GoPay QRIS (BAYAR.GG)",
          payUrl: result.data.payment_url,
        }).catch((e) => console.error("[Mail] Email deposit pending error:", e));
      }

      return NextResponse.json({
        status: "success",
        data: {
          trx_id: result.data.invoice_id,
          reference_id: referenceId,
          amount: String(result.data.amount),
          status: result.data.status,
          pay_url: result.data.payment_url,
          payment_info: {
            transaction_id: result.data.invoice_id,
            transaction_status: result.data.status,
            qr_url: result.data.qris_converter?.qr_image_url || null,
            checkout_url: result.data.payment_url,
            expiration_date: result.data.expires_at,
          },
        },
      });
    }

    // ─── PAYMENKU GATEWAY (default) ─────────────────────
    const referenceId = generateReferenceId(user.id);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const result = await createTransaction({
      reference_id: referenceId,
      amount,
      customer_name: user.name || "KirimKode User",
      customer_email: user.email,
      customer_phone: user.phone || "",
      channel_code,
      return_url: `${appUrl}/deposit?status=success`,
    });

    // Save deposit to database
    await db.deposit.create({
      data: {
        userId: user.id,
        trxId: result.data.trx_id,
        referenceId: result.data.reference_id,
        amount,
        channelCode: channel_code,
        channelName: channel_code.toUpperCase(),
        gateway: "paymenku",
        status: "pending",
        payUrl: result.data.pay_url,
      },
    });

    logAction(user.id, "deposit", JSON.stringify({ trxId: result.data.trx_id, amount, channel: channel_code }));

    // Kirim email pending (non-blocking)
    if (user.email) {
      sendDepositPendingEmail(user.email, {
        name: user.name || "User",
        amount,
        trxId: result.data.trx_id,
        channelName: channel_code.toUpperCase(),
        payUrl: result.data.pay_url,
      }).catch((e) => console.error("[Mail] Email deposit pending error:", e));
    }

    return NextResponse.json({
      status: "success",
      data: {
        trx_id: result.data.trx_id,
        reference_id: result.data.reference_id,
        amount: result.data.amount,
        status: result.data.status,
        pay_url: result.data.pay_url,
        payment_info: result.data.payment_info,
      },
    });
  } catch (error) {
    console.error("Deposit create error:", error);
    return NextResponse.json(
      { error: "Gagal membuat deposit" },
      { status: 500 }
    );
  }
}
