/**
 * Health checker untuk Clowatch servers (api5/api8/api9/api10).
 *
 * Strategy:
 *   1. Test order WA Indonesia (countryId=6, service=wa)
 *      → kalau response order valid (ada orderId+number) = HEALTHY
 *      → kalau gagal (out of stock, timeout, error) = lanjut step 2
 *   2. Test order TG Indonesia (countryId=6, service=tg)
 *      → kalau valid = HEALTHY
 *      → kalau gagal = UNHEALTHY (debounce 2× fail sebelum benar-benar di-hide)
 *
 *   Kalau healthy, schedule cancel order via setTimeout setelah 2 menit 5 detik
 *   supaya saldo provider balik (Clowatch cancel rule = 2 menit minimum).
 *
 *   Kalau unhealthy → next check dijadwalkan 30 detik kemudian.
 *   Kalau healthy → next check dijadwalkan 10 menit kemudian.
 *
 * Status disimpan di siteSetting key `clowatch_health_<serverId>` (lihat
 * lib/site-settings.ts → ClowatchHealthState).
 */

import * as provider5 from "@/lib/provider5";
import * as provider8 from "@/lib/provider8";
import * as provider9 from "@/lib/provider9";
import * as provider10 from "@/lib/provider10";
import {
  getClowatchHealth,
  setClowatchHealth,
  isClowatchAutoManaged,
  type ClowatchHealthState,
} from "@/lib/site-settings";

export const CHECK_HEALTHY_INTERVAL_MS = 10 * 60 * 1000; // 10 menit
export const CHECK_UNHEALTHY_INTERVAL_MS = 30 * 1000; // 30 detik
export const FAIL_THRESHOLD = 2; // debounce 2× fail sebelum di-hide
export const CANCEL_DELAY_MS = 2 * 60 * 1000 + 5_000; // 2 menit 5 detik (cancel rule Clowatch = 2 menit min)

const TEST_COUNTRY_ID = 6; // Indonesia
const TEST_SERVICES = ["wa", "tg"] as const;

type ProviderAdapter = {
  createOrder: (negara: number, layanan: string, operator: string) => Promise<{ order_id: number; number: string }>;
  cancelOrder: (orderId: number) => Promise<{ success: boolean }>;
};

const ADAPTERS: Record<string, ProviderAdapter> = {
  api5: provider5,
  api8: provider8,
  api9: provider9,
  api10: provider10,
};

interface CheckResult {
  ok: boolean;
  service?: string;
  orderId?: number;
  error?: string;
}

/**
 * Coba test order. Return ok=true kalau salah satu service (WA atau TG) berhasil.
 * Order yang sukses akan di-schedule cancel-nya 2 menit 5 detik kemudian.
 */
async function testOrder(serverId: string): Promise<CheckResult> {
  const adapter = ADAPTERS[serverId];
  if (!adapter) return { ok: false, error: `Adapter ${serverId} tidak ditemukan` };

  let lastError = "";

  for (const svc of TEST_SERVICES) {
    try {
      const result = await adapter.createOrder(TEST_COUNTRY_ID, svc, "any");
      if (result?.order_id && result?.number) {
        // Order sukses — schedule cancel supaya saldo provider balik
        scheduleCancel(serverId, result.order_id);
        return { ok: true, service: svc, orderId: result.order_id };
      }
      lastError = "Invalid order response";
    } catch (err) {
      lastError = (err as Error)?.message || "Unknown error";
      // Lanjut coba service berikutnya
    }
  }

  return { ok: false, error: lastError };
}

/**
 * Schedule cancel order setelah 2 menit 5 detik supaya saldo provider balik.
 * Kalau process restart sebelum cancel jalan, order akan auto-expire 20 menit
 * di Clowatch (saldo tetap ke-charge sampai expire).
 */
function scheduleCancel(serverId: string, orderId: number) {
  const adapter = ADAPTERS[serverId];
  if (!adapter) return;

  setTimeout(async () => {
    try {
      await adapter.cancelOrder(orderId);
      console.log(`[ClowatchHealth] Cancelled test order ${serverId}/${orderId}`);
    } catch (err) {
      const msg = (err as Error)?.message || "";
      // TOO_EARLY shouldn't happen karena kita tunggu 2m5s, tapi just in case
      if (!/too.?early|404/i.test(msg)) {
        console.warn(`[ClowatchHealth] Cancel test order ${serverId}/${orderId} failed: ${msg}`);
      }
    }
  }, CANCEL_DELAY_MS);
}

/**
 * Jalankan health check untuk satu server.
 * Update state di DB. Honor debounce (2× fail sebelum unhealthy).
 *
 * @returns nextCheckInMs — kapan checker berikutnya harus jalan untuk server ini
 */
export async function runHealthCheck(serverId: string): Promise<{
  state: ClowatchHealthState;
  nextCheckInMs: number;
  changed: boolean; // status berubah?
}> {
  const prev = await getClowatchHealth(serverId);
  const result = await testOrder(serverId);

  const now = Date.now();
  const next: ClowatchHealthState = {
    ...prev,
    lastCheckAt: now,
  };

  let changed = false;

  if (result.ok) {
    // Sukses → reset failCount, mark healthy
    next.failCount = 0;
    next.lastSuccessAt = now;
    next.lastError = undefined;

    if (prev.status !== "healthy") {
      next.status = "healthy";
      changed = true;
    }
  } else {
    next.failCount = prev.failCount + 1;
    next.lastError = result.error?.slice(0, 200);

    if (next.failCount >= FAIL_THRESHOLD && prev.status !== "unhealthy") {
      next.status = "unhealthy";
      changed = true;
    }
  }

  await setClowatchHealth(serverId, next);

  // Schedule next check: 10 menit kalau healthy, 30 detik kalau unhealthy
  const nextCheckInMs =
    next.status === "healthy"
      ? CHECK_HEALTHY_INTERVAL_MS
      : CHECK_UNHEALTHY_INTERVAL_MS;

  if (changed) {
    console.log(
      `[ClowatchHealth] ${serverId} status changed: ${prev.status} → ${next.status} (fail: ${next.failCount}, error: ${next.lastError ?? "-"})`
    );
  }

  return { state: next, nextCheckInMs, changed };
}

/**
 * Cek apakah server perlu di-check sekarang berdasarkan lastCheckAt + interval.
 * Server dengan auto-manage=false akan di-skip.
 */
export async function shouldCheck(serverId: string): Promise<boolean> {
  const auto = await isClowatchAutoManaged(serverId);
  if (!auto) return false;

  const health = await getClowatchHealth(serverId);
  const now = Date.now();
  const interval =
    health.status === "healthy"
      ? CHECK_HEALTHY_INTERVAL_MS
      : CHECK_UNHEALTHY_INTERVAL_MS;

  return now - health.lastCheckAt >= interval;
}
