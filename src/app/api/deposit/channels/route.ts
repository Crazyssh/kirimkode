import { NextResponse } from "next/server";
import { getPaymentChannels } from "@/lib/paymenku";

export async function GET() {
  try {
    const result = await getPaymentChannels();

    return NextResponse.json({
      status: "success",
      data: result.data,
    });
  } catch (error) {
    console.error("Get channels error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal ambil payment channels" },
      { status: 500 }
    );
  }
}
