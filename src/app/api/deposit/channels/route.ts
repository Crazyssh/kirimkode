import { NextResponse } from "next/server";

/**
 * Channels: Paymenku QRIS + BAYAR.GG GoPay Merchant QRIS
 */
export async function GET() {
  const channels = [];

  // Paymenku QRIS (pertama, jika API key tersedia)
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
        flat: 200,
        percent: 0.7,
        display: "Rp 200 + 0.7%",
      },
    });
  }

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
      percent: 2.2,
      display: "Kode unik + 2.2%",
    },
  });

  return NextResponse.json({
    status: "success",
    data: {
      qris: channels,
      ewallet: [],
      va: [],
    },
  });
}
