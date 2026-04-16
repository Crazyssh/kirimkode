import { NextResponse } from "next/server";

/**
 * Channels: BAYAR.GG GoPay Merchant QRIS + Paymenku QRIS
 */
export async function GET() {
  const channels = [];

  // BAYAR.GG GoPay QRIS
  channels.push({
    code: "bayargg_gopay_qris",
    name: "GoPay QRIS",
    type: "qris",
    type_label: "QRIS",
    icon: null,
    description: "Bayar via GoPay Merchant QRIS",
    gateway: "bayargg",
    fee: {
      flat: 0,
      percent: 0,
      display: "Gratis",
    },
  });

  // Paymenku QRIS (jika API key tersedia)
  if (process.env.PAYMENKU_API_KEY) {
    channels.push({
      code: "QRIS",
      name: "QRIS (Paymenku)",
      type: "qris",
      type_label: "QRIS",
      icon: null,
      description: "Bayar via QRIS - Semua e-wallet & mobile banking",
      gateway: "paymenku",
      fee: {
        flat: 0,
        percent: 0.7,
        display: "0.7%",
      },
    });
  }

  return NextResponse.json({
    status: "success",
    data: {
      qris: channels,
      ewallet: [],
      va: [],
    },
  });
}
