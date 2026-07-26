/**
 * Unit + property tests for the Pluto private-beta gate (task 9.8, design
 * sections 5 & 11, Property 27 "Private beta gating reversibel").
 *
 * Covers:
 *   - the pure `decidePlutoPolicy` reversible-gating decision,
 *   - flag / allowlist parsing (JSON + delimited, env fallback),
 *   - config-backed helpers reading SiteSetting with an env fallback,
 *   - the critical "flag off but existing order operable" case,
 *   - gated discovery returning an empty catalog for ineligible buyers.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";

// Hoisted mocks so the module-under-test resolves them at import time.
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  getLayanan: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { siteSetting: { findUnique: mocks.findUnique } },
}));

vi.mock("@/lib/provider-partner", () => ({
  getLayanan: mocks.getLayanan,
}));

import {
  decidePlutoPolicy,
  parseFlagValue,
  parseAllowlistValue,
  isPartnerSupplyEnabled,
  getPartnerAllowlist,
  isPartnerSupplyEnabledForUser,
  isPartnerPurchaseAllowed,
  canOperateExistingPartnerOrder,
  getPartnerLayananForUser,
  invalidatePartnerFlagCache,
  PARTNER_SUPPLY_ENABLED_KEY,
  PARTNER_SUPPLY_ALLOWLIST_KEY,
} from "./partner-flag";

/** Wire SiteSetting rows for a single resolution. */
function stubSettings(rows: Record<string, string | null>) {
  mocks.findUnique.mockImplementation(
    async ({ where: { key } }: { where: { key: string } }) => {
      const value = rows[key];
      return value === undefined || value === null ? null : { key, value };
    },
  );
}

function clearEnv() {
  delete process.env.PARTNER_SUPPLY_ENABLED;
  delete process.env.PARTNER_SUPPLY_ALLOWLIST;
}

beforeEach(() => {
  invalidatePartnerFlagCache();
  mocks.findUnique.mockReset();
  mocks.getLayanan.mockReset();
  clearEnv();
});

afterEach(() => {
  invalidatePartnerFlagCache();
  clearEnv();
});

// ==================== Pure policy ====================

describe("decidePlutoPolicy — reversible gating (pure)", () => {
  const base = {
    buyerId: "buyer-1",
    partnerSupplyEnabled: true,
    allowlistedBuyerIds: ["buyer-1"],
    existingPlutoOrder: true,
  } as const;

  it("allows discovery and purchase only when flag on AND buyer allowlisted", () => {
    expect(decidePlutoPolicy({ ...base, operation: "discover" })).toEqual({
      allowed: true,
      reason: "PRIVATE_BETA_ELIGIBLE",
    });
    expect(decidePlutoPolicy({ ...base, operation: "purchase" })).toEqual({
      allowed: true,
      reason: "PRIVATE_BETA_ELIGIBLE",
    });
    expect(
      decidePlutoPolicy({ ...base, operation: "purchase", partnerSupplyEnabled: false }),
    ).toEqual({ allowed: false, reason: "FEATURE_DISABLED" });
    expect(
      decidePlutoPolicy({ ...base, operation: "discover", allowlistedBuyerIds: [] }),
    ).toEqual({ allowed: false, reason: "BUYER_NOT_ALLOWLISTED" });
  });

  it("keeps existing-order status/cancel available even with flag off and empty allowlist", () => {
    for (const operation of ["existing-order-status", "existing-order-cancel"] as const) {
      expect(
        decidePlutoPolicy({
          operation,
          buyerId: "buyer-1",
          partnerSupplyEnabled: false,
          allowlistedBuyerIds: [],
          existingPlutoOrder: true,
        }),
      ).toEqual({ allowed: true, reason: "EXISTING_ORDER_OPERATION" });
    }
  });

  it("rejects an existing-order operation when the order does not exist", () => {
    expect(
      decidePlutoPolicy({
        operation: "existing-order-cancel",
        buyerId: "buyer-1",
        partnerSupplyEnabled: true,
        allowlistedBuyerIds: ["buyer-1"],
        existingPlutoOrder: false,
      }),
    ).toEqual({ allowed: false, reason: "ORDER_NOT_FOUND" });
  });
});

// ==================== Parsers ====================

describe("parseFlagValue", () => {
  it("treats true/1/yes/on (any case) as enabled, everything else as disabled", () => {
    for (const v of ["true", "TRUE", "1", "yes", "On"]) expect(parseFlagValue(v)).toBe(true);
    for (const v of ["false", "0", "no", "", "  ", "maybe"]) expect(parseFlagValue(v)).toBe(false);
    expect(parseFlagValue(null)).toBe(false);
    expect(parseFlagValue(undefined)).toBe(false);
  });
});

describe("parseAllowlistValue", () => {
  it("parses a JSON array of UUID strings", () => {
    expect(parseAllowlistValue('["a","b","c"]')).toEqual(["a", "b", "c"]);
  });

  it("parses a comma/whitespace separated list and de-duplicates", () => {
    expect(parseAllowlistValue("a, b ,a\nc")).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for empty/invalid input", () => {
    expect(parseAllowlistValue(null)).toEqual([]);
    expect(parseAllowlistValue("")).toEqual([]);
    expect(parseAllowlistValue("   ")).toEqual([]);
  });
});

// ==================== Config readers ====================

describe("isPartnerSupplyEnabled / getPartnerAllowlist", () => {
  it("defaults to disabled with an empty allowlist when nothing is configured", async () => {
    stubSettings({});
    expect(await isPartnerSupplyEnabled()).toBe(false);
    expect(await getPartnerAllowlist()).toEqual([]);
  });

  it("reads the flag and allowlist from SiteSetting", async () => {
    stubSettings({
      [PARTNER_SUPPLY_ENABLED_KEY]: "true",
      [PARTNER_SUPPLY_ALLOWLIST_KEY]: '["buyer-1","buyer-2"]',
    });
    expect(await isPartnerSupplyEnabled()).toBe(true);
    expect(await getPartnerAllowlist()).toEqual(["buyer-1", "buyer-2"]);
  });

  it("falls back to environment variables when SiteSetting rows are absent", async () => {
    stubSettings({});
    process.env.PARTNER_SUPPLY_ENABLED = "true";
    process.env.PARTNER_SUPPLY_ALLOWLIST = "buyer-9, buyer-8";
    expect(await isPartnerSupplyEnabled()).toBe(true);
    expect(await getPartnerAllowlist()).toEqual(["buyer-9", "buyer-8"]);
  });
});

// ==================== Gating helpers ====================

describe("isPartnerSupplyEnabledForUser / isPartnerPurchaseAllowed", () => {
  it("is true only when flag on AND buyer allowlisted", async () => {
    stubSettings({
      [PARTNER_SUPPLY_ENABLED_KEY]: "true",
      [PARTNER_SUPPLY_ALLOWLIST_KEY]: '["buyer-1"]',
    });
    expect(await isPartnerSupplyEnabledForUser("buyer-1")).toBe(true);
    expect(await isPartnerPurchaseAllowed("buyer-1")).toBe(true);
    expect(await isPartnerSupplyEnabledForUser("buyer-2")).toBe(false);
  });

  it("is false when the flag is off, even for an allowlisted buyer", async () => {
    stubSettings({
      [PARTNER_SUPPLY_ENABLED_KEY]: "false",
      [PARTNER_SUPPLY_ALLOWLIST_KEY]: '["buyer-1"]',
    });
    expect(await isPartnerSupplyEnabledForUser("buyer-1")).toBe(false);
    expect(await isPartnerPurchaseAllowed("buyer-1")).toBe(false);
  });

  it("is false for a null/empty user id", async () => {
    stubSettings({ [PARTNER_SUPPLY_ENABLED_KEY]: "true", [PARTNER_SUPPLY_ALLOWLIST_KEY]: "[]" });
    expect(await isPartnerSupplyEnabledForUser(null)).toBe(false);
    expect(await isPartnerSupplyEnabledForUser(undefined)).toBe(false);
    expect(await isPartnerSupplyEnabledForUser("")).toBe(false);
  });
});

describe("canOperateExistingPartnerOrder — flag off but existing order operable", () => {
  it("allows operating an existing Pluto order regardless of the flag/allowlist", () => {
    // No SiteSetting/env needed: existing-order ops are decided independently.
    expect(canOperateExistingPartnerOrder(true)).toBe(true);
    // Even the default arg (order assumed present) is allowed.
    expect(canOperateExistingPartnerOrder()).toBe(true);
  });

  it("rejects when the referenced order does not exist", () => {
    expect(canOperateExistingPartnerOrder(false)).toBe(false);
  });
});

describe("getPartnerLayananForUser — gated discovery", () => {
  it("returns an empty catalog and never queries Pluto when the buyer is ineligible", async () => {
    stubSettings({ [PARTNER_SUPPLY_ENABLED_KEY]: "false" });
    const result = await getPartnerLayananForUser("buyer-1", 62);
    expect(result).toEqual({ "62": {} });
    expect(mocks.getLayanan).not.toHaveBeenCalled();
  });

  it("returns the Pluto catalog for an eligible buyer", async () => {
    stubSettings({
      [PARTNER_SUPPLY_ENABLED_KEY]: "true",
      [PARTNER_SUPPLY_ALLOWLIST_KEY]: '["buyer-1"]',
    });
    mocks.getLayanan.mockResolvedValue({
      "62": { wa: { harga: 1500, stok: 3, layanan: "WhatsApp" } },
    });
    const result = await getPartnerLayananForUser("buyer-1", 62);
    expect(result).toEqual({ "62": { wa: { harga: 1500, stok: 3, layanan: "WhatsApp" } } });
    expect(mocks.getLayanan).toHaveBeenCalledWith(62);
  });
});

// ==================== Property 27: reversible gating ====================

describe("Property 27: Private beta gating reversibel", () => {
  it("Pluto is discoverable/purchasable exactly when flag on AND buyer allowlisted; existing orders never gated", () => {
    // **Validates: Requirements 17.4, 17.6, 22.7**
    fc.assert(
      fc.property(
        fc.record({
          buyerId: fc.string({ minLength: 1, maxLength: 12 }),
          partnerSupplyEnabled: fc.boolean(),
          allowlist: fc.array(fc.string({ minLength: 1, maxLength: 12 }), { maxLength: 6 }),
          existingPlutoOrder: fc.boolean(),
        }),
        ({ buyerId, partnerSupplyEnabled, allowlist, existingPlutoOrder }) => {
          const allowlistedBuyerIds = allowlist;
          const eligible =
            partnerSupplyEnabled && allowlistedBuyerIds.includes(buyerId);

          for (const operation of ["discover", "purchase"] as const) {
            const decision = decidePlutoPolicy({
              operation,
              buyerId,
              partnerSupplyEnabled,
              allowlistedBuyerIds,
              existingPlutoOrder,
            });
            // New eligibility tracks flag AND allowlist exactly.
            expect(decision.allowed).toBe(eligible);
          }

          for (const operation of ["existing-order-status", "existing-order-cancel"] as const) {
            const decision = decidePlutoPolicy({
              operation,
              buyerId,
              partnerSupplyEnabled,
              allowlistedBuyerIds,
              existingPlutoOrder,
            });
            // Existing-order ops depend only on the order existing — the flag
            // and allowlist never remove eligibility for an in-flight order.
            expect(decision.allowed).toBe(existingPlutoOrder);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
