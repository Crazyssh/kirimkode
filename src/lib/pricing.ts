import { db } from "@/lib/db";

interface PriceRule {
  serviceCode: string;
  countryId: number;
  priceType: string;
  value: number;
  active: boolean;
}

let cachedRules: PriceRule[] | null = null;
let cacheTime = 0;
let pendingFetch: Promise<PriceRule[]> | null = null;
const CACHE_TTL = 60_000; // 1 minute

async function getRules(): Promise<PriceRule[]> {
  const now = Date.now();
  if (cachedRules && now - cacheTime < CACHE_TTL) {
    return cachedRules;
  }

  // Reuse in-flight fetch to prevent concurrent DB queries
  if (pendingFetch) return pendingFetch;

  pendingFetch = db.priceRule
    .findMany({
      where: { active: true },
      select: { serviceCode: true, countryId: true, priceType: true, value: true, active: true },
    })
    .then((rules) => {
      cachedRules = rules;
      cacheTime = Date.now();
      pendingFetch = null;
      return rules;
    })
    .catch((err) => {
      pendingFetch = null;
      throw err;
    });

  return pendingFetch;
}

/**
 * Apply custom pricing to a base price from provider.
 * Checks specific service+country rule first, then service-only, then global.
 */
export async function applyPricing(
  basePrice: number,
  serviceCode: string,
  countryId: number
): Promise<{ price: number; hasRule: boolean }> {
  const rules = await getRules();

  // Priority: exact match > service-only > global
  const exactMatch = rules.find(
    (r) => r.serviceCode === serviceCode && r.countryId === countryId
  );
  const serviceMatch = rules.find(
    (r) => r.serviceCode === serviceCode && r.countryId === 0
  );
  const globalMatch = rules.find(
    (r) => r.serviceCode === "*" && r.countryId === 0
  );

  const rule = exactMatch || serviceMatch || globalMatch;

  if (!rule) {
    // Default tiered pricing berdasarkan harga provider
    if (basePrice > 10_000) return { price: Math.ceil(basePrice * 0.6), hasRule: false };
    if (basePrice >= 5_000) return { price: 5_000, hasRule: false };
    if (basePrice >= 2_500) return { price: 2_500, hasRule: false };
    if (basePrice >= 2_000) return { price: 2_000, hasRule: false };
    if (basePrice >= 1_000) return { price: 1_000, hasRule: false };
    if (basePrice >= 500) return { price: 500, hasRule: false };
    return { price: basePrice, hasRule: false };
  }

  let price: number;
  switch (rule.priceType) {
    case "fixed":
      price = rule.value;
      break;
    case "multiply":
      // value is percentage, e.g. 150 = 1.5x
      price = Math.ceil((basePrice * rule.value) / 100);
      break;
    case "markup":
      price = basePrice + rule.value;
      break;
    case "floor":
      // Bulatkan ke bawah ke kelipatan value
      if (basePrice < rule.value) { price = basePrice; break; }
      price = Math.floor(basePrice / rule.value) * rule.value;
      break;
    default:
      price = basePrice;
  }
  return { price, hasRule: true };
}

/** Invalidate cache (call after admin updates rules) */
export function invalidatePriceCache() {
  cachedRules = null;
}

/**
 * Flat extra markup per-server (IDR) — diterapkan SETELAH applyPricing.
 * Berguna kalau satu provider (misal Planet) mau di-mark up flat di atas
 * harga server lain (misal Earth) yang share PriceRule.
 */
const SERVER_EXTRA_MARKUP_IDR: Record<string, number> = {
  api8: 115, // Mercury — +Rp 115 di atas harga Earth (api5)
};

export function applyServerExtraMarkup(price: number, serverId: string): number {
  const extra = SERVER_EXTRA_MARKUP_IDR[serverId] || 0;
  return price + extra;
}

/**
 * Timeout nomor (umur max order) per-server, dalam ms.
 * Default 20 menit — provider kasih waktu 20 menit OTP masuk, lewat itu auto-cancel + refund.
 *
 * Override untuk server yang provider-nya lebih ketat:
 *   - api8 (Mercury): 4 menit 30 detik
 */
const SERVER_TIMEOUT_MS: Record<string, number> = {
  api8: 4.5 * 60 * 1000, // Mercury — 4 menit 30 detik
};

export const DEFAULT_ORDER_TIMEOUT_MS = 20 * 60 * 1000; // 20 menit

export function getOrderTimeoutMs(serverId: string): number {
  return SERVER_TIMEOUT_MS[serverId] ?? DEFAULT_ORDER_TIMEOUT_MS;
}

/**
 * Berapa lama (ms) user harus menunggu sebelum tombol "Cancel" aktif setelah order dibuat.
 * Default 3 menit (provider butuh waktu untuk delivery SMS pertama).
 *
 * Override:
 *   - api5 (Earth), api7 (Mars V2), api8 (Mercury): 2 menit 30 detik
 *   - api9 (Uranus): 2 menit
 */
const SERVER_CANCEL_MIN_MS: Record<string, number> = {
  api5: 2.5 * 60 * 1000,
  api7: 2.5 * 60 * 1000,
  api8: 2.5 * 60 * 1000,
  api9: 2 * 60 * 1000,
};

export const DEFAULT_CANCEL_MIN_MS = 3 * 60 * 1000;

export function getCancelMinMs(serverId: string): number {
  return SERVER_CANCEL_MIN_MS[serverId] ?? DEFAULT_CANCEL_MIN_MS;
}
