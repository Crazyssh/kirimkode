/**
 * Provider 4 Adapter — HeroSMS via getNumberV2 endpoint.
 * Sama seperti provider3, kecuali:
 *   - createOrder pakai action=getNumberV2 (response JSON, bukan text)
 *   - PRICE_MARKUP 1.15 (target ~12% untung bersih setelah fee topup HeroSMS 2.5% + $0.2)
 *   - API key terpisah (PROVIDER4_API_KEY)
 * Endpoint lain (balance/countries/prices/status/cancel) tetap V1 — HeroSMS belum
 * menyediakan V2 untuk itu.
 */

const BASE_URL =
  process.env.PROVIDER4_API_URL ||
  process.env.PROVIDER3_API_URL ||
  "https://hero-sms.com/stubs/handler_api.php";
const API_KEY = process.env.PROVIDER4_API_KEY || "";

// Markup 15% di atas harga provider → ~12% untung bersih setelah fee topup HeroSMS (2.5% + $0.2).
export const PRICE_MARKUP = 1.15;

const FALLBACK_USD_RATE = Number(process.env.PROVIDER4_USD_RATE) || Number(process.env.PROVIDER3_USD_RATE) || 16500;

// --- USD → IDR auto-conversion ---

let cachedUsdRate: number | null = null;
let usdRateCacheTime = 0;
const USD_RATE_CACHE_TTL = 6 * 60 * 60 * 1000;
let pendingRateFetch: Promise<number> | null = null;

export async function getKurs(): Promise<number> {
  return getUsdToIdr();
}

async function getUsdToIdr(): Promise<number> {
  const now = Date.now();
  if (cachedUsdRate && now - usdRateCacheTime < USD_RATE_CACHE_TTL) {
    return cachedUsdRate;
  }

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
        console.log(`[Provider4] USD/IDR rate updated: ${rate}`);
        return rate;
      }
    } catch (err) {
      console.warn("[Provider4] Failed to fetch USD rate, using fallback:", (err as Error).message);
    } finally {
      pendingRateFetch = null;
    }

    return cachedUsdRate || FALLBACK_USD_RATE;
  })();

  return pendingRateFetch;
}

async function convertToIdr(usdPrice: number): Promise<number> {
  const rate = await getUsdToIdr();
  return Math.ceil(usdPrice * rate * PRICE_MARKUP);
}

// --- Cache ---

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

// --- Service names ---

let serviceNamesCache: Record<string, string> | null = null;
let serviceNamesCacheTime = 0;
const SERVICE_NAMES_TTL = 3600000;

async function getServiceNames(): Promise<Record<string, string>> {
  const now = Date.now();
  if (serviceNamesCache && now - serviceNamesCacheTime < SERVICE_NAMES_TTL) {
    return serviceNamesCache;
  }

  const names: Record<string, string> = {};

  try {
    const data = await fetchProviderJson({ action: "getServicesList" });

    if (data && typeof data === "object") {
      const services = (data as { services?: Array<{ code: string; name: string }> }).services;

      if (Array.isArray(services)) {
        for (const svc of services) {
          if (svc.code && svc.name) {
            names[svc.code] = svc.name;
          }
        }
      } else {
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
    if (serviceNamesCache) return serviceNamesCache;
  }

  serviceNamesCache = names;
  serviceNamesCacheTime = now;
  return names;
}

// --- Public API ---

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

export async function getOperator(negara: number) {
  const negaraKey = String(negara);
  return { data: { [negaraKey]: ["any"] } };
}

/**
 * Versi raw dari getLayanan — return USD cost asli (untuk admin set maxPrice).
 * Plus suggested IDR price (dengan markup) sebagai default usulan.
 */
export async function getLayananRaw(negara: number): Promise<
  Array<{ code: string; name: string; costUsd: number; stockHeroSms: number; suggestedIdr: number }>
> {
  const [pricesData, serviceNames, kurs] = await Promise.all([
    fetchProviderJson({ action: "getPrices", country: String(negara) }),
    getServiceNames(),
    getUsdToIdr(),
  ]);

  const negaraKey = String(negara);
  const result: Array<{ code: string; name: string; costUsd: number; stockHeroSms: number; suggestedIdr: number }> = [];

  if (pricesData && typeof pricesData === "object") {
    const countryData =
      (pricesData as Record<string, unknown>)[negaraKey] || pricesData;

    if (countryData && typeof countryData === "object") {
      for (const [code, info] of Object.entries(countryData as Record<string, unknown>)) {
        if (info && typeof info === "object") {
          const service = info as { cost?: number; count?: number };
          if (typeof service.cost === "number") {
            result.push({
              code,
              name: serviceNames[code] || code,
              costUsd: service.cost,
              stockHeroSms: service.count || 0,
              suggestedIdr: Math.ceil(service.cost * kurs * PRICE_MARKUP),
            });
          }
        }
      }
    }
  }

  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

/**
 * Lookup harga USD listing terbaru dari HeroSMS untuk service+country tertentu.
 * Pakai cache `getPrices` (3 menit) — hemat request, sama dengan harga yang dipake
 * pas hitung harga ke user. Dipake sebagai cap `maxPrice` di getNumberV2.
 */
async function getCurrentUsdPrice(negara: number, layanan: string): Promise<number | null> {
  try {
    const data = await fetchProviderJson({ action: "getPrices", country: String(negara) });
    if (data && typeof data === "object") {
      const negaraKey = String(negara);
      const countryData =
        (data as Record<string, unknown>)[negaraKey] || data;
      if (countryData && typeof countryData === "object") {
        const service = (countryData as Record<string, unknown>)[layanan];
        if (service && typeof service === "object") {
          const cost = (service as { cost?: number }).cost;
          if (typeof cost === "number" && cost > 0) return cost;
        }
      }
    }
  } catch {
    // Kalau gagal lookup, lanjut tanpa maxPrice — fallback ke perilaku lama.
  }
  return null;
}

/**
 * Create order — uses getNumberV2 (JSON response).
 * Provider response: {"activationId": "...", "phoneNumber": "...", "activationCost": "...", ...}
 * On error: {"status": "ERROR", "message": "NO_NUMBERS"} or text "NO_NUMBERS"
 *
 * Strategi maxPrice (urutan prioritas):
 *   1. opts.maxPriceUsd dari admin (manual stock entry) — wajib dihormati biar margin terjaga
 *   2. Auto fetch USD listing terbaru dari getPrices (kalau opts gak diisi)
 *   3. Skip maxPrice (kalau lookup gagal)
 */
export async function createOrder(
  negara: number,
  layanan: string,
  operator: string,
  opts?: { maxPriceUsd?: number | null }
) {
  const params: Record<string, string> = {
    action: "getNumberV2",
    service: layanan,
    country: String(negara),
  };

  if (operator && operator !== "any") {
    params.operator = operator;
  }

  // Prioritas 1: pakai maxPrice yang admin set di DB
  let maxUsdPrice: number | null = opts?.maxPriceUsd ?? null;

  // Prioritas 2: fallback ke harga listing live
  if (maxUsdPrice === null) {
    maxUsdPrice = await getCurrentUsdPrice(negara, layanan);
  }

  if (maxUsdPrice !== null) {
    params.maxPrice = maxUsdPrice.toFixed(4);
  }

  const text = await fetchProvider(params, { skipCache: true });

  // Coba parse JSON dulu (response normal V2)
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Bukan JSON → mungkin error string V1-style (NO_NUMBERS dll)
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as {
      activationId?: number | string;
      phoneNumber?: string;
      status?: string;
      message?: string;
      error?: string;
    };

    // Sukses: ada activationId + phoneNumber
    if (obj.activationId && obj.phoneNumber) {
      const orderId = typeof obj.activationId === "string"
        ? parseInt(obj.activationId, 10)
        : obj.activationId;

      let number = String(obj.phoneNumber);
      if (!number.startsWith("+")) number = "+" + number;

      if (!orderId || !number) {
        throw new Error("Invalid V2 order response format");
      }

      return { order_id: orderId, number };
    }

    // Error JSON
    const errMsg = obj.message || obj.error || obj.status || "Gagal membuat pesanan";
    throw new Error(translateOrderError(errMsg));
  }

  // Fallback: response text V1-style (kalau provider belum support V2 untuk service tertentu)
  throw new Error(translateOrderError(text || "Gagal membuat pesanan"));
}

function translateOrderError(text: string): string {
  if (text === "NO_NUMBERS") return "Stok habis untuk layanan ini";
  if (text === "NO_BALANCE") return "Saldo provider tidak cukup";
  if (text === "WRONG_SERVICE") return "Layanan tidak tersedia";
  if (text === "WRONG_COUNTRY") return "Negara tidak tersedia";
  return text;
}

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

  return { otp: null, status: text };
}

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
