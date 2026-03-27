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
): Promise<number> {
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
    // + suffix dari 2 digit terakhir harga asli (capped 1-50) supaya harga terlihat natural
    let tiered: number;
    if (basePrice > 10_000) tiered = Math.ceil(basePrice * 0.6);
    else if (basePrice >= 5_000) tiered = 5_000;
    else if (basePrice >= 2_500) tiered = 2_500;
    else if (basePrice >= 2_000) tiered = 2_000;
    else if (basePrice >= 1_000) tiered = 1_000;
    else if (basePrice >= 500) tiered = 500;
    else return basePrice;

    // Ambil 2 digit terakhir harga asli
    const suffix = basePrice % 100;
    return tiered + suffix;
  }

  switch (rule.priceType) {
    case "fixed":
      return rule.value;
    case "multiply":
      // value is percentage, e.g. 150 = 1.5x
      return Math.ceil((basePrice * rule.value) / 100);
    case "markup":
      return basePrice + rule.value;
    case "floor":
      // Bulatkan ke bawah ke kelipatan value. Misal value=500:
      // 499 → 499 (di bawah step, biarin), 500 → 500, 750 → 500, 1200 → 1000
      if (basePrice < rule.value) return basePrice;
      return Math.floor(basePrice / rule.value) * rule.value;
    default:
      return basePrice;
  }
}

/** Invalidate cache (call after admin updates rules) */
export function invalidatePriceCache() {
  cachedRules = null;
}
