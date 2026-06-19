/**
 * Unified Provider — "Bimasakti" ⚡
 * Query DB untuk merged negara/layanan dari semua provider (api1, api2, api3).
 * User pilih layanan → lihat opsi per-provider → pilih provider → order langsung.
 *
 * NOTE: api4 sengaja TIDAK ikut unified — datanya realtime dari API, bukan dari DB.
 * User pilih api4 (Neptune) sebagai server terpisah di buy page.
 */

import { db } from "@/lib/db";
import { applyPricing, applyServerExtraMarkup, applyErisPricing, applyMercuryPricing } from "@/lib/pricing";
import { getUnifiedProviders } from "@/lib/site-settings";

// Provider yang harganya sudah final (USD→IDR + markup, atau langsung IDR) — skip applyPricing
// api10 (Eris) TIDAK di sini — pakai pricing rule terpisah (applyErisPricing)
const FINAL_PRICE_PROVIDERS = new Set(["api3", "api6", "api9"]);

// Server display names
const SERVER_NAMES: Record<string, { name: string; icon: string }> = {
  api1: { name: "Mars", icon: "🔴" },
  api2: { name: "Jupiter", icon: "🟠" },
  api3: { name: "Saturn", icon: "🟣" },
  api5: { name: "Earth (Beta)", icon: "🌍" },
  api6: { name: "Venus (Beta)", icon: "🪐" },
  api7: { name: "Mars V2", icon: "🔴" },
  api8: { name: "Mercury", icon: "☿️" },
  api9: { name: "Uranus", icon: "🌌" },
  api10: { name: "Eris", icon: "✨" },
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
    where: { serverId: { in: await getUnifiedProviders() } },
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
      serverId: { in: await getUnifiedProviders() },
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
      serverId: { in: await getUnifiedProviders() },
    },
    select: { code: true, name: true, price: true, stock: true, serverId: true },
  });

  // Group by service NAME (case-insensitive) — bukan code.
  // Tujuannya: provider yang punya banyak varian operator dengan code beda
  // tapi nama sama (misal Uranus: wa, wa#virtual53, wa#virtual58 → semua
  // bernama "Whatsapp") muncul sebagai SATU entry "Whatsapp" di list service.
  // Cheapest variant dengan stok > 0 yang dipakai sebagai displayKey + harga.
  type Bucket = {
    displayName: string;
    displayCode: string; // code yang dipakai sebagai key (untuk getServiceProviders lookup)
    minPrice: number;
    totalStock: number;
  };

  const serviceMap = new Map<string, Bucket>();

  for (const svc of allServices) {
    if (svc.stock <= 0) continue; // skip stok kosong

    const extId = mappings.find(m => m.serverId === svc.serverId)?.externalId || 0;
    let displayPrice: number;
    if (svc.serverId === "api10") {
      // Eris: pricing rule terpisah namespace "eris:"
      displayPrice = (await applyErisPricing(svc.price, svc.code, extId)).price;
    } else if (svc.serverId === "api8") {
      // Mercury: pricing rule terpisah namespace "mercury:"
      displayPrice = (await applyMercuryPricing(svc.price, svc.code, extId)).price;
    } else if (FINAL_PRICE_PROVIDERS.has(svc.serverId)) {
      displayPrice = svc.price;
    } else {
      const ruled = await applyPricing(svc.price, svc.code, extId);
      displayPrice = applyServerExtraMarkup(ruled.price, svc.serverId);
    }

    const groupKey = svc.name.trim().toLowerCase();
    const existing = serviceMap.get(groupKey);

    if (existing) {
      existing.totalStock += svc.stock;
      if (displayPrice < existing.minPrice) {
        existing.minPrice = displayPrice;
        existing.displayCode = svc.code; // code dari varian termurah
      }
    } else {
      serviceMap.set(groupKey, {
        displayName: svc.name,
        displayCode: svc.code,
        minPrice: displayPrice,
        totalStock: svc.stock,
      });
    }
  }

  const negaraKey = String(unifiedNegaraId);
  const merged: Record<string, { harga: number; stok: number; layanan: string }> = {};

  for (const bucket of serviceMap.values()) {
    merged[bucket.displayCode] = {
      harga: bucket.minPrice,
      stok: bucket.totalStock,
      layanan: bucket.displayName,
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
    actualCode: string; // actual service code for this provider (may differ from serviceCode)
  }>;
}> {
  const mappings = await getCountryMappings(unifiedNegaraId);
  if (mappings.length === 0) {
    return { service: serviceCode, code: serviceCode, providers: [] };
  }

  const dbCountryIds = mappings.map((m) => m.dbCountryId);

  // Step 1: Find service name for this code
  const primaryService = await db.providerService.findFirst({
    where: {
      code: serviceCode,
      countryId: { in: dbCountryIds },
      serverId: { in: await getUnifiedProviders() },
    },
    select: { name: true },
  });

  // Step 2: Find ALL codes that share the same service name
  // e.g., "wa" (api1) and "whatsapp" (api3) both have name "Whatsapp"
  let allCodes = [serviceCode];
  if (primaryService?.name) {
    const equivalentServices = await db.providerService.findMany({
      where: {
        name: { equals: primaryService.name, mode: "insensitive" },
        countryId: { in: dbCountryIds },
        serverId: { in: await getUnifiedProviders() },
      },
      select: { code: true },
      distinct: ["code"],
    });
    allCodes = [...new Set([serviceCode, ...equivalentServices.map((s) => s.code)])];
  }

  // Step 3: Query all matching services
  const services = await db.providerService.findMany({
    where: {
      code: { in: allCodes },
      countryId: { in: dbCountryIds },
      serverId: { in: await getUnifiedProviders() },
    },
    select: { serverId: true, name: true, price: true, stock: true, countryId: true, code: true },
  });

  const providers: Array<{
    serverId: string;
    name: string;
    icon: string;
    price: number;
    stock: number;
    negaraId: number;
    actualCode: string;
  }> = [];

  // Deduplicate: pilih ENTRY TERBAIK per serverId.
  // Untuk server yang punya banyak varian operator (misal Uranus dengan
  // wa, wa#virtual53, wa#virtual58 yang semua bernama "Whatsapp"), kita harus:
  //   1. Skip varian yang stok = 0
  //   2. Pick varian dengan harga termurah
  //   3. Sum total stok semua varian (biar user lihat total stok gabungan)
  //
  // Tanpa ini, urutan iterasi DB undefined → kadang varian termahal/habis ke-pick,
  // bikin harga di Bimasakti keliatan acak & server hilang dari list.
  type Candidate = {
    serverId: string;
    name: string;
    rawPrice: number;
    stock: number;
    countryId: string;
    code: string;
  };

  // Group candidates per serverId
  const perServer = new Map<string, Candidate[]>();
  for (const svc of services) {
    if (svc.stock <= 0) continue; // skip stok kosong
    const arr = perServer.get(svc.serverId) ?? [];
    arr.push({
      serverId: svc.serverId,
      name: svc.name,
      rawPrice: svc.price,
      stock: svc.stock,
      countryId: svc.countryId,
      code: svc.code,
    });
    perServer.set(svc.serverId, arr);
  }

  for (const [serverId, candidates] of perServer.entries()) {
    if (candidates.length === 0) continue;

    // Pilih varian termurah, sum total stok
    const cheapest = candidates.reduce((min, c) =>
      c.rawPrice < min.rawPrice ? c : min
    );
    const totalStock = candidates.reduce((sum, c) => sum + c.stock, 0);

    const mapping = mappings.find(
      (m) => m.dbCountryId === cheapest.countryId && m.serverId === serverId
    );
    if (!mapping) continue;

    let displayPrice: number;
    if (serverId === "api10") {
      // Eris: pricing rule terpisah namespace "eris:"
      displayPrice = (await applyErisPricing(cheapest.rawPrice, cheapest.code, mapping.externalId)).price;
    } else if (serverId === "api8") {
      // Mercury: pricing rule terpisah namespace "mercury:"
      displayPrice = (await applyMercuryPricing(cheapest.rawPrice, cheapest.code, mapping.externalId)).price;
    } else if (FINAL_PRICE_PROVIDERS.has(serverId)) {
      displayPrice = cheapest.rawPrice;
    } else {
      const ruled = await applyPricing(cheapest.rawPrice, cheapest.code, mapping.externalId);
      displayPrice = applyServerExtraMarkup(ruled.price, serverId);
    }

    const serverInfo = SERVER_NAMES[serverId] || { name: serverId, icon: "⚪" };

    providers.push({
      serverId,
      name: serverInfo.name,
      icon: serverInfo.icon,
      price: displayPrice,
      stock: totalStock,
      negaraId: mapping.externalId,
      actualCode: cheapest.code, // code asli varian termurah untuk createOrder
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
