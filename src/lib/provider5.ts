/**
 * Provider 5 Adapter — Earth (Beta) 🌍
 * KirimKode-format provider via Clowatch API.
 *
 * Endpoint: https://api.clowatch.com/api/v1
 * Auth: Authorization: Bearer <API_KEY>
 *
 * Format response sudah JSON bersih (data array). Harga sudah final IDR.
 *
 * Mengikuti alur api1/Mars: harga raw disimpan apa adanya, admin bisa markup
 * via PriceRule. Skip USD->IDR conversion (sudah IDR).
 */

const BASE_URL =
  process.env.PROVIDER5_API_URL || "https://api.clowatch.com/api/v1";
const API_KEY = process.env.PROVIDER5_API_KEY || "";

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

// --- Custom errors ---

class Provider5Error extends Error {
  status: number;
  code?: string;
  retryAfterSec?: number;

  constructor(message: string, status: number, code?: string, retryAfterSec?: number) {
    super(message);
    this.name = "Provider5Error";
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

// --- Fetch helper ---

interface FetchOptions {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  query?: Record<string, string>;
  skipCache?: boolean;
  ttlMs?: number;
  noTimeout?: boolean; // true = tunggu sampai provider respon (untuk order)
}

async function fetchProvider(path: string, options: FetchOptions = {}): Promise<unknown> {
  const { method = "GET", body, query, skipCache = false, ttlMs, noTimeout = false } = options;

  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }

  const urlStr = url.toString();
  const cacheKey = method === "GET" ? urlStr : null;

  if (cacheKey && !skipCache) {
    const cached = getCached(cacheKey);
    if (cached !== null) return cached;
  }

  const controller = new AbortController();
  // Order (noTimeout): tunggu sampai Clowatch respon, tanpa batas waktu.
  // Call lain: timeout 30 detik supaya koneksi nyangkut gak numpuk.
  const timeout = noTimeout ? null : setTimeout(() => controller.abort(), 30000);

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json",
    };
    if (body) headers["Content-Type"] = "application/json";

    const res = await fetch(urlStr, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });

    let data: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    }

    if (!res.ok) {
      const obj = (data || {}) as { error?: string; message?: string; code?: string; retryAfterSec?: number };
      const msg = obj.error || obj.message || `HTTP ${res.status}`;
      throw new Provider5Error(msg, res.status, obj.code, obj.retryAfterSec);
    }

    if (cacheKey && !skipCache) {
      setCache(cacheKey, data, ttlMs ?? 180000);
    }

    return data;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

// --- Types ---

interface CountryRow {
  id: number;
  slug?: string;
  name: string;
}

interface ServiceRow {
  code: string;
  name: string;
  priceIdr: number;
  stock: number;
}

interface OrderResponse {
  orderId: string | number;
  number: string;
  service?: string;
  serviceName?: string;
  country?: string;
  countryId?: number;
  priceIdr?: number;
  status?: string;
  otp?: string | null;
}

// --- Public API (matches otp.ts dispatcher contract) ---

/**
 * Get balance — Mars API tidak expose endpoint balance.
 * Throw error supaya health check fallback ke layanan check.
 */
export async function getBalance(): Promise<{ balance: number }> {
  throw new Error("BALANCE_NOT_SUPPORTED");
}

/**
 * Get countries.
 * API: GET /countries
 * Response: { data: [{ id, slug, name }], total }
 */
export async function getNegara() {
  const raw = (await fetchProvider("/countries", { ttlMs: 1800000 })) as { data?: CountryRow[] };
  const list = Array.isArray(raw?.data) ? raw.data : [];

  const countries = list
    .filter((c) => typeof c.id === "number" && typeof c.name === "string")
    .map((c) => ({
      id_negara: c.id,
      nama_negara: c.name.toLowerCase(),
    }))
    .sort((a, b) => a.nama_negara.localeCompare(b.nama_negara));

  return { success: true, data: countries };
}

/**
 * Get services for a country.
 * API: GET /services?country=<id>
 * Response: { data: [{ code, name, priceIdr, stock }], total }
 *
 * Internal format: { "<negara>": { "<code>": { harga, stok, layanan } } }
 */
export async function getLayanan(negara: number) {
  const raw = (await fetchProvider("/services", {
    query: { country: String(negara) },
    ttlMs: 180000,
  })) as { data?: ServiceRow[] };

  const list = Array.isArray(raw?.data) ? raw.data : [];

  const negaraKey = String(negara);
  const serviceData: Record<string, { harga: number; stok: number; layanan: string }> = {};

  for (const svc of list) {
    if (!svc.code || typeof svc.priceIdr !== "number") continue;
    serviceData[svc.code] = {
      harga: svc.priceIdr,
      stok: typeof svc.stock === "number" ? svc.stock : 0,
      layanan: svc.name || svc.code,
    };
  }

  return { [negaraKey]: serviceData };
}

/**
 * Operators — Clowatch v1 support operator selection via GET /operators?country=<id>.
 * Response: { data: ["any", "telkomsel", "indosat", "axis"], total }
 * "any" = auto-pilih operator oleh provider.
 *
 * Kalau gagal/empty → fallback ke ["any"].
 */
export async function getOperator(negara: number) {
  try {
    const raw = (await fetchProvider("/operators", {
      query: { country: String(negara) },
      ttlMs: 600000, // 10 menit
    })) as { data?: string[] };

    const list = Array.isArray(raw?.data) ? raw.data.filter((o) => typeof o === "string") : [];
    const ops = list.length > 0 ? list : ["any"];
    // Pastikan "any" selalu ada & di urutan pertama
    const withAny = ops.includes("any") ? ops : ["any", ...ops];
    return { data: { [String(negara)]: withAny } };
  } catch {
    return { data: { [String(negara)]: ["any"] } };
  }
}

/**
 * Create order.
 * API: POST /order body { countryId, service, operator? }
 * Response: { data: { orderId, number, ... } }
 *
 * operator: "any" (default) = auto-pilih oleh provider. Selain itu kirim operator
 * spesifik (telkomsel/indosat/axis/dll).
 *
 * Catatan: orderId di response bisa string. Internal schema Order.orderId Int —
 * parse ke number, validasi fits Int32, kalau tidak throw.
 */
export async function createOrder(negara: number, layanan: string, operator: string) {
  const body: Record<string, unknown> = { countryId: negara, service: layanan };
  // Kirim operator hanya kalau spesifik (bukan "any" / kosong)
  if (operator && operator !== "any") {
    body.operator = operator;
  }
  const raw = (await fetchProvider("/order", {
    method: "POST",
    body,
    skipCache: true,
    noTimeout: true,
  })) as { data?: OrderResponse };

  const orderObj = raw?.data;
  if (!orderObj || !orderObj.orderId || !orderObj.number) {
    throw new Error("Invalid order response from provider");
  }

  const orderIdNum = typeof orderObj.orderId === "number"
    ? orderObj.orderId
    : Number(String(orderObj.orderId).replace(/\D/g, ""));

  if (!Number.isFinite(orderIdNum) || orderIdNum <= 0) {
    throw new Error(`Invalid orderId from provider: ${orderObj.orderId}`);
  }

  // Schema Order.orderId Int @ Postgres = max 2^31 - 1
  if (orderIdNum > 2_147_483_647) {
    throw new Error(`OrderId ${orderIdNum} exceeds Int32 range; need schema migration`);
  }

  let number = String(orderObj.number);
  if (!number.startsWith("+")) number = "+" + number;

  return { order_id: orderIdNum, number };
}

/**
 * Check OTP / status.
 * API: GET /order/:id
 * Response: { data: { orderId, number, status, otp, ... } }
 *
 * Status mapping:
 *   "PENDING"     -> { otp: null, status: "waiting" }
 *   "Sukses"      -> kalau otp ada -> success, kalau null -> waiting
 *   "TIME OUT"    -> { otp: null, status: "timeout" }
 *   "Dibatalkan"  -> { otp: null, status: "cancelled" }
 */
export async function checkSms(orderId: number) {
  let raw: { data?: { status?: string; otp?: string | null } };
  try {
    raw = (await fetchProvider(`/order/${orderId}`, { skipCache: true })) as {
      data?: { status?: string; otp?: string | null };
    };
  } catch (err) {
    if (err instanceof Provider5Error && err.status === 404) {
      // SAFE FALLBACK: 404 untuk order baru bisa karena race condition
      // di sisi provider (belum propagate). Treat as "waiting", bukan cancelled.
      // Order yang memang expired akan ditangkap cron timeout 20 menit.
      return { otp: null, status: "waiting" };
    }
    throw err;
  }

  const obj = raw?.data ?? {};
  const status = (obj.status || "").trim();
  const otp = obj.otp || null;

  if (otp) return { otp, status: "success" };

  if (/^pending$/i.test(status)) return { otp: null, status: "waiting" };
  if (/sukses|success/i.test(status)) {
    // Sukses tapi otp belum di-set — masih nunggu
    return { otp: null, status: "waiting" };
  }
  if (/time\s*out|timeout/i.test(status)) return { otp: null, status: "timeout" };
  if (/dibatalkan|cancel/i.test(status)) return { otp: null, status: "cancelled" };

  // Status tidak dikenal — return as-is supaya log bisa investigasi
  return { otp: null, status: status || "waiting" };
}

/**
 * Cancel order.
 * API: POST /order/:id/cancel
 * Hanya bisa setelah 2 menit dari order dibuat.
 *
 * Response sukses: { ok: true }
 * Response error TOO_EARLY: { error, code: "TOO_EARLY", retryAfterSec }
 */
export async function cancelOrder(orderId: number) {
  try {
    const raw = (await fetchProvider(`/order/${orderId}/cancel`, {
      method: "POST",
      skipCache: true,
      noTimeout: true,
    })) as { ok?: boolean; error?: string };

    if (raw?.ok === false) {
      throw new Error(raw.error || "Provider menolak cancel");
    }
    return { success: true };
  } catch (err) {
    if (err instanceof Provider5Error) {
      if (err.code === "TOO_EARLY") {
        const sec = err.retryAfterSec ?? 0;
        throw new Error(`Belum bisa cancel — tunggu ${sec} detik lagi (min 2 menit setelah order)`);
      }
      if (err.status === 404) {
        // Order sudah hilang di provider — anggap sudah cancelled
        return { success: true };
      }
    }
    throw err;
  }
}
