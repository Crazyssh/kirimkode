import * as provider3 from "@/lib/provider3";
import * as provider4 from "@/lib/provider4";
import * as provider5 from "@/lib/provider5";
import * as provider6 from "@/lib/provider6";
import * as provider7 from "@/lib/provider7";
import * as provider8 from "@/lib/provider8";
import * as provider9 from "@/lib/provider9";
import * as provider10 from "@/lib/provider10";

const API_URLS = {
  api1: process.env.JASAOTP_API1_URL || "https://api.jasaotp.id/v1",
  api2: process.env.JASAOTP_API2_URL || "https://api.jasaotp.id/v2",
};

const API_KEY = process.env.JASAOTP_API_KEY || "";

export type ServerId = "api1" | "api2" | "api3" | "api4" | "api5" | "api6" | "api7" | "api8" | "api9" | "api10" | "unified";

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
  options?: { skipRetry?: boolean; skipCache?: boolean; noTimeout?: boolean }
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
    // noTimeout: nunggu sampai server respon (untuk bulk order)
    // skipCache (order/sms): 20s, read endpoints: 15s
    // noTimeout (bulk order): batas atas 90s — jangan unlimited (cegah request
    // gantung saat worker recycle = saldo kepotong tapi order gak tercatat).
    let timeout: ReturnType<typeof setTimeout> | null = null;
    if (options?.noTimeout) {
      timeout = setTimeout(() => controller.abort(), 90000);
    } else {
      const timeoutMs = options?.skipCache ? 20000 : 15000;
      timeout = setTimeout(() => controller.abort(), timeoutMs);
    }

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
      if (timeout) clearTimeout(timeout);
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
  if (server === "api4") return provider4.getBalance();
  if (server === "api5") return provider5.getBalance();
  if (server === "api6") return provider6.getBalance();
  if (server === "api7") return provider7.getBalance();
  if (server === "api8") return provider8.getBalance();
  if (server === "api9") return provider9.getBalance();
  if (server === "api10") return provider10.getBalance();
  return fetchApi(server, "balance.php", { api_key: API_KEY });
}

export async function getNegara(server: ServerId) {
  if (server === "unified") throw new Error("Use unified-provider for unified server");
  if (server === "api3") return provider3.getNegara();
  if (server === "api4") return provider4.getNegara();
  if (server === "api5") return provider5.getNegara();
  if (server === "api6") return provider6.getNegara();
  if (server === "api7") return provider7.getNegara();
  if (server === "api8") return provider8.getNegara();
  if (server === "api9") return provider9.getNegara();
  if (server === "api10") return provider10.getNegara();
  return fetchApi(server, "negara.php");
}

export async function getOperator(server: ServerId, negara: number) {
  if (server === "unified") throw new Error("Use unified-provider for unified server");
  if (server === "api3") return provider3.getOperator(negara);
  if (server === "api4") return provider4.getOperator(negara);
  if (server === "api5") return provider5.getOperator(negara);
  if (server === "api6") return provider6.getOperator(negara);
  if (server === "api7") return provider7.getOperator(negara);
  if (server === "api8") return provider8.getOperator(negara);
  if (server === "api9") return provider9.getOperator(negara);
  if (server === "api10") return provider10.getOperator(negara);
  return fetchApi(server, "operator.php", { negara: String(negara) });
}

export async function getLayanan(server: ServerId, negara: number) {
  if (server === "unified") throw new Error("Use unified-provider for unified server");
  if (server === "api3") return provider3.getLayanan(negara);
  if (server === "api4") return provider4.getLayanan(negara);
  if (server === "api5") return provider5.getLayanan(negara);
  if (server === "api6") return provider6.getLayanan(negara);
  if (server === "api7") return provider7.getLayanan(negara);
  if (server === "api8") return provider8.getLayanan(negara);
  if (server === "api9") return provider9.getLayanan(negara);
  if (server === "api10") return provider10.getLayanan(negara);
  return fetchApi(server, "layanan.php", { negara: String(negara) });
}

export async function createOrder(
  server: ServerId,
  negara: number,
  layanan: string,
  operator: string,
  opts?: { noTimeout?: boolean; maxPriceUsd?: number | null; fixedPrice?: boolean }
) {
  if (server === "unified") throw new Error("Use unified-provider for unified server");
  if (server === "api3") return provider3.createOrder(negara, layanan, operator);
  if (server === "api4") {
    // api4 layanan code bisa composite "wa#abc" — strip suffix sebelum panggil HeroSMS
    const realCode = layanan.split("#")[0];
    return provider4.createOrder(negara, realCode, operator, {
      maxPriceUsd: opts?.maxPriceUsd ?? null,
      fixedPrice: opts?.fixedPrice ?? true,
    });
  }
  if (server === "api5") return provider5.createOrder(negara, layanan, operator);
  if (server === "api6") return provider6.createOrder(negara, layanan, operator);
  if (server === "api7") return provider7.createOrder(negara, layanan, operator);
  if (server === "api8") return provider8.createOrder(negara, layanan, operator);
  if (server === "api9") return provider9.createOrder(negara, layanan, operator);
  if (server === "api10") return provider10.createOrder(negara, layanan, operator);
  return fetchApi(server, "order.php", {
    api_key: API_KEY,
    negara: String(negara),
    layanan,
    operator,
  }, { skipRetry: true, skipCache: true, noTimeout: opts?.noTimeout });
}

export async function checkSms(server: ServerId, orderId: number) {
  if (server === "unified") throw new Error("Use unified-provider for unified server");
  if (server === "api3") return provider3.checkSms(orderId);
  if (server === "api4") return provider4.checkSms(orderId);
  if (server === "api5") return provider5.checkSms(orderId);
  if (server === "api6") return provider6.checkSms(orderId);
  if (server === "api7") return provider7.checkSms(orderId);
  if (server === "api8") return provider8.checkSms(orderId);
  if (server === "api9") return provider9.checkSms(orderId);
  if (server === "api10") return provider10.checkSms(orderId);
  return fetchApi(server, "sms.php", {
    api_key: API_KEY,
    id: String(orderId),
  }, { skipRetry: true, skipCache: true });
}

/**
 * Request SMS resend — saat ini cuma support api4 (Neptune/HeroSMS V2).
 * Throws "RESEND_NOT_SUPPORTED" untuk server lain.
 */
export async function requestRetry(server: ServerId, orderId: number) {
  if (server === "api4") return provider4.requestRetry(orderId);
  throw new Error("RESEND_NOT_SUPPORTED");
}

export async function cancelOrder(server: ServerId, orderId: number) {
  if (server === "unified") throw new Error("Use unified-provider for unified server");
  if (server === "api3") return provider3.cancelOrder(orderId);
  if (server === "api4") return provider4.cancelOrder(orderId);
  if (server === "api5") return provider5.cancelOrder(orderId);
  if (server === "api6") return provider6.cancelOrder(orderId);
  if (server === "api7") return provider7.cancelOrder(orderId);
  if (server === "api8") return provider8.cancelOrder(orderId);
  if (server === "api9") return provider9.cancelOrder(orderId);
  if (server === "api10") return provider10.cancelOrder(orderId);
  return fetchApi(server, "cancel.php", {
    api_key: API_KEY,
    id: String(orderId),
  }, { skipRetry: true, skipCache: true });
}
