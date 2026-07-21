/**
 * Provider 4 Adapter — HeroSMS via getNumberV2 endpoint.
 * Sama seperti provider3, kecuali:
 *   - createOrder pakai action=getNumberV2 (response JSON, bukan text)
 *   - PRICE_MARKUP 1.35 (samain dengan Saturn/api3)
 *   - API key terpisah (PROVIDER4_API_KEY)
 * Endpoint lain (balance/countries/prices/status/cancel) tetap V1 — HeroSMS belum
 * menyediakan V2 untuk itu.
 */

import { getUsdToIdr } from "@/lib/usd-rate";

const BASE_URL =
  process.env.PROVIDER4_API_URL ||
  process.env.PROVIDER3_API_URL ||
  "https://hero-sms.com/stubs/handler_api.php";
const API_KEY = process.env.PROVIDER4_API_KEY || "";

// Markup 35% di atas harga provider (samain dengan Saturn/api3).
export const PRICE_MARKUP = 1.35;

// Re-export getUsdToIdr untuk admin pages yang masih akses via getKurs()
export async function getKurs(): Promise<number> {
  return getUsdToIdr();
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

// --- Offers endpoint (activation offers V2) ---
// REST endpoint terpisah dari SMS-Activate compat: base URL beda + auth header "ApiKey".
// Response: { data: { <service>: { <country>: { prices, counts, map } } }, meta }
// `map` = { "<harga USD>": <jumlah nomor kumulatif dengan harga ≤ tarif itu> } (ascending).
const OFFERS_URL =
  process.env.PROVIDER4_OFFERS_URL || "https://hero-sms.com/api/v1/activations/offers";

type OffersService = {
  prices?: { default?: number; retail?: number; min?: number };
  counts?: { total?: number; physical?: number; defaultPrice?: number };
  map?: Record<string, number>;
};

type OffersData = Record<string, Record<string, OffersService>>;

/**
 * Fetch offers untuk satu negara — TANPA filter service = ambil SEMUA layanan sekaligus.
 * Cache 3 menit (sama dengan getPrices).
 */
async function fetchOffers(negara: number): Promise<OffersData> {
  const url = new URL(OFFERS_URL);
  url.searchParams.set("countries", String(negara));
  const urlStr = url.toString();

  const cached = getCached(urlStr);
  if (cached) return cached as OffersData;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(urlStr, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `ApiKey ${API_KEY}`,
      },
    });

    const json = (await res.json()) as { data?: OffersData };
    const data = json?.data ?? {};
    setCache(urlStr, data, 180000);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export interface Band {
  capUsd: number; // harga tertinggi di band 0.01 USD → dipakai sebagai maxPrice
  capMilli: number; // round(capUsd * 10000) — id stabil untuk composite code
  stock: number; // jumlah nomor kumulatif dengan harga ≤ capUsd
}

/**
 * Kelompokkan `map` (harga→count kumulatif) ke band 0.01 USD.
 * Untuk tiap band, ambil harga TERTINGGI sebagai cap + count kumulatif di harga itu.
 * Contoh: 0.1050..0.1176 → cap 0.1176; 0.1412..0.1496 → cap 0.1496.
 */
export function bandOffers(map: Record<string, number>): Band[] {
  const bands = new Map<number, { capUsd: number; stock: number }>();
  for (const [priceStr, cumCount] of Object.entries(map)) {
    const price = parseFloat(priceStr);
    if (!isFinite(price) || price <= 0) continue;
    const bandKey = Math.floor(price * 100); // 0.1496 → 14
    const existing = bands.get(bandKey);
    // map ascending & kumulatif → harga tertinggi di band punya count kumulatif terbesar
    if (!existing || price > existing.capUsd) {
      bands.set(bandKey, { capUsd: price, stock: cumCount });
    }
  }

  const result: Band[] = [];
  for (const { capUsd, stock } of bands.values()) {
    result.push({ capUsd, capMilli: Math.round(capUsd * 10000), stock });
  }
  result.sort((a, b) => a.capUsd - b.capUsd);
  return result;
}

const CODE_SEP = "#";
/** Bentuk composite code: "<service>#<capMilli>" (mis. "wa#1496"). */
function buildBandCode(serviceCode: string, capMilli: number): string {
  return `${serviceCode}${CODE_SEP}${capMilli}`;
}
/** Pecah composite code → { serviceCode, capMilli } (capMilli null kalau bukan format band). */
function parseBandCode(code: string): { serviceCode: string; capMilli: number | null } {
  const [serviceCode, suffix] = code.split(CODE_SEP);
  const capMilli = suffix != null && /^\d+$/.test(suffix) ? parseInt(suffix, 10) : null;
  return { serviceCode, capMilli };
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

/**
 * Daftar layanan Neptune — LIVE dari /offers, di-band per 0.01 USD.
 * Tiap band jadi entry terpisah dengan composite code "<service>#<capMilli>".
 * Harga jual = capUsd × kurs × PRICE_MARKUP (final, skip pricing rule admin).
 */
export async function getLayanan(negara: number) {
  const [offers, serviceNames, kurs] = await Promise.all([
    fetchOffers(negara),
    getServiceNames(),
    getUsdToIdr(),
  ]);

  const negaraKey = String(negara);
  const result: Record<
    string,
    Record<string, { harga: number; stok: number; layanan: string }>
  > = { [negaraKey]: {} };

  for (const [svcCode, byCountry] of Object.entries(offers)) {
    const svc = byCountry?.[negaraKey];
    if (!svc?.map) continue;

    const name = serviceNames[svcCode] || svcCode;
    for (const band of bandOffers(svc.map)) {
      if (band.stock <= 0) continue;
      result[negaraKey][buildBandCode(svcCode, band.capMilli)] = {
        harga: Math.ceil(band.capUsd * kurs * PRICE_MARKUP),
        stok: band.stock,
        layanan: name,
      };
    }
  }

  return result;
}

/**
 * Lookup satu entry band live (buat buy flow) berdasarkan composite code.
 * Return harga IDR final + capUsd (dipakai sebagai maxPrice) + stock.
 * Throws "LAYANAN_NOT_FOUND" / "STOK_HABIS".
 */
export async function getLiveEntry(
  negara: number,
  code: string
): Promise<{ priceIdr: number; capUsd: number; stock: number }> {
  const { serviceCode, capMilli } = parseBandCode(code);
  if (capMilli === null) throw new Error("LAYANAN_NOT_FOUND");

  const [offers, kurs] = await Promise.all([fetchOffers(negara), getUsdToIdr()]);
  const svc = offers?.[serviceCode]?.[String(negara)];
  if (!svc?.map) throw new Error("LAYANAN_NOT_FOUND");

  const band = bandOffers(svc.map).find((b) => b.capMilli === capMilli);
  if (!band) throw new Error("LAYANAN_NOT_FOUND");
  if (band.stock <= 0) throw new Error("STOK_HABIS");

  return {
    priceIdr: Math.ceil(band.capUsd * kurs * PRICE_MARKUP),
    capUsd: band.capUsd,
    stock: band.stock,
  };
}

/**
 * Daftar operator per negara dari HeroSMS (action=getOperators).
 * Response: { status, countryOperators: { "<countryId>": ["op1", ...] } }.
 * "any" selalu jadi opsi pertama agar user bisa memilih operator otomatis.
 * Fallback ke ["any"] bila API gagal / negara tidak punya daftar operator.
 */
export async function getOperator(negara: number) {
  const negaraKey = String(negara);
  try {
    const data = await fetchProviderJson({ action: "getOperators" });
    const map = (data as { countryOperators?: Record<string, unknown> })?.countryOperators;
    const raw =
      map && typeof map === "object"
        ? (map as Record<string, unknown>)[negaraKey]
        : null;
    const ops = Array.isArray(raw)
      ? raw.filter((o): o is string => typeof o === "string")
      : [];
    return { data: { [negaraKey]: ["any", ...ops] } };
  } catch {
    return { data: { [negaraKey]: ["any"] } };
  }
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
 * Strategi maxPrice + fixedPrice (per-entry by admin):
 *   1. opts.maxPriceUsd dari admin + opts.fixedPrice=true (default):
 *      → strict, harga harus PERSIS sesuai admin (margin 100% predictable)
 *   2. opts.maxPriceUsd dari admin + opts.fixedPrice=false:
 *      → longgar, terima nomor termurah ≤ maxPrice (untung bisa lebih)
 *   3. opts.maxPriceUsd null → fallback ke listing live (tanpa fixedPrice)
 */
export async function createOrder(
  negara: number,
  layanan: string,
  operator: string,
  opts?: { maxPriceUsd?: number | null; fixedPrice?: boolean }
) {
  const params: Record<string, string> = {
    action: "getNumberV2",
    service: layanan,
    country: String(negara),
  };

  if (operator && operator !== "any") {
    params.operator = operator;
  }

  const adminMaxPrice = opts?.maxPriceUsd ?? null;
  const useFixedPrice = opts?.fixedPrice ?? true;

  if (adminMaxPrice !== null) {
    params.maxPrice = adminMaxPrice.toFixed(4);
    if (useFixedPrice) {
      params.fixedPrice = "true";
    }
  } else {
    // Fallback ke harga listing live (tanpa fixedPrice — terima yang lebih murah)
    const listingPrice = await getCurrentUsdPrice(negara, layanan);
    if (listingPrice !== null) {
      params.maxPrice = listingPrice.toFixed(4);
    }
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

/**
 * Request SMS resend (HeroSMS setStatus=3).
 * Dipanggil setelah user dapat OTP pertama dan mau minta SMS baru lagi
 * (sampai 20 menit dari order pertama). Gratis, gak charge ulang.
 *
 * Response sukses: ACCESS_RETRY_GET
 */
export async function requestRetry(orderId: number) {
  const text = await fetchProvider(
    { action: "setStatus", id: String(orderId), status: "3" },
    { skipCache: true }
  );

  if (text === "ACCESS_RETRY_GET" || text === "ACCESS_READY") {
    return { success: true };
  }

  throw new Error(text || "Gagal request SMS baru");
}
