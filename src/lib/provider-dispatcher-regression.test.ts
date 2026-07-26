/**
 * Regression: provider dispatcher stays unchanged after the Pluto integration
 * (task 17.4, design section 5 + "Batas Kepemilikan Data").
 *
 * Requirement 22.5: when partner supply is hidden or fails, Main keeps serving
 * the existing providers exactly as before. Requirement 1.3: a partner failure
 * never degrades non-partner features.
 *
 * Two areas are asserted here:
 *   A. `api1`..`api10` and `unified` dispatch routing is unchanged, and Pluto
 *      (`partner`) is NEVER part of `unified`/Bimasakti.
 *   B. The four Pluto states — active, disabled-flag, stockout, unavailable —
 *      behave correctly through the flag/allowlist + provider-partner surface,
 *      and in every state the existing providers are untouched.
 *
 * The HTTP boundary is mocked at two seams:
 *   - `@/lib/partner-client` (`internalApiRequest`) for the Pluto Internal API,
 *   - the numeric-id providers (`provider3`..`provider10`) and `global.fetch`
 *     for api1/api2, so no live provider or partner server is required.
 *
 * This file only READS the modules under test; it never modifies them.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---- Hoisted mocks (resolved at import time by the modules under test) ----
const mocks = vi.hoisted(() => {
  const providerFns = () => ({
    getBalance: vi.fn(),
    getNegara: vi.fn(),
    getOperator: vi.fn(),
    getLayanan: vi.fn(),
    createOrder: vi.fn(),
    checkSms: vi.fn(),
    cancelOrder: vi.fn(),
    requestRetry: vi.fn(),
  });
  return {
    p3: providerFns(),
    p4: providerFns(),
    p5: providerFns(),
    p6: providerFns(),
    p7: providerFns(),
    p8: providerFns(),
    p9: providerFns(),
    p10: providerFns(),
    // Partner Internal API boundary (used by the real provider-partner module).
    internalApiRequest: vi.fn(),
    isPartnerClientConfigured: vi.fn(),
    // Main DB (used by the real partner-flag module).
    findUnique: vi.fn(),
  };
});

vi.mock("@/lib/provider3", () => mocks.p3);
vi.mock("@/lib/provider4", () => mocks.p4);
vi.mock("@/lib/provider5", () => mocks.p5);
vi.mock("@/lib/provider6", () => mocks.p6);
vi.mock("@/lib/provider7", () => mocks.p7);
vi.mock("@/lib/provider8", () => mocks.p8);
vi.mock("@/lib/provider9", () => mocks.p9);
vi.mock("@/lib/provider10", () => mocks.p10);

// Keep the REAL partner-client exports (PartnerApiError, timeouts, ...) and only
// override the two functions that touch the network / config.
vi.mock("@/lib/partner-client", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/partner-client")>();
  return {
    ...actual,
    internalApiRequest: mocks.internalApiRequest,
    isPartnerClientConfigured: mocks.isPartnerClientConfigured,
  };
});

vi.mock("@/lib/db", () => ({
  db: { siteSetting: { findUnique: mocks.findUnique } },
}));

import * as otp from "./otp";
import { servers } from "@/data/services";
import { getUnifiedProviders, SERVER_VISIBILITY_DEFAULTS } from "@/lib/site-settings";
import { PartnerApiError } from "@/lib/partner-client";
import * as providerPartner from "@/lib/provider-partner";
import {
  isPartnerSupplyEnabledForUser,
  isPartnerPurchaseAllowed,
  canOperateExistingPartnerOrder,
  getPartnerLayananForUser,
  invalidatePartnerFlagCache,
  PARTNER_SUPPLY_ENABLED_KEY,
  PARTNER_SUPPLY_ALLOWLIST_KEY,
} from "@/lib/partner-flag";

const PROVIDER_MOCKS: Record<string, ReturnType<typeof vi.fn> extends never ? never : typeof mocks.p3> = {
  api3: mocks.p3,
  api4: mocks.p4,
  api5: mocks.p5,
  api6: mocks.p6,
  api7: mocks.p7,
  api8: mocks.p8,
  api9: mocks.p9,
  api10: mocks.p10,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Wire SiteSetting rows for the flag/allowlist reads. */
function stubSettings(rows: Record<string, string | null>) {
  mocks.findUnique.mockImplementation(
    async ({ where: { key } }: { where: { key: string } }) => {
      const value = rows[key];
      return value === undefined || value === null ? null : { key, value };
    },
  );
}

function clearPartnerEnv() {
  delete process.env.PARTNER_SUPPLY_ENABLED;
  delete process.env.PARTNER_SUPPLY_ALLOWLIST;
  delete process.env.PARTNER_INTERNAL_API_HMAC_CLIENT_ID;
  delete process.env.PARTNER_INTERNAL_API_HMAC_KEY_ID;
  delete process.env.PARTNER_INTERNAL_API_HMAC_SECRET;
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidatePartnerFlagCache();
  clearPartnerEnv();
  // Default: give every numeric provider mock an identifiable return so
  // routing assertions can distinguish the target.
  for (const [id, m] of Object.entries(PROVIDER_MOCKS)) {
    m.getBalance.mockResolvedValue({ balance: id });
    m.getNegara.mockResolvedValue({ success: true, data: [{ id_negara: 1, nama_negara: id }] });
    m.getOperator.mockResolvedValue({ data: { "1": [id] } });
    m.getLayanan.mockResolvedValue({ "1": { wa: { harga: 1, stok: 1, layanan: id } } });
    m.createOrder.mockResolvedValue({ success: true, id: `${id}-order` });
    m.checkSms.mockResolvedValue({ success: true, server: id });
    m.cancelOrder.mockResolvedValue({ success: true, server: id });
    m.requestRetry.mockResolvedValue({ success: true, server: id });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  invalidatePartnerFlagCache();
  clearPartnerEnv();
});

// ==================== A. api1..api10 + unified routing unchanged ====================

describe("dispatcher routing for api3..api10 is unchanged", () => {
  const NUMERIC = ["api3", "api4", "api5", "api6", "api7", "api8", "api9", "api10"] as const;

  it("getNegara routes each server to its own provider module", async () => {
    for (const id of NUMERIC) {
      const res = await otp.getNegara(id);
      expect(PROVIDER_MOCKS[id].getNegara).toHaveBeenCalledTimes(1);
      expect(res).toEqual({ success: true, data: [{ id_negara: 1, nama_negara: id }] });
    }
  });

  it("createOrder / checkSms / cancelOrder route to the matching provider module", async () => {
    for (const id of NUMERIC) {
      await otp.createOrder(id, 1, "wa", "any");
      await otp.checkSms(id, 123);
      await otp.cancelOrder(id, 123);
      expect(PROVIDER_MOCKS[id].createOrder).toHaveBeenCalledTimes(1);
      expect(PROVIDER_MOCKS[id].checkSms).toHaveBeenCalledWith(123);
      expect(PROVIDER_MOCKS[id].cancelOrder).toHaveBeenCalledWith(123);
    }
  });

  it("only api4 supports resend; every other id throws RESEND_NOT_SUPPORTED", async () => {
    await otp.requestRetry("api4", 5);
    expect(mocks.p4.requestRetry).toHaveBeenCalledWith(5);
    for (const id of ["api1", "api2", "api3", "api10", "partner"] as const) {
      await expect(otp.requestRetry(id, 5)).rejects.toThrow("RESEND_NOT_SUPPORTED");
    }
  });
});

describe("dispatcher routing for api1/api2 still uses the JasaOTP HTTP path", () => {
  it("createOrder for api1/api2 calls fetch against order.php (no provider module, no partner)", async () => {
    // Fresh Response per call — a Response body can only be read once.
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(200, { success: true, id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await otp.createOrder("api1", 1, "wa", "any");
    await otp.createOrder("api2", 1, "wa", "any");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain("/v1/order.php");
    expect(urls[1]).toContain("/v2/order.php");
    // The numeric provider modules must NOT be touched for api1/api2.
    expect(mocks.p3.createOrder).not.toHaveBeenCalled();
  });
});

describe("`unified` is routed separately and never touches Pluto", () => {
  it("every dispatcher entrypoint rejects `unified` with the separate-router guard", async () => {
    await expect(otp.getBalance("unified")).rejects.toThrow("Use unified-provider");
    await expect(otp.getNegara("unified")).rejects.toThrow("Use unified-provider");
    await expect(otp.getOperator("unified", 1)).rejects.toThrow("Use unified-provider");
    await expect(otp.getLayanan("unified", 1)).rejects.toThrow("Use unified-provider");
    await expect(otp.createOrder("unified", 1, "wa", "any")).rejects.toThrow("Use unified-provider");
    await expect(otp.checkSms("unified", 1)).rejects.toThrow("Use unified-provider");
    await expect(otp.cancelOrder("unified", 1)).rejects.toThrow("Use unified-provider");
  });

  it("Pluto (`partner`) is NOT part of unified/Bimasakti defaults", async () => {
    // unified merge set (Bimasakti) never includes `partner`.
    const unified = await getUnifiedProviders();
    expect(unified).not.toContain("partner");
    expect(SERVER_VISIBILITY_DEFAULTS.unifiedProviders).not.toContain("partner");
    expect(SERVER_VISIBILITY_DEFAULTS.visibleServers).not.toContain("partner");
  });

  it("lists `partner` in the catalog while still not offering it by default", () => {
    const ids = servers.map((s) => s.id as string);
    expect(ids).toContain("unified");
    expect(servers.find((s) => s.id === "unified")?.name).toBe("Bimasakti");
    // Pluto IS listed now, because the buy page can only render a server it knows
    // about. Being listed is deliberately NOT the same as being offered: the page
    // filters by `visible_servers`, and `partner` is absent from the defaults
    // (asserted above), so an unchanged deployment still shows nothing.
    expect(ids).toContain("partner");
    expect(SERVER_VISIBILITY_DEFAULTS.visibleServers).not.toContain("partner");
  });
});

// ==================== A'. Pluto uses the saga path, not the numeric-order path ====================

describe("`partner` numeric order lifecycle is guarded to the saga", () => {
  it("createOrder / checkSms / cancelOrder reject `partner` (must use the saga refs)", async () => {
    await expect(otp.createOrder("partner", 1, "wa", "any")).rejects.toThrow(/saga|partner/i);
    await expect(otp.checkSms("partner", 1)).rejects.toThrow(/getOrderStatus|partner/i);
    await expect(otp.cancelOrder("partner", 1)).rejects.toThrow(/cancelPartnerOrder|partner/i);
  });

  it("read wrappers for `partner` return the fixed MVP catalog metadata", async () => {
    expect(await otp.getBalance("partner")).toEqual({ balance: 0 });
    expect(await otp.getNegara("partner")).toEqual({
      success: true,
      data: [{ id_negara: 6, nama_negara: "indonesia" }],
    });
    expect(await otp.getOperator("partner", 62)).toEqual({ data: { "62": ["any"] } });
  });
});

// ==================== B. Four Pluto states; existing providers unaffected ====================

/** Assert the existing dispatcher keeps working regardless of Pluto's state. */
async function assertExistingProvidersUnaffected() {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, id: 1 }));
  vi.stubGlobal("fetch", fetchMock);

  // A DB-backed provider still routes to its module.
  const negara = await otp.getNegara("api3");
  expect(negara).toEqual({ success: true, data: [{ id_negara: 1, nama_negara: "api3" }] });
  // A JasaOTP provider still reaches the HTTP path.
  await otp.createOrder("api1", 1, "wa", "any");
  expect(fetchMock).toHaveBeenCalled();
  // Existing-order Pluto operations remain available in EVERY state (reversible
  // gating — turning supply off must never orphan an in-flight order).
  expect(canOperateExistingPartnerOrder(true)).toBe(true);
}

describe("Pluto state: ACTIVE (flag on + buyer allowlisted)", () => {
  const BUYER = "buyer-1";

  beforeEach(() => {
    stubSettings({
      [PARTNER_SUPPLY_ENABLED_KEY]: "true",
      [PARTNER_SUPPLY_ALLOWLIST_KEY]: `["${BUYER}"]`,
    });
    mocks.isPartnerClientConfigured.mockReturnValue(true);
  });

  it("is visible and purchasable, and the catalog shows the available supply", async () => {
    mocks.internalApiRequest.mockResolvedValue({
      data: {
        available: 3,
        retailPriceIdr: 1400,
        currency: "IDR",
        quoteVersion: "q1",
        expiresAt: new Date().toISOString(),
      },
      requestId: "r-active",
    });

    expect(await isPartnerSupplyEnabledForUser(BUYER)).toBe(true);
    expect(await isPartnerPurchaseAllowed(BUYER)).toBe(true);

    const catalog = await getPartnerLayananForUser(BUYER, 62);
    expect(catalog).toEqual({
      "62": { wa: { harga: 1400, stok: 3, layanan: "WhatsApp" } },
    });

    await assertExistingProvidersUnaffected();
  });
});

describe("Pluto state: DISABLED FLAG (hidden; existing providers unaffected)", () => {
  const BUYER = "buyer-1";

  beforeEach(() => {
    stubSettings({
      [PARTNER_SUPPLY_ENABLED_KEY]: "false",
      [PARTNER_SUPPLY_ALLOWLIST_KEY]: `["${BUYER}"]`,
    });
    mocks.isPartnerClientConfigured.mockReturnValue(true);
  });

  it("hides new supply, never calls the partner API for discovery, and keeps existing orders operable", async () => {
    expect(await isPartnerSupplyEnabledForUser(BUYER)).toBe(false);
    expect(await isPartnerPurchaseAllowed(BUYER)).toBe(false);

    const catalog = await getPartnerLayananForUser(BUYER, 62);
    expect(catalog).toEqual({ "62": {} });
    // Gated off before any network call is attempted.
    expect(mocks.internalApiRequest).not.toHaveBeenCalled();

    await assertExistingProvidersUnaffected();
  });
});

describe("Pluto state: STOCKOUT (empty catalog; existing providers unaffected)", () => {
  const BUYER = "buyer-1";

  beforeEach(() => {
    stubSettings({
      [PARTNER_SUPPLY_ENABLED_KEY]: "true",
      [PARTNER_SUPPLY_ALLOWLIST_KEY]: `["${BUYER}"]`,
    });
    mocks.isPartnerClientConfigured.mockReturnValue(true);
  });

  it("returns an empty catalog when inventory is zero", async () => {
    mocks.internalApiRequest.mockResolvedValue({
      data: {
        available: 0,
        retailPriceIdr: 1400,
        currency: "IDR",
        quoteVersion: "q1",
        expiresAt: new Date().toISOString(),
      },
      requestId: "r-stockout",
    });

    // Eligible buyer, but no stock -> empty catalog (Pluto simply not offered).
    expect(await isPartnerSupplyEnabledForUser(BUYER)).toBe(true);
    const catalog = await getPartnerLayananForUser(BUYER, 62);
    expect(catalog).toEqual({ "62": {} });

    await assertExistingProvidersUnaffected();
  });
});

describe("Pluto state: UNAVAILABLE (structured failure; existing providers unaffected)", () => {
  const BUYER = "buyer-1";

  beforeEach(() => {
    stubSettings({
      [PARTNER_SUPPLY_ENABLED_KEY]: "true",
      [PARTNER_SUPPLY_ALLOWLIST_KEY]: `["${BUYER}"]`,
    });
    mocks.isPartnerClientConfigured.mockReturnValue(true);
  });

  it("surfaces a structured PartnerApiError from inventory but degrades discovery to an empty catalog", async () => {
    mocks.internalApiRequest.mockRejectedValue(
      new PartnerApiError("PARTNER_UNAVAILABLE", 0, true, "r-unavail"),
    );

    // The raw inventory read fails with a stable, non-leaking error code.
    await expect(providerPartner.getInventory()).rejects.toMatchObject({
      code: "PARTNER_UNAVAILABLE",
      retryable: true,
    });

    // Discovery must not throw: Pluto just disappears from the buyer listing.
    const catalog = await getPartnerLayananForUser(BUYER, 62);
    expect(catalog).toEqual({ "62": {} });

    await assertExistingProvidersUnaffected();
  });
});
