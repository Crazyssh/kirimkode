/**
 * Provider 7 Adapter — Mars V2 (Happy Pixel API)
 *
 * Docs: https://api.happypixel.net/docs
 * Base URL: https://api.happypixel.net/v1
 * Auth: Bearer <API_KEY> (atau X-API-Key, atau ?api_key=)
 *
 * Format response: { code, success, message, data }
 * Pricing: harga raw dari provider (IDR), apply admin PriceRule sama seperti Mars (api1).
 * Operator: support (sama seperti api1).
 */

const BASE_URL =
  process.env.PROVIDER7_API_URL || "https://api.happypixel.net/v1";
const API_KEY = process.env.PROVIDER7_API_KEY || "";

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

// --- Custom error ---

class Provider7Error extends Error {
  status: number;
  code?: number;
  constructor(message: string, status: number, code?: number) {
    super(message);
    this.name = "Provider7Error";
    this.status = status;
    this.code = code;
  }
}

// --- Fetch helper ---

interface FetchOptions {
  query?: Record<string, string>;
  skipCache?: boolean;
  ttlMs?: number;
}

async function fetchProvider(path: string, options: FetchOptions = {}): Promise<unknown> {
  const { query, skipCache = false, ttlMs } = options;

  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }

  const urlStr = url.toString();
  if (!skipCache) {
    const cached = getCached(urlStr);
    if (cached !== null) return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(urlStr, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    }

    // Provider format: { code, success, message, data }
    const obj = (data || {}) as { code?: number; success?: boolean; message?: string; data?: unknown };

    if (!res.ok || obj.success === false) {
      const msg = obj.message || `HTTP ${res.status}`;
      throw new Provider7Error(msg, res.status, obj.code);
    }

    if (!skipCache) {
      setCache(urlStr, data, ttlMs ?? 180000);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Types ---

interface NegaraItem {
  id_negara: number;
  nama_negara: string;
}

interface LayananInfo {
  harga: number;
  stok: number;
  layanan: string;
}

// --- Public API (matches otp.ts dispatcher contract) ---

/**
 * GET /v1/balance
 * Response: { ..., data: { saldo, updated_at } }
 *
 * Internal contract (sama seperti JasaOTP api1/api2): { data: { saldo } }
 */
export async function getBalance() {
  const raw = (await fetchProvider("/balance", { skipCache: true })) as {
    data?: { saldo?: number };
  };
  const saldo = raw?.data?.saldo ?? 0;
  return { data: { saldo } };
}

/**
 * GET /v1/negara
 * Response: { ..., data: [{ id_negara, nama_negara }] }
 */
export async function getNegara() {
  const raw = (await fetchProvider("/negara", { ttlMs: 1800000 })) as {
    data?: NegaraItem[];
  };
  const list = Array.isArray(raw?.data) ? raw.data : [];

  const countries = list
    .filter((c) => typeof c.id_negara === "number" && typeof c.nama_negara === "string")
    .map((c) => ({
      id_negara: c.id_negara,
      nama_negara: c.nama_negara.toLowerCase(),
    }))
    .sort((a, b) => a.nama_negara.localeCompare(b.nama_negara));

  return { success: true, data: countries };
}

/**
 * GET /v1/operator?negara=<id>
 * Response: { ..., data: { "<id>": ["any", "indosat", ...] } }
 */
export async function getOperator(negara: number) {
  const raw = (await fetchProvider("/operator", {
    query: { negara: String(negara) },
    ttlMs: 1800000,
  })) as { data?: Record<string, string[]> };

  const negaraKey = String(negara);
  const ops = raw?.data?.[negaraKey] || ["any"];
  return { data: { [negaraKey]: ops } };
}

/**
 * GET /v1/layanan?negara=<id>
 * Response: { ..., data: { "<id>": { "<code>": { harga, stok, layanan } } } }
 *
 * Format kompatibel langsung dengan internal contract.
 */
export async function getLayanan(negara: number) {
  const raw = (await fetchProvider("/layanan", {
    query: { negara: String(negara) },
    ttlMs: 180000,
  })) as { data?: Record<string, Record<string, LayananInfo>> };

  const negaraKey = String(negara);
  const serviceData = raw?.data?.[negaraKey] || {};

  return { [negaraKey]: serviceData };
}

/**
 * GET /v1/order?negara=<id>&layanan=<code>&operator=<op>
 * Response: { ..., data: { order_id: "5849273011", number: "+62..." } }
 *
 * Provider order_id 10 digit string → parse ke number, validasi muat Int32.
 */
export async function createOrder(negara: number, layanan: string, operator: string) {
  const op = operator && operator !== "" ? operator : "any";

  const raw = (await fetchProvider("/order", {
    query: {
      negara: String(negara),
      layanan,
      operator: op,
    },
    skipCache: true,
  })) as { data?: { order_id?: string | number; number?: string } };

  const orderObj = raw?.data;
  if (!orderObj?.order_id || !orderObj.number) {
    throw new Error("Invalid order response from Mars V2");
  }

  const orderIdNum = typeof orderObj.order_id === "number"
    ? orderObj.order_id
    : Number(String(orderObj.order_id).replace(/\D/g, ""));

  if (!Number.isFinite(orderIdNum) || orderIdNum <= 0) {
    throw new Error(`Invalid order_id from Mars V2: ${orderObj.order_id}`);
  }

  // Order.orderId schema = Int (Int32 max = 2_147_483_647). 10 digit bisa overflow.
  if (orderIdNum > 2_147_483_647) {
    throw new Error(
      `Order ID ${orderIdNum} exceeds Int32 range; need schema migration to BigInt`
    );
  }

  let number = String(orderObj.number);
  if (!number.startsWith("+")) number = "+" + number;

  return { order_id: orderIdNum, number };
}

/**
 * Cek status order via GET /v1/orders/:id (detail order).
 *
 * Kenapa pakai /orders/:id bukan /sms?
 * - /sms return 202 untuk pending, 200 untuk OTP. Kasus cancelled/timeout
 *   tidak jelas dari docs — kemungkinan return 404 yang ambigu.
 * - /orders/:id selalu return status field eksplisit
 *   (pending|received|cancelled|timeout) → no ambiguity.
 *
 * Status mapping:
 *   received + otp → { otp, status: "success" }
 *   pending        → { otp: null, status: "waiting" }
 *   cancelled      → { otp: null, status: "cancelled" }
 *   timeout        → { otp: null, status: "timeout" }
 *   404/500/error  → { otp: null, status: "waiting" } (safe fallback)
 */
export async function checkSms(orderId: number) {
  // Bypass cache helper: state berubah cepat, jangan cache.
  const url = new URL(`${BASE_URL}/orders/${orderId}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: { code?: number; success?: boolean; message?: string; data?: { otp?: string | null; status?: string } } | null = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    // SAFE FALLBACK: kalau response gak parsable atau HTTP non-2xx, return "waiting".
    // Mars V2 kadang return 404 untuk order yang baru saja dibuat (race condition
    // dengan upstream propagation). Kalau treat sebagai cancelled, cron auto-refund
    // order valid → user lihat nomor lalu langsung dibatalkan.
    // Order yang memang sudah expired akan ditangkap oleh cron timeout 20 menit.
    if (!parsed || !res.ok) {
      return { otp: null, status: "waiting" };
    }

    const data = parsed.data || {};
    const status = (data.status || "").toLowerCase();
    const otp = data.otp;

    // received + otp → success
    if (status === "received" && otp) {
      return { otp: String(otp), status: "success" };
    }

    // received tapi otp belum di-set (race condition di provider) → masih nunggu
    if (status === "received") {
      return { otp: null, status: "waiting" };
    }

    if (status === "cancelled" || status === "canceled") {
      return { otp: null, status: "cancelled" };
    }

    if (status === "timeout" || status === "expired") {
      return { otp: null, status: "timeout" };
    }

    // pending atau status tidak dikenal → masih nunggu
    return { otp: null, status: "waiting" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * GET /v1/cancel?id=<order_id>
 * Response: { ..., data: { order_id, refunded_amount } }
 */
export async function cancelOrder(orderId: number) {
  try {
    await fetchProvider("/cancel", {
      query: { id: String(orderId) },
      skipCache: true,
    });
    return { success: true };
  } catch (err) {
    if (err instanceof Provider7Error) {
      // Sudah cancelled / received di sisi provider — anggap sukses dari user POV
      if (err.status === 404 || err.status === 403) {
        return { success: true };
      }
    }
    throw err;
  }
}
