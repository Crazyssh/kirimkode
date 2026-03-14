/**
 * Provider 4 Adapter — Neptune 🔵
 * Calls the Neptune Express API server (otp.ditznesia.id wrapper).
 * All responses match the format returned by provider 1 & 2 (JasaOTP).
 */

const BASE_URL = process.env.NEPTUNE_API_URL || "http://localhost:3005";

// Markup 40% di atas harga provider
const PRICE_MARKUP = 1.40;

// Simple in-memory cache
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

async function fetchNeptune(
  endpoint: string,
  options?: {
    method?: string;
    body?: Record<string, unknown>;
    skipCache?: boolean;
  }
): Promise<unknown> {
  const url = `${BASE_URL}${endpoint}`;

  // Check cache (only for GET)
  if (!options?.skipCache && (!options?.method || options.method === "GET")) {
    const cached = getCached(url);
    if (cached) return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const fetchOpts: RequestInit = {
      method: options?.method || "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    };

    if (options?.body) {
      fetchOpts.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, fetchOpts);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || `Neptune API error: ${res.status}`);
    }

    // Cache GET responses
    if (!options?.skipCache && (!options?.method || options.method === "GET")) {
      const ttl = endpoint.includes("negara") ? 1800000 : 180000;
      setCache(url, data, ttl);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Public API (matches otp.ts format) ---

export async function getBalance() {
  const data = (await fetchNeptune("/health", { skipCache: true })) as {
    status: string;
  };
  return { balance: data.status === "ready" ? 999 : 0 };
}

export async function getNegara() {
  const data = (await fetchNeptune("/negara")) as {
    success: boolean;
    data: Array<{ id_negara: number; nama_negara: string }>;
  };
  return { success: true, data: data.data || [] };
}

export async function getLayanan(negara: number) {
  const data = (await fetchNeptune(`/layanan/${negara}`)) as Record<
    string,
    Record<string, { harga: number; stok: number; layanan: string }>
  >;

  const negaraKey = String(negara);
  const result: Record<
    string,
    Record<string, { harga: number; stok: number; layanan: string }>
  > = {};
  result[negaraKey] = {};

  // Apply markup to prices
  const services = data?.[negaraKey] || {};
  for (const [code, info] of Object.entries(services)) {
    result[negaraKey][code] = {
      harga: Math.ceil(info.harga * PRICE_MARKUP),
      stok: info.stok,
      layanan: info.layanan,
    };
  }

  return result;
}

export async function getOperator(negara: number) {
  const negaraKey = String(negara);
  return { data: { [negaraKey]: ["any"] } };
}

export async function createOrder(
  negara: number,
  layanan: string,
  _operator: string
) {
  const data = (await fetchNeptune("/order", {
    method: "POST",
    body: { negara, layanan },
    skipCache: true,
  })) as { order_id: number | string; number: string };

  if (!data.order_id || !data.number) {
    throw new Error("Order gagal — response tidak valid");
  }

  return {
    order_id: data.order_id,
    number: data.number,
  };
}

export async function checkSms(orderId: number) {
  // orderId for Neptune is actually the phone number (stored as order reference)
  // KirimKode passes the order's `number` field when checking SMS
  const data = (await fetchNeptune(`/sms/${orderId}`, {
    skipCache: true,
  })) as { otp: string | null; status: string };

  if (data.otp) {
    return { otp: data.otp, status: "success" };
  }
  if (data.status === "cancelled") {
    return { otp: null, status: "cancelled" };
  }
  if (data.status === "timeout") {
    return { otp: null, status: "timeout" };
  }

  return { otp: null, status: "waiting" };
}

export async function cancelOrder(orderId: number) {
  // orderId is actually phone number for Neptune
  const data = (await fetchNeptune(`/cancel/${orderId}`, {
    skipCache: true,
  })) as { success: boolean };

  if (data.success) {
    return { success: true };
  }

  throw new Error("Gagal membatalkan pesanan");
}
