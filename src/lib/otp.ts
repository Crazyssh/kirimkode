const API_URLS = {
  api1: process.env.JASAOTP_API1_URL || "https://api.jasaotp.id/v1",
  api2: process.env.JASAOTP_API2_URL || "https://api.jasaotp.id/v2",
};

const API_KEY = process.env.JASAOTP_API_KEY || "";

type ServerId = "api1" | "api2";

function getBaseUrl(server: ServerId): string {
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

async function fetchApi(server: ServerId, endpoint: string, params?: Record<string, string>) {
  const base = getBaseUrl(server);
  const url = new URL(`${base}/${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const urlStr = url.toString();

  // Check cache first
  const cached = getCached(urlStr);
  if (cached) return cached;

  // Fetch with timeout dan retry
  const doFetch = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(urlStr, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || data?.error || `API error: ${res.status}`);
      }

      if (data?.success === false || data?.code === "error" || data?.status === "error") {
        throw new Error(data?.message || data?.error || "Gagal memproses request ke provider");
      }

      return data;
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    const data = await doFetch();
    // Cache: 60s for layanan/operator, 5min for negara
    const ttl = endpoint.includes("negara") ? 300000 : 60000;
    setCache(urlStr, data, ttl);
    return data;
  } catch (err) {
    // Retry 1x
    console.warn(`[OTP API] First attempt failed for ${endpoint}, retrying...`, (err as Error).message);
    try {
      const data = await doFetch();
      const ttl = endpoint.includes("negara") ? 300000 : 60000;
      setCache(urlStr, data, ttl);
      return data;
    } catch (retryErr) {
      console.error(`[OTP API] Retry also failed for ${endpoint}:`, (retryErr as Error).message);
      throw retryErr;
    }
  }
}

export async function getBalance(server: ServerId) {
  return fetchApi(server, "balance.php", { api_key: API_KEY });
}

export async function getNegara(server: ServerId) {
  return fetchApi(server, "negara.php");
}

export async function getOperator(server: ServerId, negara: number) {
  return fetchApi(server, "operator.php", { negara: String(negara) });
}

export async function getLayanan(server: ServerId, negara: number) {
  return fetchApi(server, "layanan.php", { negara: String(negara) });
}

export async function createOrder(
  server: ServerId,
  negara: number,
  layanan: string,
  operator: string
) {
  return fetchApi(server, "order.php", {
    api_key: API_KEY,
    negara: String(negara),
    layanan,
    operator,
  });
}

export async function checkSms(server: ServerId, orderId: number) {
  return fetchApi(server, "sms.php", {
    api_key: API_KEY,
    id: String(orderId),
  });
}

export async function cancelOrder(server: ServerId, orderId: number) {
  return fetchApi(server, "cancel.php", {
    api_key: API_KEY,
    id: String(orderId),
  });
}
