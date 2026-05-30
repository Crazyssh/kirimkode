/**
 * Helper untuk akses SiteSetting dengan cache in-memory.
 * Khusus untuk setting yang sering dibaca (visible_servers, unified_providers, dll).
 */

import { db } from "@/lib/db";

const CACHE_TTL = 30_000; // 30 detik
const cache = new Map<string, { value: string | null; expiry: number }>();

/** Default visibility kalau setting belum di-set */
const DEFAULT_VISIBLE_SERVERS = ["unified", "api1", "api4", "api5", "api6", "api7", "api8", "api9", "api10"];
const DEFAULT_UNIFIED_PROVIDERS = ["api1", "api2", "api3", "api5", "api8"];

// Server Clowatch yang ikut auto-health-check (lihat lib/clowatch-health.ts)
export const CLOWATCH_SERVERS = ["api5", "api8", "api9", "api10"] as const;

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
 * Default: ["unified", "api1", "api4", "api5", "api6", "api7", "api8", "api9", "api10"] (semua yang dipasang di data/services.ts).
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

/**
 * Per-server health state untuk Clowatch (api5/api8/api9/api10).
 * Disimpan di siteSetting key `clowatch_health_<serverId>`:
 *   { status: "healthy" | "unhealthy", failCount, lastCheckAt, lastSuccessAt, lastError? }
 */
export interface ClowatchHealthState {
  status: "healthy" | "unhealthy";
  failCount: number;
  lastCheckAt: number; // epoch ms
  lastSuccessAt: number; // epoch ms (0 kalau belum pernah sukses)
  lastError?: string;
}

const DEFAULT_HEALTH: ClowatchHealthState = {
  status: "healthy", // default healthy biar gak nge-hide server tiba-tiba saat deploy
  failCount: 0,
  lastCheckAt: 0,
  lastSuccessAt: Date.now(),
};

export async function getClowatchHealth(
  serverId: string
): Promise<ClowatchHealthState> {
  const raw = await getRaw(`clowatch_health_${serverId}`);
  if (!raw) return { ...DEFAULT_HEALTH };
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && obj.status) {
      return {
        status: obj.status === "unhealthy" ? "unhealthy" : "healthy",
        failCount: Number(obj.failCount) || 0,
        lastCheckAt: Number(obj.lastCheckAt) || 0,
        lastSuccessAt: Number(obj.lastSuccessAt) || 0,
        lastError: typeof obj.lastError === "string" ? obj.lastError : undefined,
      };
    }
  } catch {
    /* fall through */
  }
  return { ...DEFAULT_HEALTH };
}

export async function setClowatchHealth(
  serverId: string,
  state: ClowatchHealthState
): Promise<void> {
  const key = `clowatch_health_${serverId}`;
  const value = JSON.stringify(state);
  // Direct DB write — bypass cache
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { db } = await import("@/lib/db");
  await db.siteSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  invalidateSettingCache(key);
}

/**
 * Toggle "auto-managed" per Clowatch server — kalau true, hasil health check
 * otomatis pengaruh ke visible_servers. Kalau false, admin manual override.
 *
 * Default: true (auto-managed).
 */
export async function isClowatchAutoManaged(serverId: string): Promise<boolean> {
  const raw = await getRaw(`clowatch_auto_${serverId}`);
  if (raw === null) return true;
  return raw === "true";
}

export async function setClowatchAutoManaged(
  serverId: string,
  enabled: boolean
): Promise<void> {
  const key = `clowatch_auto_${serverId}`;
  const value = String(enabled);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { db } = await import("@/lib/db");
  await db.siteSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  invalidateSettingCache(key);
}

/**
 * Get effective visible servers — apply auto-hide untuk Clowatch yang unhealthy
 * dan auto-managed. Manual override (auto-managed=false) akan dihormati.
 */
export async function getEffectiveVisibleServers(): Promise<string[]> {
  const base = await getVisibleServers();
  const result: string[] = [];

  for (const id of base) {
    if (!CLOWATCH_SERVERS.includes(id as (typeof CLOWATCH_SERVERS)[number])) {
      // Bukan Clowatch — keep as-is
      result.push(id);
      continue;
    }

    const auto = await isClowatchAutoManaged(id);
    if (!auto) {
      // Manual mode — admin yang atur, ikut visible_servers apa adanya
      result.push(id);
      continue;
    }

    const health = await getClowatchHealth(id);
    if (health.status === "healthy") {
      result.push(id);
    }
    // unhealthy + auto-managed → hide
  }

  return result;
}
