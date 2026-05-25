import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Channels: Paymenku QRIS + BAYAR.GG GoPay QRIS + Manual QRIS (admin toggle).
 *
 * Tiap gateway bisa di-toggle independen via SiteSetting:
 *   - paymenku_enabled (default true kalau env ada)
 *   - bayargg_enabled (default true kalau env ada)
 *   - manual_qris_enabled (default false; harus di-enable admin)
 */
export async function GET() {
  const channels = [];

  // Ambil semua toggle sekali
  const settings = await db.siteSetting.findMany({
    where: { key: { in: ["paymenku_enabled", "bayargg_enabled", "manual_qris_enabled"] } },
  });
  const settingMap: Record<string, string> = {};
  for (const s of settings) settingMap[s.key] = s.value;

  // Default: kalau setting tidak ada, gateway aktif (selama env tersedia).
  const paymenkuEnabled = settingMap.paymenku_enabled !== "false";
  const bayargGEnabled = settingMap.bayargg_enabled !== "false";
  const manualQrisEnabled = settingMap.manual_qris_enabled === "true";

  // Paymenku QRIS
  if (paymenkuEnabled && process.env.PAYMENKU_API_KEY) {
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

  // BAYAR.GG QRIS
  if (bayargGEnabled && process.env.BAYARGG_API_KEY) {
    channels.push({
      code: "bayargg_qris",
      name: "QRIS (BAYAR GG)",
      type: "qris",
      type_label: "QRIS",
      icon: null,
      description: "Bayar via QRIS BAYAR GG - Semua e-wallet & mobile banking",
      gateway: "bayargg",
      fee: {
        flat: 0,
        percent: 2.1,
        display: "+ 2.1%",
      },
    });
  }

  // Manual QRIS (admin toggle via SiteSetting)
  if (manualQrisEnabled && process.env.MANUAL_QRIS_STRING) {
    channels.push({
      code: "manual_qris",
      name: "QRIS Manual",
      type: "qris",
      type_label: "QRIS",
      icon: null,
      description: "Bayar via QRIS - Konfirmasi manual oleh admin",
      gateway: "manual_qris",
      fee: {
        flat: 100,
        percent: 0,
        display: "Rp 100",
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
