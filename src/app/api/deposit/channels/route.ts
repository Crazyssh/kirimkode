import { NextResponse } from "next/server";
import { getPaymentChannels } from "@/lib/paymenku";

export async function GET() {
  try {
    const result = await getPaymentChannels();

    // Tambahkan BAYAR.GG GoPay QRIS ke channel list
    const bayarggChannel = {
      code: "bayargg_gopay_qris",
      name: "GoPay QRIS (BAYAR.GG)",
      type: "qris",
      type_label: "QRIS",
      icon: null,
      description: "Bayar via GoPay Merchant QRIS",
      fee: {
        flat: 0,
        percent: 0.5,
        display: "0.5%",
      },
    };

    // Inject ke QRIS group
    const data = result.data;
    if (data.qris) {
      data.qris.push(bayarggChannel);
    } else {
      data.qris = [bayarggChannel];
    }

    return NextResponse.json({
      status: "success",
      data,
    });
  } catch (error) {
    console.error("Get channels error:", error);
    return NextResponse.json(
      { error: "Gagal ambil payment channels" },
      { status: 500 }
    );
  }
}
