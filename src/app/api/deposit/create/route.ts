import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createTransaction,
  generateReferenceId,
} from "@/lib/paymenku";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { depositCreateSchema, validateBody } from "@/lib/validations";
import { logAction } from "@/lib/audit";

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
        status: "pending",
        payUrl: result.data.pay_url,
      },
    });

    logAction(user.id, "deposit", JSON.stringify({ trxId: result.data.trx_id, amount, channel: channel_code }));

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
