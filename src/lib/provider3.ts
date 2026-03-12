/**
 * Provider 3 Adapter
 * Translates SMS-Activate format API to internal KirimKode format.
 * All responses match the format returned by provider 1 & 2 (JasaOTP).
 */

const BASE_URL =
  process.env.PROVIDER3_API_URL || "https://hero-sms.com/stubs/handler_api.php";
const API_KEY = process.env.PROVIDER3_API_KEY || "";

// Markup 35% di atas harga provider
const PRICE_MARKUP = 1.35;

// Fallback rate jika API kurs gagal (dari env atau hardcode)
const FALLBACK_USD_RATE = Number(process.env.PROVIDER3_USD_RATE) || 16500;

// --- USD → IDR auto-conversion ---

let cachedUsdRate: number | null = null;
let usdRateCacheTime = 0;
const USD_RATE_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 jam
let pendingRateFetch: Promise<number> | null = null;

async function getUsdToIdr(): Promise<number> {
  const now = Date.now();
  if (cachedUsdRate && now - usdRateCacheTime < USD_RATE_CACHE_TTL) {
    return cachedUsdRate;
  }

  // Reuse in-flight fetch
  if (pendingRateFetch) return pendingRateFetch;

  pendingRateFetch = (async () => {
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

      if (typeof rate === "number" && rate > 0) {
        cachedUsdRate = rate;
        usdRateCacheTime = now;
        console.log(`[Provider3] USD/IDR rate updated: ${rate}`);
        return rate;
      }
    } catch (err) {
      console.warn("[Provider3] Failed to fetch USD rate, using fallback:", (err as Error).message);
    } finally {
      pendingRateFetch = null;
    }

    // Fallback: pakai cached rate atau default
    return cachedUsdRate || FALLBACK_USD_RATE;
  })();

  return pendingRateFetch;
}

/**
 * Convert USD price to IDR with markup
 */
async function convertToIdr(usdPrice: number): Promise<number> {
  const rate = await getUsdToIdr();
  return Math.ceil(usdPrice * rate * PRICE_MARKUP);
}

// Simple in-memory cache (same pattern as otp.ts)
const cache = new Map<string, { data: unknown; expiry: number }>();

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  if (entry) cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

// --- Fetch helper ---

async function fetchProvider(
  params: Record<string, string>,
  options?: { skipCache?: boolean }
): Promise<string> {
  const url = new URL(BASE_URL);
  params.api_key = API_KEY;
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const urlStr = url.toString();

  // Check cache (only read actions)
  if (!options?.skipCache) {
    const cached = getCached(urlStr);
    if (cached) return cached as string;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(urlStr, {
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await res.text();

    // Check for common error responses
    if (
      text.startsWith("BAD_KEY") ||
      text.startsWith("ERROR_SQL") ||
      text.startsWith("NO_KEY") ||
      text.startsWith("BAD_ACTION")
    ) {
      throw new Error(text);
    }

    if (!options?.skipCache) {
      const ttl = params.action?.includes("Countries") ? 1800000 : 180000;
      setCache(urlStr, text, ttl);
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchProviderJson(
  params: Record<string, string>,
  options?: { skipCache?: boolean }
): Promise<unknown> {
  const text = await fetchProvider(params, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
  }
}

// --- Service names from API ---

let serviceNamesCache: Record<string, string> | null = null;
let serviceNamesCacheTime = 0;
const SERVICE_NAMES_TTL = 3600000; // 1 hour

async function getServiceNames(): Promise<Record<string, string>> {
  const now = Date.now();
  if (serviceNamesCache && now - serviceNamesCacheTime < SERVICE_NAMES_TTL) {
    return serviceNamesCache;
  }

  const names: Record<string, string> = {};

  try {
    const data = await fetchProviderJson({ action: "getServicesList" });

    if (data && typeof data === "object") {
      // Format: { "status": "success", "services": [{ "code": "wa", "name": "Whatsapp" }, ...] }
      const services = (data as { services?: Array<{ code: string; name: string }> }).services;

      if (Array.isArray(services)) {
        for (const svc of services) {
          if (svc.code && svc.name) {
            names[svc.code] = svc.name;
          }
        }
      } else {
        // Fallback: map format { "code": "name" } or { "code": { "name": "..." } }
        for (const [code, info] of Object.entries(data as Record<string, unknown>)) {
          if (typeof info === "string") {
            names[code] = info;
          } else if (info && typeof info === "object" && "name" in info) {
            names[code] = (info as { name: string }).name;
          }
        }
      }
    }
  } catch {
    // Return whatever we have cached
    if (serviceNamesCache) return serviceNamesCache;
  }

  serviceNamesCache = names;
  serviceNamesCacheTime = now;
  return names;
}

// --- Public API (matches otp.ts format) ---

/**
 * Get balance
 * Provider response: ACCESS_BALANCE:150.50
 * Returns: { balance: number }
 */
export async function getBalance() {
  const text = await fetchProvider(
    { action: "getBalance" },
    { skipCache: true }
  );

  if (text.startsWith("ACCESS_BALANCE:")) {
    const amount = parseFloat(text.split(":")[1]);
    return { balance: amount };
  }

  throw new Error(text);
}

/**
 * Get countries
 * Provider response: { "0": { "id": 0, "eng": "Russia", ... }, ... }
 * Returns: { success: true, data: [{ id_negara, nama_negara }] }
 */
export async function getNegara() {
  const data = await fetchProviderJson({ action: "getCountries" });

  const countries: Array<{ id_negara: number; nama_negara: string }> = [];

  if (data && typeof data === "object") {
    for (const [, info] of Object.entries(data as Record<string, unknown>)) {
      if (info && typeof info === "object") {
        const country = info as { id?: number; eng?: string; rus?: string };
        if (typeof country.id === "number" && country.eng) {
          countries.push({
            id_negara: country.id,
            nama_negara: country.eng.toLowerCase(),
          });
        }
      }
    }
  }

  countries.sort((a, b) => a.nama_negara.localeCompare(b.nama_negara));

  return { success: true, data: countries };
}

/**
 * Get services for a country
 * Provider response: { "country_id": { "service_code": { "cost": X, "count": Y } } }
 * Returns: { "<negara>": { "code": { harga, stok, layanan } } }
 */
export async function getLayanan(negara: number) {
  const [pricesData, serviceNames] = await Promise.all([
    fetchProviderJson({ action: "getPrices", country: String(negara) }),
    getServiceNames(),
  ]);

  const negaraKey = String(negara);
  const result: Record<
    string,
    Record<string, { harga: number; stok: number; layanan: string }>
  > = {};
  result[negaraKey] = {};

  if (pricesData && typeof pricesData === "object") {
    // Format: { "country_id": { "service_code": { "cost": X, "count": Y } } }
    const countryData =
      (pricesData as Record<string, unknown>)[negaraKey] ||
      pricesData;

    if (countryData && typeof countryData === "object") {
      for (const [code, info] of Object.entries(
        countryData as Record<string, unknown>
      )) {
        if (info && typeof info === "object") {
          const service = info as { cost?: number; count?: number };
          if (typeof service.cost === "number") {
            // Convert USD → IDR + apply 35% markup
            const priceIdr = await convertToIdr(service.cost);

            result[negaraKey][code] = {
              harga: priceIdr,
              stok: service.count || 0,
              layanan: serviceNames[code] || code,
            };
          }
        }
      }
    }
  }

  return result;
}

/**
 * Get operators for a country
 * Returns default operator list (provider format may not support this)
 */
export async function getOperator(negara: number) {
  const negaraKey = String(negara);
  // This provider typically doesn't have operator selection
  // Return "any" as default
  return { data: { [negaraKey]: ["any"] } };
}

/**
 * Create order
 * Provider response: ACCESS_NUMBER:<activation_id>:<phone_number>
 * Returns: { order_id, number }
 */
export async function createOrder(
  negara: number,
  layanan: string,
  operator: string
) {
  const params: Record<string, string> = {
    action: "getNumber",
    service: layanan,
    country: String(negara),
  };

  if (operator && operator !== "any") {
    params.operator = operator;
  }

  const text = await fetchProvider(params, { skipCache: true });

  if (text.startsWith("ACCESS_NUMBER:")) {
    const parts = text.split(":");
    const orderId = parseInt(parts[1], 10);
    let number = parts[2];

    if (!orderId || !number) {
      throw new Error("Invalid order response format");
    }

    // Tambah prefix + jika belum ada
    if (!number.startsWith("+")) {
      number = "+" + number;
    }

    return { order_id: orderId, number };
  }

  // Handle specific error cases
  if (text === "NO_NUMBERS") {
    throw new Error("Stok habis untuk layanan ini");
  }
  if (text === "NO_BALANCE") {
    throw new Error("Saldo provider tidak cukup");
  }
  if (text === "WRONG_SERVICE") {
    throw new Error("Layanan tidak tersedia");
  }
  if (text === "WRONG_COUNTRY") {
    throw new Error("Negara tidak tersedia");
  }

  throw new Error(text || "Gagal membuat pesanan");
}

/**
 * Check SMS / OTP
 * Provider response: STATUS_WAIT_CODE | STATUS_OK:<code> | STATUS_CANCEL
 * Returns format compatible with otp-extract.ts
 */
export async function checkSms(orderId: number) {
  const text = await fetchProvider(
    { action: "getStatus", id: String(orderId) },
    { skipCache: true }
  );

  if (text.startsWith("STATUS_OK:")) {
    const code = text.substring("STATUS_OK:".length);
    return { otp: code, status: "success" };
  }

  if (text === "STATUS_WAIT_CODE" || text === "STATUS_WAIT_RETRY") {
    return { otp: null, status: "waiting" };
  }

  if (text === "STATUS_CANCEL") {
    return { otp: null, status: "cancelled" };
  }

  // Unknown status, return as-is
  return { otp: null, status: text };
}

/**
 * Cancel order
 * Calls setStatus with status=8 (cancel)
 * Provider response: ACCESS_CANCEL
 */
export async function cancelOrder(orderId: number) {
  const text = await fetchProvider(
    { action: "setStatus", id: String(orderId), status: "8" },
    { skipCache: true }
  );

  if (text === "ACCESS_CANCEL" || text === "ACCESS_READY") {
    return { success: true };
  }

  throw new Error(text || "Gagal membatalkan pesanan");
}
