/**
 * Server Health Check Module
 * Cek kesehatan server api1 & api2 secara bertahap:
 *   1. Balance check (cepat, gratis) → kalau berhasil = online
 *   2. Layanan check → kalau data layanan tersedia = online
 *   3. Order test (hanya kalau step 1-2 gagal) → mahal, sebagai fallback
 *
 * Status disimpan in-memory dan diakses oleh frontend via API.
 */

import { getBalance, getLayanan, createOrder, cancelOrder, type ServerId } from "@/lib/otp";

// --- Status storage ---

type ServerStatus = "online" | "offline";

const healthStatus: Record<string, {
  status: ServerStatus;
  lastCheck: number;
  lastSuccess: number;
  failCount: number;
}> = {
  api1: { status: "online", lastCheck: 0, lastSuccess: Date.now(), failCount: 0 },
  api2: { status: "online", lastCheck: 0, lastSuccess: Date.now(), failCount: 0 },
};

// Indonesia country ID (untuk JasaOTP)
const HEALTH_CHECK_COUNTRY = 6;

// Perlu 3x gagal berturut-turut sebelum offline (menghindari false alarm)
const FAIL_THRESHOLD = 3;

/**
 * Get current health status for all servers
 */
export function getHealthStatus() {
  return {
    api1: healthStatus.api1.status,
    api2: healthStatus.api2.status,
    lastCheck: {
      api1: healthStatus.api1.lastCheck,
      api2: healthStatus.api2.lastCheck,
    },
  };
}

/**
 * Run health check for a specific server
 *
 * Strategy (bertahap, hemat biaya):
 * 1. Balance check → gratis, cek konektivitas ke API
 * 2. Layanan check → gratis, cek apakah data tersedia
 * 3. Order test → mahal, hanya kalau step 1-2 gagal berturut-turut
 *
 * Kalau balance ATAU layanan berhasil → server ONLINE.
 * Kalau semua gagal 3x berturut → server OFFLINE.
 */
export async function runHealthCheck(server: "api1" | "api2"): Promise<ServerStatus> {
  const entry = healthStatus[server];
  const now = Date.now();

  try {
    // === Step 1: Balance check (cepat & gratis) ===
    try {
      const balanceData = await getBalance(server as ServerId);
      const saldo = balanceData?.data?.saldo ?? balanceData?.saldo;

      if (typeof saldo === "number" && saldo >= 0) {
        // Balance check berhasil → server pasti online
        entry.status = "online";
        entry.lastCheck = now;
        entry.lastSuccess = now;
        entry.failCount = 0;
        console.log(`[Health] ${server}: ONLINE (balance check OK, saldo: ${saldo})`);
        return "online";
      }
    } catch (balErr) {
      console.warn(`[Health] ${server}: Balance check failed:`, (balErr as Error).message);
    }

    // === Step 2: Layanan check (gratis) ===
    try {
      const data = await getLayanan(server as ServerId, HEALTH_CHECK_COUNTRY);
      const negaraKey = String(HEALTH_CHECK_COUNTRY);
      const serviceData = data?.[negaraKey] ?? data?.data?.[negaraKey];

      if (serviceData && typeof serviceData === "object" && Object.keys(serviceData).length > 0) {
        // Ada data layanan → server online
        entry.status = "online";
        entry.lastCheck = now;
        entry.lastSuccess = now;
        entry.failCount = 0;
        console.log(`[Health] ${server}: ONLINE (layanan data available, ${Object.keys(serviceData).length} services)`);
        return "online";
      }
    } catch (layErr) {
      console.warn(`[Health] ${server}: Layanan check failed:`, (layErr as Error).message);
    }

    // === Step 3: Kedua check gagal, increment fail count ===
    entry.failCount++;
    entry.lastCheck = now;

    if (entry.failCount >= FAIL_THRESHOLD) {
      entry.status = "offline";
      console.log(`[Health] ${server}: OFFLINE (${entry.failCount} consecutive failures)`);
    } else {
      // Belum sampai threshold, tetap online tapi warning
      console.log(`[Health] ${server}: Still online but failing (${entry.failCount}/${FAIL_THRESHOLD})`);
    }

    return entry.status;

  } catch (err) {
    console.error(`[Health] ${server}: Error during health check:`, (err as Error).message);
    entry.failCount++;
    if (entry.failCount >= FAIL_THRESHOLD) {
      entry.status = "offline";
    }
    entry.lastCheck = now;
    return entry.status;
  }
}
