import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkSms } from "@/lib/otp";
import { extractOtp } from "@/lib/otp-extract";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const server = req.nextUrl.searchParams.get("server") as "api1" | "api2" | "api3" | "api4" | "api5" | "api6" | "api7" | "api8";
  const id = req.nextUrl.searchParams.get("id");

  if (!server || !["api1", "api2", "api3", "api4", "api5", "api6", "api7", "api8"].includes(server)) {
    return NextResponse.json({ error: "Server parameter required" }, { status: 400 });
  }

  if (!id) {
    return NextResponse.json({ error: "Parameter id diperlukan" }, { status: 400 });
  }

  try {
    const data = await checkSms(server, Number(id));

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
    if (process.env.NODE_ENV === "development") {
      console.error("[SMS Check Error]", err);
    }
    return NextResponse.json({ error: "Gagal mengambil OTP" }, { status: 500 });
  }
}
