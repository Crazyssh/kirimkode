/**
 * Helper untuk akses SiteSetting dengan cache in-memory.
 * Khusus untuk setting yang sering dibaca (visible_servers, unified_providers, dll).
 */

import { db } from "@/lib/db";

const CACHE_TTL = 30_000; // 30 detik
const cache = new Map<string, { value: string | null; expiry: number }>();

/** Default visibility kalau setting belum di-set */
const DEFAULT_VISIBLE_SERVERS = ["unified", "api1", "api4", "api5", "api6", "api7", "api8"];
const DEFAULT_UNIFIED_PROVIDERS = ["api1", "api2", "api3", "api5", "api8"];

async function getRaw(key: string): Promise<string | null> {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && now < entry.expiry) return entry.value;

  const setting = await db.siteSetting.findUnique({ where: { key } });
  const value = setting?.value ?? null;
  cache.set(key, { value, expiry: now + CACHE_TTL });
  return value;
}

/** Invalidate cache untuk satu key (panggil setelah update) */
export function invalidateSettingCache(key?: string) {
  if (key) cache.delete(key);
  else cache.clear();
}

/**
 * Daftar server yang visible di /buy page.
 * Default: ["unified", "api1", "api4", "api5", "api6", "api7", "api8"] (semua yang dipasang di data/services.ts).
 */
export async function getVisibleServers(): Promise<string[]> {
  const raw = await getRaw("visible_servers");
  if (!raw) return DEFAULT_VISIBLE_SERVERS;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) return arr;
  } catch {
    /* fall through */
  }
  return DEFAULT_VISIBLE_SERVERS;
}

/**
 * Daftar provider yang ikut di unified merging (Bimasakti).
 * Default: ["api1", "api2", "api3"].
 */
export async function getUnifiedProviders(): Promise<string[]> {
  const raw = await getRaw("unified_providers");
  if (!raw) return DEFAULT_UNIFIED_PROVIDERS;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) return arr;
  } catch {
    /* fall through */
  }
  return DEFAULT_UNIFIED_PROVIDERS;
}

export const SERVER_VISIBILITY_DEFAULTS = {
  visibleServers: DEFAULT_VISIBLE_SERVERS,
  unifiedProviders: DEFAULT_UNIFIED_PROVIDERS,
};
