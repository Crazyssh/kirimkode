import { NextResponse } from "next/server";

/**
 * Channels: hanya BAYAR.GG GoPay Merchant QRIS
 */
export async function GET() {
  const bayarggChannel = {
    code: "bayargg_gopay_qris",
    name: "GoPay QRIS",
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

  return NextResponse.json({
    status: "success",
    data: {
      qris: [bayarggChannel],
      ewallet: [],
      va: [],
    },
  });
}
