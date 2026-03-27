/**
 * Shadow Provider Adapter
 * Integrates ShadowOTP (shadowotp.com) — 3 internal servers.
 * API format: SMS-Activate style, responses in JSON.
 * Currency: PKR → IDR conversion with markup.
 */

import { db } from "@/lib/db";

const BASE_URL =
  process.env.SHADOW_API_URL || "https://shadowotp.com/stubs/handler_api.php";

// Read API key at runtime (not module-level const) to ensure .env is loaded
function getApiKey(): string {
  return process.env.SHADOW_API_KEY || "";
}

// Markup 35% di atas harga provider
const PRICE_MARKUP = 1.35;

// Map internal serverId → ShadowOTP server number
const SERVER_MAP: Record<string, number> = {
  shadow1: 1,
  shadow2: 2,
  shadow3: 3,
};

export type ShadowServerId = "shadow1" | "shadow2" | "shadow3";

/**
 * Convert string country slug to stable numeric ID for DB (externalId is Int).
 * Uses simple hash to produce consistent integer per string.
 */
function stringToNumericId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Bidirectional mapping: slug ↔ numericId (cached per session)
const slugToId = new Map<string, number>();
const idToSlug = new Map<number, string>();

function getNumericId(slug: string): number {
  const existing = slugToId.get(slug);
  if (existing !== undefined) return existing;
  const id = stringToNumericId(slug);
  slugToId.set(slug, id);
  idToSlug.set(id, slug);
  return id;
}

function getSlugFromId(numericId: number): string | undefined {
  return idToSlug.get(numericId);
}

/**
 * Recover slug from DB when in-memory map is empty (e.g. after restart).
 * Country name stored during sync IS the slug.
 */
async function recoverSlugFromDb(numericId: number, serverId: ShadowServerId): Promise<string | undefined> {
  // Check in-memory first
  const cached = getSlugFromId(numericId);
  if (cached) return cached;

  // Query DB — country name is the slug
  try {
    const country = await db.providerCountry.findUnique({
      where: {
        serverId_externalId: {
          serverId: serverId,
          externalId: numericId,
        },
      },
      select: { name: true },
    });

    if (country?.name) {
      // Re-populate in-memory map
      slugToId.set(country.name, numericId);
      idToSlug.set(numericId, country.name);
      return country.name;
    }
  } catch (err) {
    console.warn("[Shadow] DB slug recovery failed:", (err as Error).message);
  }

  return undefined;
}

/**
 * Parse price from ShadowOTP service string like "discord - 5.68 PKR"
 */
function parsePriceFromString(value: string): number | null {
  const match = value.match(/([\d.]+)\s*PKR/);
  if (match) return parseFloat(match[1]);
  return null;
}

// --- PKR → IDR auto-conversion ---

let cachedPkrRate: number | null = null;
let pkrRateCacheTime = 0;
const PKR_RATE_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 jam
let pendingRateFetch: Promise<number> | null = null;

// Fallback: 1 PKR ≈ 57 IDR (rough estimate)
const FALLBACK_PKR_RATE = 57;

async function getPkrToIdr(): Promise<number> {
  const now = Date.now();
  if (cachedPkrRate && now - pkrRateCacheTime < PKR_RATE_CACHE_TTL) {
    return cachedPkrRate;
  }

  if (pendingRateFetch) return pendingRateFetch;

  pendingRateFetch = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch("https://open.er-api.com/v6/latest/PKR", {
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      const rate = data?.rates?.IDR;

      if (typeof rate === "number" && rate > 0) {
        cachedPkrRate = rate;
        pkrRateCacheTime = now;
        console.log(`[Shadow] PKR/IDR rate updated: ${rate}`);
        return rate;
      }
    } catch (err) {
      console.warn("[Shadow] Failed to fetch PKR rate, using fallback:", (err as Error).message);
    } finally {
      pendingRateFetch = null;
    }

    return cachedPkrRate || FALLBACK_PKR_RATE;
  })();

  return pendingRateFetch;
}

async function convertToIdr(pkrPrice: number): Promise<number> {
  const rate = await getPkrToIdr();
  return Math.ceil(pkrPrice * rate * PRICE_MARKUP);
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

/**
 * Get correct country parameter for API call.
 * Shadow1 (server 1): uses slug strings (e.g. "russia", "indonesia")
 * Shadow2/3 (servers 2,3): use numeric IDs (e.g. 6, 0)
 */
async function getCountryParam(serverId: ShadowServerId, negara: number): Promise<string> {
  if (serverId === "shadow1") {
    // Shadow1 uses slug — recover from DB or in-memory map
    const slug = await recoverSlugFromDb(negara, serverId);
    return slug || String(negara);
  }
  // Shadow2/3 use numeric IDs directly
  return String(negara);
}

// --- Fetch helper ---

async function fetchShadow(
  params: Record<string, string>,
  options?: { skipCache?: boolean }
): Promise<unknown> {
  const url = new URL(BASE_URL);
  params.api_key = getApiKey();
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const urlStr = url.toString();

  if (!options?.skipCache) {
    const cached = getCached(urlStr);
    if (cached) return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(urlStr, {
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await res.text();

    // ShadowOTP returns JSON for most endpoints
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      // Some endpoints return plain text (ACCESS_NUMBER:id:phone, STATUS_OK:code, etc.)
      data = text;
    }

    // Check for error responses
    if (typeof data === "string") {
      if (
        data.startsWith("BAD_KEY") ||
        data.startsWith("ERROR_SQL") ||
        data.startsWith("NO_KEY") ||
        data.startsWith("BAD_ACTION")
      ) {
        throw new Error(data);
      }
    }

    if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      // ShadowOTP returns status as string: "200" = ok, "401" = bad key, "404" = not found, "error" = error
      const status = String(d.status || "");
      if (status === "error" || status === "401" || status === "404" || d.error) {
        throw new Error(String(d.message || d.error || `API error (status: ${status})`));
      }
    }

    if (!options?.skipCache) {
      const ttl = params.action?.includes("Countries") ? 1800000 : 180000;
      setCache(urlStr, data, ttl);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Service names cache ---

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
    // Try to get service list from server 1 (most complete catalog)
    const data = await fetchShadow({ action: "getServices", country: "0", server: "1" });

    if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      // Format varies: could be { services: [...] } or { "code": { name, price, stock } }
      if (d.services && Array.isArray(d.services)) {
        for (const svc of d.services as Array<{ code?: string; name?: string }>) {
          if (svc.code && svc.name) names[svc.code] = svc.name;
        }
      } else {
        for (const [code, info] of Object.entries(d)) {
          if (code === "status" || code === "error") continue;
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

/**
 * Get balance
 */
export async function getBalance() {
  const data = await fetchShadow(
    { action: "getBalance" },
    { skipCache: true }
  );

  // JSON response: { status: "200", balance: 1500.00, currency: "PKR" }
  if (data && typeof data === "object") {
    const d = data as { balance?: number; currency?: string };
    if (typeof d.balance === "number") {
      return { balance: d.balance, currency: d.currency || "PKR" };
    }
  }

  // Plain text fallback: ACCESS_BALANCE:150.50
  if (typeof data === "string" && data.startsWith("ACCESS_BALANCE:")) {
    const amount = parseFloat(data.split(":")[1]);
    return { balance: amount };
  }

  throw new Error(String(data));
}

/**
 * Get countries for a specific ShadowOTP server
 * Server 1: {"id":"afghanistan","name":"AFGHANISTAN"} — string slug IDs
 * Server 2/3: {"id":"74","name":"Afghanistan"} — numeric string IDs (SMS-Activate standard)
 */
export async function getNegara(serverId: ShadowServerId) {
  const serverNum = SERVER_MAP[serverId];
  const data = await fetchShadow({
    action: "getCountries",
    server: String(serverNum),
  });

  const countries: Array<{ id_negara: number; nama_negara: string }> = [];

  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;

    const countriesWrapper = d.countries as Record<string, unknown> | undefined;
    if (countriesWrapper) {
      const countryArray = countriesWrapper[String(serverNum)];
      if (Array.isArray(countryArray)) {
        for (const c of countryArray) {
          if (c && typeof c === "object" && "id" in c && "name" in c) {
            const rawId = String(c.id);
            const name = String(c.name);

            // Auto-detect: numeric string → use directly, slug → hash
            const isNumeric = /^\d+$/.test(rawId);
            const numericId = isNumeric ? parseInt(rawId, 10) : getNumericId(rawId);

            // Store slug/id mapping for reverse lookup
            slugToId.set(rawId, numericId);
            idToSlug.set(numericId, rawId);

            countries.push({
              id_negara: numericId,
              nama_negara: name.toLowerCase(),
            });
          }
        }
      }
    }
  }

  countries.sort((a, b) => a.nama_negara.localeCompare(b.nama_negara));

  return { success: true, data: countries };
}

/**
 * Get services for a country on a specific server
 * API response: {"status":"200","services":{"discord":"discord - 5.68 PKR", ...}}
 * Country param uses slug string, not numeric ID.
 */
export async function getLayanan(serverId: ShadowServerId, negara: number) {
  const serverNum = SERVER_MAP[serverId];

  // Shadow1 uses slug strings (e.g. "russia"), shadow2/3 use numeric IDs (e.g. 6)
  const countryParam = await getCountryParam(serverId, negara);

  const data = await fetchShadow({
    action: "getServices",
    country: countryParam,
    server: String(serverNum),
  });

  const negaraKey = String(negara);
  const result: Record<
    string,
    Record<string, { harga: number; stok: number; layanan: string }>
  > = {};
  result[negaraKey] = {};

  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;

    // Format: { status: "200", services: { "code": "name - price PKR", ... } }
    const services = d.services as Record<string, string> | undefined;
    if (services && typeof services === "object") {
      for (const [code, value] of Object.entries(services)) {
        if (typeof value !== "string") continue;

        const price = parsePriceFromString(value);
        if (price !== null) {
          const priceIdr = await convertToIdr(price);
          // Extract display name from "discord - 5.68 PKR" → "discord"
          const displayName = value.split(" - ")[0]?.trim() || code;
          result[negaraKey][code] = {
            harga: priceIdr,
            stok: 100, // ShadowOTP doesn't return stock in this format, assume available
            layanan: displayName,
          };
        }
      }
    }
  }

  return result;
}

/**
 * Get operators (ShadowOTP doesn't support operator selection)
 */
export async function getOperator(negara: number) {
  const negaraKey = String(negara);
  return { data: { [negaraKey]: ["any"] } };
}

/**
 * Create order — buy a number
 */
export async function createOrder(
  serverId: ShadowServerId,
  negara: number,
  layanan: string,
  operator: string
) {
  const serverNum = SERVER_MAP[serverId];

  // Shadow1 uses slug strings (e.g. "russia"), shadow2/3 use numeric IDs (e.g. 6)
  const countryParam = await getCountryParam(serverId, negara);

  const params: Record<string, string> = {
    action: "getNumber",
    service: layanan,
    country: countryParam,
    server: String(serverNum),
  };

  if (operator && operator !== "any") {
    params.operator = operator;
  }

  const data = await fetchShadow(params, { skipCache: true });

  // Plain text response: ACCESS_NUMBER:<id>:<phone>
  if (typeof data === "string" && data.startsWith("ACCESS_NUMBER:")) {
    const parts = data.split(":");
    const orderId = parseInt(parts[1], 10);
    let number = parts[2];

    if (!orderId || !number) {
      throw new Error("Invalid order response format");
    }

    if (!number.startsWith("+")) {
      number = "+" + number;
    }

    return { order_id: orderId, number };
  }

  // JSON response: { status: "200", activationId: 123, phoneNumber: "..." }
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    const orderId = d.activationId ?? d.activation_id ?? d.id ?? d.order_id;
    let number = String(d.phoneNumber ?? d.phone ?? d.number ?? "");

    if (orderId && number) {
      if (!number.startsWith("+")) number = "+" + number;
      return { order_id: Number(orderId), number };
    }
  }

  // Error handling
  const errStr = typeof data === "string" ? data : JSON.stringify(data);
  if (errStr.includes("NO_NUMBERS")) throw new Error("Stok habis untuk layanan ini");
  if (errStr.includes("NO_BALANCE")) throw new Error("Saldo provider tidak cukup");
  if (errStr.includes("WRONG_SERVICE")) throw new Error("Layanan tidak tersedia");
  if (errStr.includes("WRONG_COUNTRY")) throw new Error("Negara tidak tersedia");

  throw new Error(errStr || "Gagal membuat pesanan");
}

/**
 * Check SMS / OTP status
 */
export async function checkSms(orderId: number) {
  const data = await fetchShadow(
    { action: "getStatus", id: String(orderId) },
    { skipCache: true }
  );

  // Plain text responses
  if (typeof data === "string") {
    if (data.startsWith("STATUS_OK:")) {
      const code = data.substring("STATUS_OK:".length);
      return { otp: code, status: "success" };
    }
    if (data === "STATUS_WAIT_CODE" || data === "STATUS_WAIT_RETRY") {
      return { otp: null, status: "waiting" };
    }
    if (data === "STATUS_CANCEL") {
      return { otp: null, status: "cancelled" };
    }
    return { otp: null, status: data };
  }

  // JSON response
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (d.sms || d.code || d.otp) {
      return { otp: String(d.sms ?? d.code ?? d.otp), status: "success" };
    }
    if (d.status === "waiting" || d.status === "STATUS_WAIT_CODE") {
      return { otp: null, status: "waiting" };
    }
    if (d.status === "cancelled" || d.status === "STATUS_CANCEL") {
      return { otp: null, status: "cancelled" };
    }
  }

  return { otp: null, status: "waiting" };
}

/**
 * Cancel order — setStatus with status=8
 */
export async function cancelOrder(orderId: number) {
  const data = await fetchShadow(
    { action: "setStatus", id: String(orderId), status: "8" },
    { skipCache: true }
  );

  if (typeof data === "string") {
    if (data === "ACCESS_CANCEL" || data === "ACCESS_READY") {
      return { success: true };
    }
  }

  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (d.status === "200" || d.status === "success") {
      return { success: true };
    }
  }

  throw new Error(String(data) || "Gagal membatalkan pesanan");
}
