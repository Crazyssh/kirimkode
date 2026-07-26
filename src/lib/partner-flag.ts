/**
 * Private-beta gating for Pluto (internal provider id `partner`).
 *
 * Task 9.8 (design sections 5 and 11 "Private Beta"). Main owns the two knobs
 * that decide whether Pluto supply is offered to a buyer:
 *
 *   - `partner_supply_enabled` (default false) — the master feature flag.
 *   - an allowlist of buyer user UUIDs — only these accounts may see/buy Pluto.
 *
 * Reversible-gating rule (mirrors the pure `decidePlutoPolicy` from the Partner
 * repo task 5.3, and design Property 27):
 *   - DISCOVERY + PURCHASE are gated by `flag === true AND buyer ∈ allowlist`.
 *   - EXISTING Pluto order status/cancel are ALWAYS allowed, regardless of the
 *     flag or allowlist, so turning the flag off never breaks an in-flight
 *     order. It only hides NEW inventory/purchase. Test data is never deleted.
 *
 * This module is purely additive: it does not touch the `api1`–`api10`/`unified`
 * dispatcher behaviour. It only decides whether the `partner` supply is exposed.
 *
 * Config source of truth is `SiteSetting` (with a short in-memory cache), with
 * an environment-variable fallback so the flag can be toggled without a DB row:
 *   - flag:      SiteSetting `partner_supply_enabled` ("true"/"false")
 *                fallback env `PARTNER_SUPPLY_ENABLED`
 *   - allowlist: SiteSetting `partner_supply_allowlist` (JSON array of UUIDs)
 *                fallback env `PARTNER_SUPPLY_ALLOWLIST` (comma-separated UUIDs)
 */

import { db } from "@/lib/db";
import * as providerPartner from "@/lib/provider-partner";

export const PARTNER_SUPPLY_ENABLED_KEY = "partner_supply_enabled";
export const PARTNER_SUPPLY_ALLOWLIST_KEY = "partner_supply_allowlist";

const CACHE_TTL = 30_000; // 30s — matches lib/site-settings.ts cadence.

interface FlagCache {
  value: string | null;
  expiry: number;
}

const cache = new Map<string, FlagCache>();

async function getRawSetting(key: string): Promise<string | null> {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && now < entry.expiry) return entry.value;

  const setting = await db.siteSetting.findUnique({ where: { key } });
  const value = setting?.value ?? null;
  cache.set(key, { value, expiry: now + CACHE_TTL });
  return value;
}

/** Invalidate the flag/allowlist cache (call after an admin toggle). */
export function invalidatePartnerFlagCache(): void {
  cache.delete(PARTNER_SUPPLY_ENABLED_KEY);
  cache.delete(PARTNER_SUPPLY_ALLOWLIST_KEY);
}

// ==================== Pure policy ====================

export type PlutoOperation =
  | "discover"
  | "purchase"
  | "existing-order-status"
  | "existing-order-cancel";

export type PlutoPolicyDecision =
  | {
      readonly allowed: true;
      readonly reason: "PRIVATE_BETA_ELIGIBLE" | "EXISTING_ORDER_OPERATION";
    }
  | {
      readonly allowed: false;
      readonly reason: "FEATURE_DISABLED" | "BUYER_NOT_ALLOWLISTED" | "ORDER_NOT_FOUND";
    };

export interface PlutoPolicyInput {
  readonly operation: PlutoOperation;
  /** Buyer user UUID (Main `User.id`). */
  readonly buyerId: string;
  readonly partnerSupplyEnabled: boolean;
  readonly allowlistedBuyerIds: readonly string[];
  /** True when the operation targets an already-created Pluto order. */
  readonly existingPlutoOrder: boolean;
}

/**
 * Pure gating decision (no I/O). Mirrors the Partner-repo `decidePlutoPolicy`.
 *
 * Existing-order operations are decided FIRST and independently of the flag /
 * allowlist so a disabled flag can never orphan an in-flight order — it only
 * gates NEW discovery/purchase.
 */
export function decidePlutoPolicy(input: PlutoPolicyInput): PlutoPolicyDecision {
  const existingOperation =
    input.operation === "existing-order-status" ||
    input.operation === "existing-order-cancel";

  if (existingOperation) {
    return input.existingPlutoOrder
      ? { allowed: true, reason: "EXISTING_ORDER_OPERATION" }
      : { allowed: false, reason: "ORDER_NOT_FOUND" };
  }

  // discover / purchase — reversible gate.
  if (!input.partnerSupplyEnabled) {
    return { allowed: false, reason: "FEATURE_DISABLED" };
  }
  if (!input.allowlistedBuyerIds.includes(input.buyerId)) {
    return { allowed: false, reason: "BUYER_NOT_ALLOWLISTED" };
  }
  return { allowed: true, reason: "PRIVATE_BETA_ELIGIBLE" };
}

// ==================== Config readers (SiteSetting + env fallback) ====================

/** Parse a truthy flag string ("true"/"1"/"yes"/"on"), case-insensitive. */
export function parseFlagValue(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

/**
 * Parse the allowlist from either a JSON array string or a comma/whitespace
 * separated list. Returns a de-duplicated array of non-empty trimmed UUIDs.
 */
export function parseAllowlistValue(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  let items: string[] = [];
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) {
        items = arr.filter((x): x is string => typeof x === "string");
      }
    } catch {
      /* fall through to delimiter parsing */
    }
  }
  if (items.length === 0) {
    items = trimmed.split(/[,\s]+/);
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const id = item.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Read the master flag (default false), SiteSetting first then env fallback. */
export async function isPartnerSupplyEnabled(): Promise<boolean> {
  const raw = await getRawSetting(PARTNER_SUPPLY_ENABLED_KEY);
  if (raw != null) return parseFlagValue(raw);
  return parseFlagValue(process.env.PARTNER_SUPPLY_ENABLED);
}

/** Read the buyer allowlist, SiteSetting first then env fallback. */
export async function getPartnerAllowlist(): Promise<string[]> {
  const raw = await getRawSetting(PARTNER_SUPPLY_ALLOWLIST_KEY);
  if (raw != null) return parseAllowlistValue(raw);
  return parseAllowlistValue(process.env.PARTNER_SUPPLY_ALLOWLIST);
}

// ==================== Gating helpers (async, config-backed) ====================

/**
 * True when Pluto discovery/purchase is enabled for this specific buyer, i.e.
 * the flag is on AND the buyer is on the allowlist. Used to gate both the
 * catalog listing and the purchase saga entrypoint.
 */
export async function isPartnerSupplyEnabledForUser(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const [enabled, allowlist] = await Promise.all([
    isPartnerSupplyEnabled(),
    getPartnerAllowlist(),
  ]);
  const decision = decidePlutoPolicy({
    operation: "discover",
    buyerId: userId,
    partnerSupplyEnabled: enabled,
    allowlistedBuyerIds: allowlist,
    existingPlutoOrder: false,
  });
  return decision.allowed;
}

/**
 * Existing Pluto order status/cancel is ALWAYS operable, independent of the
 * flag/allowlist (reversible gating — turning the flag off must never break an
 * in-flight order). The order must actually exist and belong to Pluto.
 */
export function canOperateExistingPartnerOrder(existingPlutoOrder = true): boolean {
  const decision = decidePlutoPolicy({
    operation: "existing-order-status",
    buyerId: "",
    partnerSupplyEnabled: false, // deliberately off to prove independence
    allowlistedBuyerIds: [],
    existingPlutoOrder,
  });
  return decision.allowed;
}

/**
 * Gate the purchase saga entrypoint. Returns true only when the buyer may open
 * a NEW Pluto purchase (flag on + allowlisted). Callers MUST check this before
 * reaching `runPurchaseSaga` so a disabled/unlisted buyer never debits.
 */
export async function isPartnerPurchaseAllowed(
  userId: string | null | undefined,
): Promise<boolean> {
  return isPartnerSupplyEnabledForUser(userId);
}

/**
 * Gated discovery wrapper: return the Pluto `layanan` catalog for `negara` only
 * when the buyer is eligible. Otherwise return an empty catalog so Pluto simply
 * does not appear in the buyer's listing — existing providers are untouched.
 */
export async function getPartnerLayananForUser(
  userId: string | null | undefined,
  negara: number,
): Promise<Awaited<ReturnType<typeof providerPartner.getLayanan>>> {
  const negaraKey = String(negara);
  const empty = {
    [negaraKey]: {} as Record<
      string,
      { harga: number; stok: number; layanan: string }
    >,
  };

  if (!(await isPartnerSupplyEnabledForUser(userId))) {
    return empty;
  }
  return providerPartner.getLayanan(negara);
}
