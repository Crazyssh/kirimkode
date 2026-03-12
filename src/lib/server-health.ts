/**
 * Server Health Check Module
 * Otomatis cek kesehatan server api1 & api2 dengan mencoba order nomor Indonesia.
 * Status disimpan in-memory dan diakses oleh frontend via API.
 */

import { getLayanan, createOrder, cancelOrder, type ServerId } from "@/lib/otp";

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

// Jumlah order percobaan
const ORDER_ATTEMPTS = 3;

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
 * 1. Fetch layanan Indonesia
 * 2. Pick 3 random services
 * 3. Try to order each one
 * 4. If any succeeds → cancel immediately → server UP
 * 5. If all fail → server DOWN
 */
export async function runHealthCheck(server: "api1" | "api2"): Promise<ServerStatus> {
  const entry = healthStatus[server];
  const now = Date.now();

  try {
    // Step 1: Fetch available services in Indonesia
    const data = await getLayanan(server as ServerId, HEALTH_CHECK_COUNTRY);
    const negaraKey = String(HEALTH_CHECK_COUNTRY);

    const serviceData = data?.[negaraKey] ?? data?.data?.[negaraKey];

    if (!serviceData || typeof serviceData !== "object") {
      console.log(`[Health] ${server}: No service data for country ${HEALTH_CHECK_COUNTRY}`);
      entry.status = "offline";
      entry.lastCheck = now;
      entry.failCount++;
      return "offline";
    }

    // Step 2: Get service codes with stock > 0
    const availableServices = Object.entries(serviceData)
      .filter(([, info]) => {
        const svc = info as { stok?: number };
        return typeof svc.stok === "number" && svc.stok > 0;
      })
      .map(([code]) => code);

    if (availableServices.length === 0) {
      console.log(`[Health] ${server}: No services with stock in Indonesia`);
      entry.status = "offline";
      entry.lastCheck = now;
      entry.failCount++;
      return "offline";
    }

    // Step 3: Pick up to 3 random services
    const shuffled = availableServices.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, ORDER_ATTEMPTS);

    // Step 4: Try ordering each one
    let anySuccess = false;

    for (const serviceCode of selected) {
      try {
        const orderResult = await createOrder(server as ServerId, HEALTH_CHECK_COUNTRY, serviceCode, "any");
        const orderId = orderResult?.order_id ?? orderResult?.data?.order_id;

        if (orderId) {
          // Order berhasil! Cancel langsung untuk refund
          anySuccess = true;
          console.log(`[Health] ${server}: Order success (${serviceCode}), cancelling...`);

          try {
            await cancelOrder(server as ServerId, orderId);
            console.log(`[Health] ${server}: Cancelled order ${orderId}`);
          } catch (cancelErr) {
            console.warn(`[Health] ${server}: Failed to cancel order ${orderId}:`, (cancelErr as Error).message);
          }

          break; // Tidak perlu coba lagi
        }
      } catch {
        // Order gagal, lanjut ke service berikutnya
        continue;
      }
    }

    // Step 5: Update status
    if (anySuccess) {
      entry.status = "online";
      entry.lastSuccess = now;
      entry.failCount = 0;
    } else {
      entry.failCount++;
      // Perlu 2x gagal berturut-turut sebelum jadi offline (menghindari false alarm)
      if (entry.failCount >= 2) {
        entry.status = "offline";
      }
    }

    entry.lastCheck = now;
    console.log(`[Health] ${server}: ${entry.status} (fail count: ${entry.failCount})`);
    return entry.status;

  } catch (err) {
    console.error(`[Health] ${server}: Error during health check:`, (err as Error).message);
    entry.failCount++;
    if (entry.failCount >= 2) {
      entry.status = "offline";
    }
    entry.lastCheck = now;
    return entry.status;
  }
}
