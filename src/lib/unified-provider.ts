/**
 * Unified Provider — "Bimasakti" ⚡
 * Query DB untuk merged negara/layanan dari semua provider (api1, api2, api3).
 * User pilih layanan → lihat opsi per-provider → pilih provider → order langsung.
 */

import { db } from "@/lib/db";
import { applyPricing } from "@/lib/pricing";

const ACTIVE_PROVIDERS = ["api1", "api2", "api3"];

// Server display names
const SERVER_NAMES: Record<string, { name: string; icon: string }> = {
  api1: { name: "Mars", icon: "🔴" },
  api2: { name: "Jupiter", icon: "🟠" },
  api3: { name: "Saturn", icon: "🟣" },
};

// ---------- Types ----------

interface CountryMapping {
  serverId: string;
  externalId: number;
  dbCountryId: string;
}

// ---------- Cache ----------

const cache = new Map<string, { data: unknown; expiry: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data as T;
  if (entry) cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
  if (cache.size > 300) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

/** Clear all unified cache — called after sync to ensure fresh data */
export function clearUnifiedCache() {
  cache.clear();
}

// ---------- Negara (merged) ----------

/**
 * Get merged negara list from DB.
 * Deduplicate by country name, assign virtual IDs.
 * Juga simpan mapping ke provider asli.
 */
export async function getUnifiedNegara(): Promise<{
  success: boolean;
  data: Array<{ id_negara: number; nama_negara: string }>;
}> {
  const cacheKey = "unified:negara";
  const cached = getCached<{ success: boolean; data: Array<{ id_negara: number; nama_negara: string }> }>(cacheKey);
  if (cached) return cached;

  const allCountries = await db.providerCountry.findMany({
    where: { serverId: { in: ACTIVE_PROVIDERS } },
    select: { id: true, externalId: true, name: true, normalizedName: true, serverId: true },
    orderBy: { normalizedName: "asc" },
  });

  // Deduplicate by normalizedName (our standardized English name)
  const seen = new Map<string, string>(); // normalizedName → display name
  const result: Array<{ id_negara: number; nama_negara: string }> = [];

  for (const c of allCountries) {
    const key = (c.normalizedName || c.name).trim();
    if (!seen.has(key)) {
      seen.set(key, key);
      result.push({ id_negara: result.length, nama_negara: key });
    }
  }

  const response = { success: true, data: result };
  setCache(cacheKey, response, 600000); // 10 min
  return response;
}

/**
 * Find all provider country mappings for a unified virtual negara ID.
 */
export async function getCountryMappings(unifiedNegaraId: number): Promise<CountryMapping[]> {
  const cacheKey = `unified:mapping:${unifiedNegaraId}`;
  const cached = getCached<CountryMapping[]>(cacheKey);
  if (cached) return cached;

  // Get country name for this virtual ID
  const negaraRes = await getUnifiedNegara();
  const country = negaraRes.data.find((c) => c.id_negara === unifiedNegaraId);
  if (!country) return [];

  const targetName = country.nama_negara.trim();

  // Find all provider countries with matching normalizedName
  const dbCountries = await db.providerCountry.findMany({
    where: {
      serverId: { in: ACTIVE_PROVIDERS },
      normalizedName: targetName,
    },
    select: { id: true, serverId: true, externalId: true },
  });

  const mappings = dbCountries.map((c) => ({
    serverId: c.serverId,
    externalId: c.externalId,
    dbCountryId: c.id,
  }));

  setCache(cacheKey, mappings, 600000); // 10 min
  return mappings;
}

// ---------- Layanan (merged, grouped by code) ----------

/**
 * Get merged layanan list — grouped by service code.
 * Shows cheapest price + total stock for display.
 */
export async function getUnifiedLayanan(
  unifiedNegaraId: number
): Promise<Record<string, Record<string, { harga: number; stok: number; layanan: string }>>> {
  const cacheKey = `unified:layanan:${unifiedNegaraId}`;
  const cached = getCached<Record<string, Record<string, { harga: number; stok: number; layanan: string }>>>(cacheKey);
  if (cached) return cached;

  const mappings = await getCountryMappings(unifiedNegaraId);
  if (mappings.length === 0) return { [String(unifiedNegaraId)]: {} };

  const dbCountryIds = mappings.map((m) => m.dbCountryId);

  const allServices = await db.providerService.findMany({
    where: {
      countryId: { in: dbCountryIds },
      serverId: { in: ACTIVE_PROVIDERS },
    },
    select: { code: true, name: true, price: true, stock: true, serverId: true },
  });

  // Group by service code
  const serviceMap = new Map<string, { name: string; minPrice: number; totalStock: number }>();

  for (const svc of allServices) {
    // Apply pricing (skip for api3)
    const displayPrice = svc.serverId === "api3"
      ? svc.price
      : await applyPricing(svc.price, svc.code, mappings.find(m => m.serverId === svc.serverId)?.externalId || 0);

    const existing = serviceMap.get(svc.code);
    if (existing) {
      if (displayPrice < existing.minPrice) existing.minPrice = displayPrice;
      existing.totalStock += svc.stock;
    } else {
      serviceMap.set(svc.code, {
        name: svc.name,
        minPrice: displayPrice,
        totalStock: svc.stock,
      });
    }
  }

  const negaraKey = String(unifiedNegaraId);
  const merged: Record<string, { harga: number; stok: number; layanan: string }> = {};

  for (const [code, info] of serviceMap.entries()) {
    merged[code] = {
      harga: info.minPrice,
      stok: info.totalStock,
      layanan: info.name,
    };
  }

  const response = { [negaraKey]: merged };
  setCache(cacheKey, response, 180000); // 3 min
  return response;
}

// ---------- Layanan detail per provider ----------

/**
 * Get all provider options for a specific service code.
 * User clicks "WhatsApp" → sees api1/api2/api3 with prices.
 */
export async function getServiceProviders(
  unifiedNegaraId: number,
  serviceCode: string
): Promise<{
  service: string;
  code: string;
  providers: Array<{
    serverId: string;
    name: string;
    icon: string;
    price: number;
    stock: number;
    negaraId: number; // provider's country ID (for ordering)
  }>;
}> {
  const mappings = await getCountryMappings(unifiedNegaraId);
  if (mappings.length === 0) {
    return { service: serviceCode, code: serviceCode, providers: [] };
  }

  const dbCountryIds = mappings.map((m) => m.dbCountryId);

  const services = await db.providerService.findMany({
    where: {
      code: serviceCode,
      countryId: { in: dbCountryIds },
      serverId: { in: ACTIVE_PROVIDERS },
    },
    select: { serverId: true, name: true, price: true, stock: true, countryId: true },
  });

  const providers: Array<{
    serverId: string;
    name: string;
    icon: string;
    price: number;
    stock: number;
    negaraId: number;
  }> = [];

  for (const svc of services) {

    const mapping = mappings.find((m) => m.dbCountryId === svc.countryId && m.serverId === svc.serverId);
    if (!mapping) continue;

    const displayPrice = svc.serverId === "api3"
      ? svc.price
      : await applyPricing(svc.price, serviceCode, mapping.externalId);

    const serverInfo = SERVER_NAMES[svc.serverId] || { name: svc.serverId, icon: "⚪" };

    providers.push({
      serverId: svc.serverId,
      name: serverInfo.name,
      icon: serverInfo.icon,
      price: displayPrice,
      stock: svc.stock,
      negaraId: mapping.externalId,
    });
  }

  // Sort by price ascending
  providers.sort((a, b) => a.price - b.price);

  const serviceName = services[0]?.name || serviceCode;

  return { service: serviceName, code: serviceCode, providers };
}

// ---------- Operator ----------

export async function getUnifiedOperator(unifiedNegaraId: number) {
  const negaraKey = String(unifiedNegaraId);
  // Unified mode: operator dipilih setelah provider dipilih
  // Untuk sekarang return "any"
  return { data: { [negaraKey]: ["any"] } };
}
