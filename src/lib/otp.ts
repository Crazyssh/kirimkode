import * as provider3 from "@/lib/provider3";

const API_URLS = {
  api1: process.env.JASAOTP_API1_URL || "https://api.jasaotp.id/v1",
  api2: process.env.JASAOTP_API2_URL || "https://api.jasaotp.id/v2",
};

const API_KEY = process.env.JASAOTP_API_KEY || "";

export type ServerId = "api1" | "api2" | "api3" | "unified";

type JasaOtpServerId = "api1" | "api2";

function getBaseUrl(server: JasaOtpServerId): string {
  return API_URLS[server];
}

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
  // Limit cache size
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

// Custom error class untuk membedakan API error vs network error
class ApiBusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiBusinessError";
  }
}

async function fetchApi(
  server: JasaOtpServerId,
  endpoint: string,
  params?: Record<string, string>,
  options?: { skipRetry?: boolean; skipCache?: boolean }
) {
  const base = getBaseUrl(server);
  const url = new URL(`${base}/${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const urlStr = url.toString();

  // Check cache first (hanya untuk read endpoints)
  if (!options?.skipCache) {
    const cached = getCached(urlStr);
    if (cached) return cached;
  }

  const doFetch = async () => {
    const controller = new AbortController();
    const timeoutMs = options?.skipCache ? 20000 : 15000; // order/sms: 20s, read: 15s
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(urlStr, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        // Server error (5xx) → bisa retry
        if (res.status >= 500) {
          throw new Error(data?.message || `Server error: ${res.status}`);
        }
        // Client error (4xx) → API business error, jangan retry
        throw new ApiBusinessError(data?.message || data?.error || `API error: ${res.status}`);
      }

      // JasaOTP kadang return 200 tapi isinya error
      if (data?.success === false || data?.code === "error" || data?.status === "error") {
        throw new ApiBusinessError(data?.message || data?.error || "Gagal memproses request ke provider");
      }

      return data;
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    const data = await doFetch();
    // Cache hanya untuk read endpoints
    // Negara: 30 menit (jarang berubah), Layanan: 3 menit (stok cukup akurat)
    if (!options?.skipCache) {
      const ttl = endpoint.includes("negara") ? 1800000 : 180000;
      setCache(urlStr, data, ttl);
    }
    return data;
  } catch (err) {
    // API business error → langsung throw, jangan retry
    if (err instanceof ApiBusinessError || options?.skipRetry) {
      throw err;
    }

    // Network/timeout error → retry 1x
    console.warn(`[OTP API] Network error for ${endpoint}, retrying...`, (err as Error).message);
    try {
      const data = await doFetch();
      if (!options?.skipCache) {
        const ttl = endpoint.includes("negara") ? 1800000 : 180000;
        setCache(urlStr, data, ttl);
      }
      return data;
    } catch (retryErr) {
      if (retryErr instanceof ApiBusinessError) throw retryErr;
      console.error(`[OTP API] Retry failed for ${endpoint}:`, (retryErr as Error).message);
      throw retryErr;
    }
  }
}

export async function getBalance(server: ServerId) {
  if (server === "unified") throw new Error("Use unified-provider for unified server");
  if (server === "api3") return provider3.getBalance();
  return fetchApi(server, "balance.php", { api_key: API_KEY });
}

export async function getNegara(server: ServerId) {
  if (server === "unified") throw new Error("Use unified-provider for unified server");
  if (server === "api3") return provider3.getNegara();
  return fetchApi(server, "negara.php");
}

export async function getOperator(server: ServerId, negara: number) {
  if (server === "unified") throw new Error("Use unified-provider for unified server");
  if (server === "api3") return provider3.getOperator(negara);
  return fetchApi(server, "operator.php", { negara: String(negara) });
}

export async function getLayanan(server: ServerId, negara: number) {
  if (server === "unified") throw new Error("Use unified-provider for unified server");
  if (server === "api3") return provider3.getLayanan(negara);
  return fetchApi(server, "layanan.php", { negara: String(negara) });
}

export async function createOrder(
  server: ServerId,
  negara: number,
  layanan: string,
  operator: string
) {
  if (server === "unified") throw new Error("Use unified-provider for unified server");
  if (server === "api3") return provider3.createOrder(negara, layanan, operator);
  return fetchApi(server, "order.php", {
    api_key: API_KEY,
    negara: String(negara),
    layanan,
    operator,
  }, { skipRetry: true, skipCache: true });
}

export async function checkSms(server: ServerId, orderId: number) {
  if (server === "unified") throw new Error("Use unified-provider for unified server");
  if (server === "api3") return provider3.checkSms(orderId);
  return fetchApi(server, "sms.php", {
    api_key: API_KEY,
    id: String(orderId),
  }, { skipRetry: true, skipCache: true });
}

export async function cancelOrder(server: ServerId, orderId: number) {
  if (server === "unified") throw new Error("Use unified-provider for unified server");
  if (server === "api3") return provider3.cancelOrder(orderId);
  return fetchApi(server, "cancel.php", {
    api_key: API_KEY,
    id: String(orderId),
  }, { skipRetry: true, skipCache: true });
}
