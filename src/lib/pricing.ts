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
const CACHE_TTL = 60_000; // 1 minute

async function getRules(): Promise<PriceRule[]> {
  const now = Date.now();
  if (cachedRules && now - cacheTime < CACHE_TTL) {
    return cachedRules;
  }

  cachedRules = await db.priceRule.findMany({
    where: { active: true },
    select: { serviceCode: true, countryId: true, priceType: true, value: true, active: true },
  });
  cacheTime = now;
  return cachedRules;
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

  if (!rule) return basePrice;

  switch (rule.priceType) {
    case "fixed":
      return rule.value;
    case "multiply":
      // value is percentage, e.g. 150 = 1.5x
      return Math.ceil((basePrice * rule.value) / 100);
    case "markup":
      return basePrice + rule.value;
    default:
      return basePrice;
  }
}

/** Invalidate cache (call after admin updates rules) */
export function invalidatePriceCache() {
  cachedRules = null;
}
