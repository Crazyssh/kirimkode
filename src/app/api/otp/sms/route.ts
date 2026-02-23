import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkSms } from "@/lib/otp";

const WAITING_STATUSES = ["menunggu", "waiting", "pending", "processing"];

function isRealOtp(otp: unknown): otp is string {
  if (typeof otp !== "string" || !otp.trim()) return false;
  return !WAITING_STATUSES.includes(otp.trim().toLowerCase());
}

function extractOtp(data: Record<string, unknown>): string | null {
  // Try multiple possible response formats from JasaOTP:
  // { otp: "123456" }
  // { data: { otp: "123456" } }
  // { sms: "123456" }
  // { data: { sms: "123456" } }
  // { data: { full_sms: "Your code is 123456" } }
  const candidates = [
    data?.otp,
    data?.sms,
    data?.code,
    (data?.data as Record<string, unknown>)?.otp,
    (data?.data as Record<string, unknown>)?.sms,
    (data?.data as Record<string, unknown>)?.code,
    (data?.data as Record<string, unknown>)?.full_sms,
  ];

  for (const val of candidates) {
    if (isRealOtp(val)) return val;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const server = req.nextUrl.searchParams.get("server") as "api1" | "api2";
  const id = req.nextUrl.searchParams.get("id");

  if (!server || !["api1", "api2"].includes(server)) {
    return NextResponse.json({ error: "Server parameter required (api1 or api2)" }, { status: 400 });
  }

  if (!id) {
    return NextResponse.json({ error: "Parameter id diperlukan" }, { status: 400 });
  }

  try {
    const data = await checkSms(server, Number(id));

    // Log raw response for debugging
    console.log(`[SMS Check] server=${server} id=${id} raw:`, JSON.stringify(data));

    const otp = extractOtp(data as Record<string, unknown>);

    // If OTP received, update order in DB (always update to latest OTP)
    if (otp) {
      await db.order.updateMany({
        where: {
          orderId: Number(id),
          server,
          userId: session.user.id,
        },
        data: {
          code: otp,
          status: "success",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: { otp },
    });
  } catch (err) {
    console.error("[SMS Check Error]", err);
    return NextResponse.json({ error: "Gagal mengambil OTP" }, { status: 500 });
  }
}
