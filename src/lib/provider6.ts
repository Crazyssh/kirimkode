/**
 * Provider 6 Adapter — Venus 🪐 (5sim.net)
 *
 * 5sim API: https://5sim.net/docs
 * Auth: Authorization: Bearer <API_KEY>
 *
 * Specifics:
 *   - Country pakai slug string ("indonesia") — kita hash ke Int32 stable supaya
 *     fit schema ProviderCountry.externalId Int.
 *   - Prices USD → convert ke IDR pake kurs realtime + markup PRICE_MARKUP.
 *   - Treatment harga: FINAL (skip applyPricing) sama seperti api3.
 *   - Operator selection tidak expose ke UI ("any").
 */

import { getUsdToIdr } from "@/lib/usd-rate";

const BASE_URL = process.env.PROVIDER6_API_URL || "https://5sim.net/v1";
const API_KEY = process.env.PROVIDER6_API_KEY || "";

// Markup 1.20 (20%) di atas harga 5sim → net ~12% setelah fee top-up & PG
export const PRICE_MARKUP = 1.20;

export async function getKurs(): Promise<number> {
  return getUsdToIdr();
}

async function convertToIdr(usdPrice: number): Promise<number> {
  const rate = await getUsdToIdr();
  return Math.ceil(usdPrice * rate * PRICE_MARKUP);
}

// --- Slug ↔ ID stable mapping ---
//
// 5sim country = slug string ("indonesia"), schema kita = Int.
// Pake FNV-1a hash 32-bit, masuk ke positive Int31 (≤ 2147483647).
// Collision risk untuk ~150 country slug = effectively zero.

function slugToId(slug: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash & 0x7FFFFFFF;
}

// Cache reverse mapping (id → slug) supaya createOrder/getLayanan bisa kirim slug
// ke 5sim. Di-populate setiap kali getNegara() dipanggil.
const idToSlugCache = new Map<number, string>();

// --- Cache (in-memory, sama pattern dengan provider lain) ---

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

// --- HTTP helper ---

interface FetchOptions {
  query?: Record<string, string>;
  skipCache?: boolean;
  ttlMs?: number;
  needAuth?: boolean;
}

async function fetchProvider(path: string, options: FetchOptions = {}): Promise<unknown> {
  const { query, skipCache = false, ttlMs, needAuth = false } = options;

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
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (needAuth) {
      headers.Authorization = `Bearer ${API_KEY}`;
    }

    const res = await fetch(urlStr, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        // 5sim sometimes returns plain text "no free phones" untuk error
        data = { error: text.trim() };
      }
    }

    if (!res.ok) {
      const obj = (data || {}) as { error?: string; message?: string };
      const msg = obj.error || obj.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    if (!skipCache) {
      setCache(urlStr, data, ttlMs ?? 180000);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Public API ---

/**
 * GET /v1/user/profile — return balance (asumsi USD).
 * Response: { id, email, balance, ... }
 */
export async function getBalance() {
  const raw = (await fetchProvider("/user/profile", {
    skipCache: true,
    needAuth: true,
  })) as { balance?: number };

  const balance = typeof raw?.balance === "number" ? raw.balance : 0;
  return { balance };
}

/**
 * GET /v1/guest/countries — list semua country.
 * Response: { "indonesia": { iso: {...}, text_en: "Indonesia", ... }, ... }
 *
 * Output format internal: { success: true, data: [{ id_negara, nama_negara }] }
 *   - id_negara = hash(slug) Int31
 *   - nama_negara = slug (lowercase) — supaya konsisten dengan provider lain
 */
export async function getNegara() {
  const raw = (await fetchProvider("/guest/countries", { ttlMs: 1800000 })) as Record<string, { text_en?: string }>;

  const countries: Array<{ id_negara: number; nama_negara: string }> = [];

  if (raw && typeof raw === "object") {
    for (const [slug, info] of Object.entries(raw)) {
      if (typeof slug !== "string" || !slug) continue;
      // Skip non-country keys (defensive — should not happen)
      if (slug.startsWith("_")) continue;
      const id = slugToId(slug);
      idToSlugCache.set(id, slug);
      countries.push({
        id_negara: id,
        nama_negara: slug, // simpan slug supaya bisa dipake ke API call berikutnya
      });
      // text_en tersedia kalau mau pretty-print di UI nanti
      void info;
    }
  }

  countries.sort((a, b) => a.nama_negara.localeCompare(b.nama_negara));
  return { success: true, data: countries };
}

/**
 * Resolve int id ke slug. Coba cache dulu, kalau miss panggil getNegara() ulang.
 */
async function resolveSlug(negara: number): Promise<string | null> {
  const slug = idToSlugCache.get(negara);
  if (slug) return slug;

  // Cache miss — re-populate via getNegara
  await getNegara();
  return idToSlugCache.get(negara) || null;
}

/**
 * Cache global semua prices dari 5sim — di-fetch sekali, dipake oleh
 * semua getLayanan(country) calls dalam window cache.
 *
 * Endpoint /v1/guest/prices (tanpa filter) return SEMUA country in one shot.
 * Jauh lebih cepat dari fetch per-country (1 call vs 150+ calls).
 */
type PricesByCountry = Record<
  string,
  Record<string, Record<string, { cost?: number; count?: number; rate?: number }>>
>;

let globalPricesCache: PricesByCountry | null = null;
let globalPricesCacheTime = 0;
const GLOBAL_PRICES_TTL = 180000; // 3 menit
let pendingGlobalFetch: Promise<PricesByCountry> | null = null;

async function getAllPrices(): Promise<PricesByCountry> {
  const now = Date.now();
  if (globalPricesCache && now - globalPricesCacheTime < GLOBAL_PRICES_TTL) {
    return globalPricesCache;
  }
  if (pendingGlobalFetch) return pendingGlobalFetch;

  pendingGlobalFetch = (async () => {
    try {
      // Fetch tanpa filter — return semua country. Pake skipCache supaya cache
      // global ini yang dipake, bukan per-URL cache.
      const raw = (await fetchProvider("/guest/prices", {
        skipCache: true,
        ttlMs: GLOBAL_PRICES_TTL,
      })) as PricesByCountry;

      if (raw && typeof raw === "object") {
        globalPricesCache = raw;
        globalPricesCacheTime = now;
        console.log(`[Provider6] Global prices cached: ${Object.keys(raw).length} countries`);
        return raw;
      }
    } catch (err) {
      console.warn("[Provider6] Failed to fetch global prices:", (err as Error).message);
    } finally {
      pendingGlobalFetch = null;
    }
    return globalPricesCache || {};
  })();

  return pendingGlobalFetch;
}

/**
 * GET prices untuk satu country — ambil dari cache global.
 *
 * Untuk tiap product, return SETIAP operator sebagai entry terpisah (composite
 * code "<product>#<operator>") supaya user bisa pilih operator yang berbeda
 * dengan harga & stok masing-masing. Mirip pattern Neptune (api4).
 *
 * Convert USD cost → IDR + markup.
 *
 * Output: { "<negaraId>": { "<code>#<operator>": { harga, stok, layanan } } }
 */
export async function getLayanan(negara: number) {
  const slug = await resolveSlug(negara);
  const negaraKey = String(negara);
  if (!slug) {
    return { [negaraKey]: {} };
  }

  // Ambil dari cache global (1 fetch untuk semua country)
  const allPrices = await getAllPrices();
  const countryBlock = allPrices[slug];

  const result: Record<string, { harga: number; stok: number; layanan: string }> = {};

  if (countryBlock && typeof countryBlock === "object") {
    for (const [productCode, operatorBlock] of Object.entries(countryBlock)) {
      if (!operatorBlock || typeof operatorBlock !== "object") continue;

      const productDisplay = productCode.charAt(0).toUpperCase() + productCode.slice(1);

      // List operator yang qualified.
      // 5sim docs: rate "omitted less than 20% or too few orders" — kalau rate ada,
      // artinya 5sim sudah validasi kualitas operator. Kita pakai rate sebagai
      // gate: hanya operator dengan rate > 0 (sudah qualified) DAN ada stok.
      const operators: Array<{ name: string; cost: number; count: number; rate: number }> = [];
      for (const [opName, opData] of Object.entries(operatorBlock)) {
        const cost = typeof opData?.cost === "number" ? opData.cost : null;
        const count = typeof opData?.count === "number" ? opData.count : 0;
        const rate = typeof opData?.rate === "number" ? opData.rate : 0;
        if (cost === null || cost <= 0) continue;
        if (count <= 0) continue; // skip stok kosong
        if (rate <= 0) continue; // skip operator yang belum qualified 5sim
        operators.push({ name: opName, cost, count, rate });
      }

      if (operators.length === 0) {
        // Fallback: kalau semua operator gak qualify (rate 0), tampilkan top-1
        // dengan stok terbanyak supaya product tetap visible (rate "tidak diketahui").
        const fallback: Array<{ name: string; cost: number; count: number; rate: number }> = [];
        for (const [opName, opData] of Object.entries(operatorBlock)) {
          const cost = typeof opData?.cost === "number" ? opData.cost : null;
          const count = typeof opData?.count === "number" ? opData.count : 0;
          if (cost === null || cost <= 0) continue;
          if (count <= 0) continue;
          fallback.push({ name: opName, cost, count, rate: 0 });
        }
        if (fallback.length === 0) continue;
        fallback.sort((a, b) => b.count - a.count);
        const op = fallback[0];
        result[productCode] = {
          harga: await convertToIdr(op.cost),
          stok: op.count,
          layanan: productDisplay,
        };
        continue;
      }

      // Sort: rate desc, stock desc, cost asc
      operators.sort((a, b) => {
        if (b.rate !== a.rate) return b.rate - a.rate;
        if (b.count !== a.count) return b.count - a.count;
        return a.cost - b.cost;
      });

      // Kalau cuma 1 operator qualified, drop suffix
      if (operators.length === 1) {
        const op = operators[0];
        result[productCode] = {
          harga: await convertToIdr(op.cost),
          stok: op.count,
          layanan: `${productDisplay} ${op.rate.toFixed(0)}%`,
        };
        continue;
      }

      // Multi-operator: composite code "<product>#<operator>".
      // Display: "Whatsapp 16%" — nama service + rate sukses.
      for (const op of operators) {
        const code = `${productCode}#${op.name}`;
        result[code] = {
          harga: await convertToIdr(op.cost),
          stok: op.count,
          layanan: `${productDisplay} ${op.rate.toFixed(0)}%`,
        };
      }
    }
  }

  return { [negaraKey]: result };
}

/**
 * Operator — 5sim ada operator selection per country tapi kita default "any".
 * UI tidak expose pilihan operator ke user.
 */
export async function getOperator(negara: number) {
  return { data: { [String(negara)]: ["any"] } };
}

/**
 * GET /v1/user/buy/activation/$country/$operator/$product
 * Response: { id, phone, status, ... }
 *
 * Status awal: "PENDING".
 *
 * Layanan code bisa composite "<product>#<operator>" — kalau ada suffix,
 * pakai operator dari suffix (override default "any").
 */
export async function createOrder(negara: number, layanan: string, operator: string) {
  const slug = await resolveSlug(negara);
  if (!slug) throw new Error("Negara tidak ditemukan di Venus");

  // Parse composite code "<product>#<operator>"
  let product = layanan;
  let resolvedOp = operator && operator !== "any" ? operator : "any";
  const hashIdx = layanan.indexOf("#");
  if (hashIdx > 0) {
    product = layanan.slice(0, hashIdx);
    const opFromCode = layanan.slice(hashIdx + 1);
    if (opFromCode) resolvedOp = opFromCode;
  }

  const raw = (await fetchProvider(`/user/buy/activation/${slug}/${resolvedOp}/${product}`, {
    skipCache: true,
    needAuth: true,
  })) as { id?: number; phone?: string; status?: string; error?: string };

  if (raw?.error) {
    throw new Error(translateOrderError(raw.error));
  }

  if (!raw?.id || !raw?.phone) {
    throw new Error("Invalid order response from 5sim");
  }

  const orderIdNum = typeof raw.id === "number" ? raw.id : Number(raw.id);
  if (!Number.isFinite(orderIdNum) || orderIdNum <= 0 || orderIdNum > 2_147_483_647) {
    throw new Error(`Invalid orderId from 5sim: ${raw.id}`);
  }

  let number = String(raw.phone);
  if (!number.startsWith("+")) number = "+" + number;

  return { order_id: orderIdNum, number };
}

function translateOrderError(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("no free phones")) return "Stok habis untuk layanan ini";
  if (t.includes("not enough user balance")) return "Saldo provider tidak cukup";
  if (t.includes("not enough rating")) return "Rating provider tidak cukup";
  if (t.includes("bad country")) return "Negara tidak tersedia";
  if (t.includes("bad operator")) return "Operator tidak tersedia";
  if (t.includes("no product")) return "Layanan tidak tersedia";
  if (t.includes("server offline")) return "Provider sedang offline";
  return text;
}

/**
 * GET /v1/user/check/$id — return order + sms.
 *
 * Status mapping:
 *   PENDING  → waiting
 *   RECEIVED → success (kalau sms ada)
 *   FINISHED → success
 *   CANCELED → cancelled
 *   BANNED   → cancelled
 *   TIMEOUT  → timeout
 */
export async function checkSms(orderId: number) {
  let raw: { status?: string; sms?: Array<{ code?: string; text?: string }> };
  try {
    raw = (await fetchProvider(`/user/check/${orderId}`, {
      skipCache: true,
      needAuth: true,
    })) as typeof raw;
  } catch (err) {
    const msg = (err as Error).message || "";
    if (/order not found|404/i.test(msg)) {
      return { otp: null, status: "cancelled" };
    }
    throw err;
  }

  const status = (raw?.status || "").toUpperCase();
  const smsList = Array.isArray(raw?.sms) ? raw!.sms! : [];

  // Ambil code dari SMS terakhir kalau ada
  let code: string | null = null;
  if (smsList.length > 0) {
    // Coba ambil dari field "code" (sudah di-extract 5sim)
    for (let i = smsList.length - 1; i >= 0; i--) {
      const c = smsList[i]?.code;
      if (c && typeof c === "string" && c.trim()) {
        code = c.trim();
        break;
      }
    }
    // Fallback: extract digit dari text kalau code kosong
    if (!code) {
      for (let i = smsList.length - 1; i >= 0; i--) {
        const text = smsList[i]?.text;
        if (text && typeof text === "string") {
          const match = text.match(/\b(\d{4,8})\b/);
          if (match) {
            code = match[1];
            break;
          }
        }
      }
    }
  }

  if (code) return { otp: code, status: "success" };

  if (status === "RECEIVED" || status === "FINISHED") {
    // RECEIVED tanpa code = belum sempat extract, tunggu lagi
    return { otp: null, status: "waiting" };
  }
  if (status === "PENDING") return { otp: null, status: "waiting" };
  if (status === "TIMEOUT") return { otp: null, status: "timeout" };
  if (status === "CANCELED" || status === "BANNED") return { otp: null, status: "cancelled" };

  return { otp: null, status: "waiting" };
}

/**
 * GET /v1/user/cancel/$id
 * Response 200 = sukses cancel.
 * 400 mungkin terjadi kalau order sudah selesai / sudah ada SMS.
 */
export async function cancelOrder(orderId: number) {
  try {
    await fetchProvider(`/user/cancel/${orderId}`, {
      skipCache: true,
      needAuth: true,
    });
    return { success: true };
  } catch (err) {
    const msg = (err as Error).message || "";
    // Kalau order udah selesai/punya SMS, anggap sukses dari sisi user
    if (/order not found|order expired|order has sms|hosting order/i.test(msg)) {
      return { success: true };
    }
    throw err;
  }
}
