/**
 * Centralized USD → IDR rate fetcher.
 *
 * Dipake oleh provider3 (Saturn), provider4 (Neptune), provider6 (Venus).
 * Sebelumnya tiap provider punya cache & pendingFetch sendiri → 3x request
 * paralel ke open.er-api.com saat cold start. Sekarang share state.
 *
 * Strategi:
 *   1. Fetch dari open.er-api.com (free, tanpa API key)
 *   2. Cache 6 jam
 *   3. Validasi sanity: rate harus 14000–25000 IDR (range realistis 2024-2030)
 *   4. Fallback ke env `USD_IDR_FALLBACK_RATE` atau 17500 kalau API gagal
 *
 * Override via env: USD_IDR_FALLBACK_RATE=17500
 */

const FALLBACK_USD_RATE =
  Number(process.env.USD_IDR_FALLBACK_RATE) ||
  Number(process.env.PROVIDER3_USD_RATE) ||
  Number(process.env.PROVIDER4_USD_RATE) ||
  Number(process.env.PROVIDER6_USD_RATE) ||
  17500;

const CACHE_TTL = 60 * 60 * 1000; // 1 jam — refresh tiap jam

// Sanity check — reject rate yang absurd (API rusak / response weird)
const MIN_VALID_RATE = 14000;
const MAX_VALID_RATE = 25000;

let cachedRate: number | null = null;
let cacheTime = 0;
let pendingFetch: Promise<number> | null = null;

/**
 * Get USD → IDR rate. Returns cached value kalau masih fresh.
 * Multiple concurrent calls reuse the same in-flight fetch.
 */
export async function getUsdToIdr(): Promise<number> {
  const now = Date.now();
  if (cachedRate && now - cacheTime < CACHE_TTL) {
    return cachedRate;
  }

  if (pendingFetch) return pendingFetch;

  pendingFetch = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch("https://open.er-api.com/v6/latest/USD", {
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      const rate = data?.rates?.IDR;

      if (
        typeof rate === "number" &&
        rate >= MIN_VALID_RATE &&
        rate <= MAX_VALID_RATE
      ) {
        cachedRate = rate;
        cacheTime = now;
        console.log(`[USD/IDR] Rate updated: ${rate}`);
        return rate;
      }

      console.warn(
        `[USD/IDR] Suspicious rate from API: ${rate}, falling back to ${cachedRate || FALLBACK_USD_RATE}`
      );
    } catch (err) {
      console.warn(
        "[USD/IDR] Failed to fetch rate, using fallback:",
        (err as Error).message
      );
    } finally {
      pendingFetch = null;
    }

    // Fallback: pakai cache lama atau env
    return cachedRate || FALLBACK_USD_RATE;
  })();

  return pendingFetch;
}

/**
 * Convert USD price to IDR with custom markup multiplier.
 * Returns ceil-ed integer (IDR — no decimals).
 *
 * Example: convertUsdToIdr(0.30, 1.20) → 0.30 × 17500 × 1.20 = 6300
 */
export async function convertUsdToIdr(
  usdPrice: number,
  markup: number = 1.0
): Promise<number> {
  const rate = await getUsdToIdr();
  return Math.ceil(usdPrice * rate * markup);
}

/**
 * Force refresh the cached rate. Pakai di admin panel kalau mau manual refresh.
 */
export function clearUsdRateCache() {
  cachedRate = null;
  cacheTime = 0;
}
