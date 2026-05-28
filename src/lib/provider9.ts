/**
 * Provider 9 Adapter — Uranus 🌌
 * Endpoint Clowatch v3, skip pricing rule (harga raw dari provider langsung).
 *
 *   - Endpoint: https://api.clowatch.com/api/v3 (default)
 *   - API key terpisah (PROVIDER9_API_KEY), boleh fallback ke Earth's key
 *   - Mirror kontrak: /countries, /services?country=, POST /order, GET /order/:id, POST /order/:id/cancel
 *
 * Harga tampilan = priceIdr dari API langsung (tidak ada PriceRule + tidak ada flat markup).
 * Sama treatment dengan Saturn (api3) dan Venus (api6) di FINAL_PRICE_PROVIDERS.
 */

const BASE_URL =
  process.env.PROVIDER9_API_URL || "https://api.clowatch.com/api/v3";
const API_KEY =
  process.env.PROVIDER9_API_KEY || process.env.PROVIDER5_API_KEY || "";

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

class Provider9Error extends Error {
  status: number;
  code?: string;
  retryAfterSec?: number;

  constructor(message: string, status: number, code?: string, retryAfterSec?: number) {
    super(message);
    this.name = "Provider9Error";
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
}

async function fetchProvider(path: string, options: FetchOptions = {}): Promise<unknown> {
  const { method = "GET", body, query, skipCache = false, ttlMs } = options;

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
  const timeout = setTimeout(() => controller.abort(), 15000);

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
      throw new Provider9Error(msg, res.status, obj.code, obj.retryAfterSec);
    }

    if (cacheKey && !skipCache) {
      setCache(cacheKey, data, ttlMs ?? 180000);
    }

    return data;
  } finally {
    clearTimeout(timeout);
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

export async function getBalance(): Promise<{ balance: number }> {
  throw new Error("BALANCE_NOT_SUPPORTED");
}

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

export async function getLayanan(negara: number) {
  const raw = (await fetchProvider("/services", {
    query: { country: String(negara) },
    ttlMs: 180000,
  })) as { data?: ServiceRow[] };

  const list = Array.isArray(raw?.data) ? raw.data : [];

  const negaraKey = String(negara);
  const serviceData: Record<string, { harga: number; stok: number; layanan: string }> = {};

  // Bersihkan nama dari operator suffix supaya UI tampil clean.
  // Contoh: "Whatsapp (virtual53)" → "Whatsapp"
  const cleanName = (name: string): string => {
    return name.replace(/\s*\([^)]*\)\s*$/g, "").trim();
  };

  for (const svc of list) {
    if (!svc.code || typeof svc.priceIdr !== "number") continue;
    serviceData[svc.code] = {
      harga: svc.priceIdr,
      stok: typeof svc.stock === "number" ? svc.stock : 0,
      layanan: cleanName(svc.name || svc.code),
    };
  }

  return { [negaraKey]: serviceData };
}

export async function getOperator(negara: number) {
  return { data: { [String(negara)]: ["any"] } };
}

export async function createOrder(negara: number, layanan: string, _operator: string) {
  void _operator;
  const raw = (await fetchProvider("/order", {
    method: "POST",
    body: { countryId: negara, service: layanan },
    skipCache: true,
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

  if (orderIdNum > 2_147_483_647) {
    throw new Error(`OrderId ${orderIdNum} exceeds Int32 range; need schema migration`);
  }

  let number = String(orderObj.number);
  if (!number.startsWith("+")) number = "+" + number;

  return { order_id: orderIdNum, number };
}

export async function checkSms(orderId: number) {
  let raw: { data?: { status?: string; otp?: string | null } };
  try {
    raw = (await fetchProvider(`/order/${orderId}`, { skipCache: true })) as {
      data?: { status?: string; otp?: string | null };
    };
  } catch (err) {
    if (err instanceof Provider9Error && err.status === 404) {
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
    return { otp: null, status: "waiting" };
  }
  if (/time\s*out|timeout/i.test(status)) return { otp: null, status: "timeout" };
  if (/dibatalkan|cancel/i.test(status)) return { otp: null, status: "cancelled" };

  return { otp: null, status: status || "waiting" };
}

export async function cancelOrder(orderId: number) {
  try {
    const raw = (await fetchProvider(`/order/${orderId}/cancel`, {
      method: "POST",
      skipCache: true,
    })) as { ok?: boolean };

    if (raw?.ok === true) return { success: true };
    return { success: true };
  } catch (err) {
    if (err instanceof Provider9Error) {
      if (err.code === "TOO_EARLY") {
        const sec = err.retryAfterSec ?? 0;
        throw new Error(`Belum bisa cancel — tunggu ${sec} detik lagi (min 2 menit setelah order)`);
      }
      if (err.status === 404) {
        return { success: true };
      }
    }
    throw err;
  }
}
