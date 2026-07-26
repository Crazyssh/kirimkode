/**
 * E2E (task 17.7): disable private beta AFTER a Pluto order already exists.
 *
 * This covers the ORDER-EXISTS-THEN-FLAG-OFF transition end-to-end, which the
 * per-state dispatcher regression (`provider-dispatcher-regression.test.ts`)
 * does NOT cover — that file asserts the four Pluto states in isolation, here
 * we assert the temporal sequence across a flag toggle:
 *
 *   Phase 1 — flag ON + buyer allowlisted: the buyer discovers Pluto supply and
 *             a Pluto order is created through the purchase saga (the reserve
 *             boundary is mocked at the partner-client / HTTP seam).
 *   Phase 2 — flag OFF: NEW discovery/purchase is hidden (empty catalog,
 *             `isPartnerPurchaseAllowed` false) and NO partner API discovery
 *             call is made; the existing order/dispatch record is NOT deleted.
 *   Phase 3 — flag still OFF: the EXISTING Pluto order still supports status
 *             read and cancel (`canOperateExistingPartnerOrder(true) === true`,
 *             `getOrderStatus` / `cancelPartnerOrder` still callable) and the
 *             persisted records/audit trail remain intact.
 *   Phase 4 — existing non-partner providers (api1..api10 / unified) stay
 *             unaffected throughout every phase.
 *
 * Validates: Requirements 17.6 (disabling hides new supply but keeps test data
 * for audit), 22.5 (existing providers/orders keep working when partner supply
 * is hidden), 22.7 (a feature flag/allowlist disables partner supply WITHOUT a
 * database rollback).
 *
 * The HTTP boundary is mocked at two seams (same as the regression test):
 *   - `@/lib/partner-client` (`internalApiRequest`, `isPartnerClientConfigured`)
 *     for the Pluto Internal API,
 *   - `@/lib/provider3` + `global.fetch` for the existing api3 / api1 providers.
 * The saga persistence is an in-memory `SagaStore` so no live DB is needed; it
 * mirrors the exactly-once conditional semantics of the Prisma store.
 *
 * This file only READS the modules under test (partner-flag, provider-partner,
 * partner-saga, otp); it never modifies them.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// ---- Hoisted mocks (resolved at import time by the modules under test) ----
const mocks = vi.hoisted(() => ({
  // One numeric provider is enough to prove the existing dispatcher is intact.
  p3: {
    getBalance: vi.fn(),
    getNegara: vi.fn(),
    getOperator: vi.fn(),
    getLayanan: vi.fn(),
    createOrder: vi.fn(),
    checkSms: vi.fn(),
    cancelOrder: vi.fn(),
    requestRetry: vi.fn(),
  },
  // Partner Internal API boundary (used by the real provider-partner module).
  internalApiRequest: vi.fn(),
  isPartnerClientConfigured: vi.fn(),
  // Main DB (used by the real partner-flag module).
  findUnique: vi.fn(),
}));

vi.mock("@/lib/provider3", () => mocks.p3);

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
import { getUnifiedProviders, SERVER_VISIBILITY_DEFAULTS } from "@/lib/site-settings";
import * as providerPartner from "@/lib/provider-partner";
import {
  runPurchaseSaga,
  type SagaStore,
  type BeginDispatchInput,
  type BeginDispatchResult,
  type ConfirmDispatchInput,
  type CompensateDispatchInput,
  type DispatchRecord,
} from "@/lib/partner-saga";
import {
  isPartnerSupplyEnabledForUser,
  isPartnerPurchaseAllowed,
  canOperateExistingPartnerOrder,
  getPartnerLayananForUser,
  invalidatePartnerFlagCache,
  PARTNER_SUPPLY_ENABLED_KEY,
  PARTNER_SUPPLY_ALLOWLIST_KEY,
} from "@/lib/partner-flag";

// ==================== Fixtures ====================

const BUYER = "buyer-e2e-17-7";
const PARTNER_ORDER_ID = "pluto-order-uuid-abc123";
const RESERVED_NUMBER = "+6281234567890";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Wire SiteSetting rows for the flag/allowlist reads (DB is the source of truth). */
function stubSettings(rows: Record<string, string | null>) {
  mocks.findUnique.mockImplementation(
    async ({ where: { key } }: { where: { key: string } }) => {
      const value = rows[key];
      return value === undefined || value === null ? null : { key, value };
    },
  );
}

/**
 * In-memory SagaStore mirroring the Prisma store's exactly-once semantics. It
 * keeps dispatch + linked buyer-order records so the test can prove that
 * turning the flag off HIDES new supply without DELETING existing data.
 */
class InMemorySagaStore implements SagaStore {
  readonly dispatches = new Map<string, DispatchRecord>();
  readonly orders: Array<{ id: string; providerOrderRef: string; status: string }> = [];
  private seq = 0;

  async beginDispatch(input: BeginDispatchInput): Promise<BeginDispatchResult> {
    const existing = [...this.dispatches.values()].find(
      (d) => d.purchaseKey === input.purchaseKey,
    );
    if (existing) return { ok: true, dispatch: { ...existing }, reason: "DUPLICATE" };

    const id = `disp-${++this.seq}`;
    const rec: DispatchRecord = {
      id,
      purchaseKey: input.purchaseKey,
      reserveKey: input.reserveKey,
      status: "pending",
      userId: input.userId,
      orderId: null,
      buyerOrderRef: input.buyerOrderRef,
      buyerAccountRef: input.buyerAccountRef,
      providerOrderRef: null,
      providerRequestRef: null,
      amount: input.amount,
      debitApplied: true,
      refundApplied: false,
      attempts: 0,
      lastError: null,
    };
    this.dispatches.set(id, rec);
    return { ok: true, dispatch: { ...rec } };
  }

  async confirmDispatch(input: ConfirmDispatchInput): Promise<DispatchRecord> {
    const rec = this.dispatches.get(input.dispatchId);
    if (!rec) throw new Error("dispatch not found");
    if (["pending", "unknown", "compensating"].includes(rec.status)) {
      rec.status = "confirmed";
      rec.providerOrderRef = input.providerOrderRef;
      rec.providerRequestRef = input.providerRequestRef;
      if (input.order && !rec.orderId && rec.userId) {
        const orderId = `order-${++this.seq}`;
        this.orders.push({
          id: orderId,
          providerOrderRef: input.providerOrderRef,
          status: "waiting",
        });
        rec.orderId = orderId;
      }
    }
    return { ...rec };
  }

  async compensateDispatch(input: CompensateDispatchInput): Promise<DispatchRecord> {
    const rec = this.dispatches.get(input.dispatchId);
    if (!rec) throw new Error("dispatch not found");
    if (
      rec.debitApplied &&
      !rec.refundApplied &&
      ["pending", "unknown", "compensating"].includes(rec.status)
    ) {
      rec.status = "compensated";
      rec.refundApplied = true;
      rec.lastError = input.reason;
    }
    return { ...rec };
  }

  async markUnknown(input: { dispatchId: string; error: string | null }): Promise<DispatchRecord> {
    const rec = this.dispatches.get(input.dispatchId);
    if (!rec) throw new Error("dispatch not found");
    if (rec.status === "pending") {
      rec.status = "unknown";
      rec.attempts += 1;
      rec.lastError = input.error;
    }
    return { ...rec };
  }

  async getByPurchaseKey(purchaseKey: string): Promise<DispatchRecord | null> {
    const rec = [...this.dispatches.values()].find((d) => d.purchaseKey === purchaseKey);
    return rec ? { ...rec } : null;
  }

  async listUnknownDispatches(limit: number): Promise<DispatchRecord[]> {
    return [...this.dispatches.values()]
      .filter((d) => d.status === "unknown")
      .slice(0, limit)
      .map((d) => ({ ...d }));
  }
}

/** Route the mocked Internal API by method+endpoint (the HTTP seam). */
function installPartnerApiRouter() {
  mocks.internalApiRequest.mockImplementation(
    async (req: { method: string; endpoint: string }) => {
      const { method, endpoint } = req;
      if (method === "GET" && endpoint.startsWith("/inventory")) {
        return {
          data: {
            available: 3,
            retailPriceIdr: 1400,
            currency: "IDR",
            quoteVersion: "1",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
          requestId: "r-inventory",
        };
      }
      if (method === "POST" && endpoint === "/orders/reserve") {
        return {
          data: {
            partnerOrderId: PARTNER_ORDER_ID,
            number: RESERVED_NUMBER,
            status: "waiting_sms",
            snapshot: {
              serviceCode: "wa",
              countryCode: "ID",
              operatorCode: "any",
              canonicalNumber: RESERVED_NUMBER,
              basePriceIdr: 1000,
              retailPriceIdr: 1400,
              payoutIdr: 1000,
              platformMarginIdr: 400,
              currency: "IDR",
              configVersion: 1,
            },
            expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
          },
          requestId: "r-reserve",
        };
      }
      if (method === "POST" && endpoint.endsWith("/cancel")) {
        return {
          data: {
            partnerOrderId: PARTNER_ORDER_ID,
            status: "cancelled",
            terminalReason: "BUYER_CANCEL",
            releaseDisposition: "released",
          },
          requestId: "r-cancel",
        };
      }
      if (method === "GET" && endpoint.startsWith("/orders/")) {
        return {
          data: {
            partnerOrderId: PARTNER_ORDER_ID,
            status: "waiting_sms",
            otp: null,
            terminalReason: null,
          },
          requestId: "r-status",
        };
      }
      throw new Error(`unexpected partner endpoint ${method} ${endpoint}`);
    },
  );
}

/**
 * Assert the existing (non-partner) dispatcher keeps working regardless of the
 * Pluto flag state — Req 22.5 / 1.3. A DB-backed provider (api3) still routes
 * to its module, a JasaOTP provider (api1) still reaches the HTTP path, and the
 * `unified` router guard is intact and never includes Pluto.
 */
async function assertExistingProvidersUnaffected() {
  const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(200, { success: true, id: 1 }));
  vi.stubGlobal("fetch", fetchMock);

  const negara = await otp.getNegara("api3");
  expect(mocks.p3.getNegara).toHaveBeenCalled();
  expect(negara).toEqual({ success: true, data: [{ id_negara: 1, nama_negara: "api3" }] });

  await otp.createOrder("api1", 1, "wa", "any");
  expect(fetchMock).toHaveBeenCalled();
  expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/order.php");

  // Existing-order Pluto ops stay available in EVERY state (reversible gating).
  expect(canOperateExistingPartnerOrder(true)).toBe(true);

  // `unified` (Bimasakti) is a separate router and never touches Pluto.
  await expect(otp.getNegara("unified")).rejects.toThrow("Use unified-provider");
  const unified = await getUnifiedProviders();
  expect(unified).not.toContain("partner");
  expect(SERVER_VISIBILITY_DEFAULTS.unifiedProviders).not.toContain("partner");

  vi.unstubAllGlobals();
}

// ==================== Shared state across the ordered phases ====================

const store = new InMemorySagaStore();

const PURCHASE_INPUT = {
  userId: BUYER,
  amount: 1400,
  purchaseKey: "pk-e2e-17-7",
  reserveKey: "rk-e2e-17-7",
  buyerOrderRef: "bor-e2e-17-7",
  buyerAccountRef: "bar-e2e-17-7",
  quoteVersion: "1",
  order: {
    service: "wa",
    serviceName: "WhatsApp",
    country: "ID",
    countryId: 62,
    operator: "any",
    source: "web",
    price: 1400,
  },
} as const;

beforeAll(() => {
  delete process.env.PARTNER_SUPPLY_ENABLED;
  delete process.env.PARTNER_SUPPLY_ALLOWLIST;
  mocks.isPartnerClientConfigured.mockReturnValue(true);
  installPartnerApiRouter();
  // Identifiable return for the existing api3 provider module.
  mocks.p3.getNegara.mockResolvedValue({
    success: true,
    data: [{ id_negara: 1, nama_negara: "api3" }],
  });
  mocks.p3.createOrder.mockResolvedValue({ success: true, id: "api3-order" });
  invalidatePartnerFlagCache();
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  invalidatePartnerFlagCache();
  delete process.env.PARTNER_SUPPLY_ENABLED;
  delete process.env.PARTNER_SUPPLY_ALLOWLIST;
});

// ==================== The temporal E2E sequence ====================

describe("disable private beta after a Pluto order exists (task 17.7)", () => {
  it("Phase 1: flag ON + allowlisted → buyer discovers Pluto and an order is created", async () => {
    stubSettings({
      [PARTNER_SUPPLY_ENABLED_KEY]: "true",
      [PARTNER_SUPPLY_ALLOWLIST_KEY]: `["${BUYER}"]`,
    });
    invalidatePartnerFlagCache();

    // Discovery + purchase are both open for the eligible buyer.
    expect(await isPartnerSupplyEnabledForUser(BUYER)).toBe(true);
    expect(await isPartnerPurchaseAllowed(BUYER)).toBe(true);

    // The catalog exposes the available Pluto supply.
    const catalog = await getPartnerLayananForUser(BUYER, 62);
    expect(catalog).toEqual({
      "62": { wa: { harga: 1400, stok: 3, layanan: "WhatsApp" } },
    });

    // A Pluto order is created through the real saga + real provider surface,
    // with only the reserve HTTP boundary mocked.
    const outcome = await runPurchaseSaga(PURCHASE_INPUT, { store });
    expect(outcome.status).toBe("confirmed");
    if (outcome.status !== "confirmed") throw new Error("expected confirmed outcome");
    expect(outcome.dispatch.providerOrderRef).toBe(PARTNER_ORDER_ID);
    expect(outcome.dispatch.orderId).toBeTruthy();

    // The dispatch + linked buyer order are now persisted.
    expect(store.dispatches.size).toBe(1);
    expect(store.orders).toHaveLength(1);
    expect(store.orders[0].providerOrderRef).toBe(PARTNER_ORDER_ID);

    await assertExistingProvidersUnaffected();
  });

  it("Phase 2: flag OFF → new supply hidden, no discovery API call, no data deleted", async () => {
    // Turn the master flag OFF (buyer stays on the allowlist to prove the flag
    // alone gates discovery — no DB rollback, Req 22.7).
    stubSettings({
      [PARTNER_SUPPLY_ENABLED_KEY]: "false",
      [PARTNER_SUPPLY_ALLOWLIST_KEY]: `["${BUYER}"]`,
    });
    invalidatePartnerFlagCache();
    mocks.internalApiRequest.mockClear();

    // New discovery + purchase are hidden.
    expect(await isPartnerSupplyEnabledForUser(BUYER)).toBe(false);
    expect(await isPartnerPurchaseAllowed(BUYER)).toBe(false);

    const catalog = await getPartnerLayananForUser(BUYER, 62);
    expect(catalog).toEqual({ "62": {} });

    // Gated off BEFORE any partner API discovery call is attempted.
    expect(mocks.internalApiRequest).not.toHaveBeenCalled();

    // Req 17.6 / 22.7: no data was deleted — the existing order/dispatch record
    // created in Phase 1 is still present (only NEW supply is hidden).
    expect(store.dispatches.size).toBe(1);
    expect(store.orders).toHaveLength(1);
    const dispatch = await store.getByPurchaseKey(PURCHASE_INPUT.purchaseKey);
    expect(dispatch?.status).toBe("confirmed");
    expect(dispatch?.providerOrderRef).toBe(PARTNER_ORDER_ID);

    await assertExistingProvidersUnaffected();
  });

  it("Phase 3: flag OFF → existing Pluto order still supports status read + cancel", async () => {
    // Flag remains OFF (also drop the buyer from the allowlist to be thorough).
    stubSettings({
      [PARTNER_SUPPLY_ENABLED_KEY]: "false",
      [PARTNER_SUPPLY_ALLOWLIST_KEY]: `[]`,
    });
    invalidatePartnerFlagCache();
    mocks.internalApiRequest.mockClear();

    // Discovery/purchase still hidden...
    expect(await isPartnerSupplyEnabledForUser(BUYER)).toBe(false);
    expect(await isPartnerPurchaseAllowed(BUYER)).toBe(false);

    // ...but existing-order operations are ALWAYS operable (reversible gating).
    expect(canOperateExistingPartnerOrder(true)).toBe(true);

    // Status read on the existing order still works through the provider surface.
    const status = await providerPartner.getOrderStatus(PARTNER_ORDER_ID);
    expect(status.partnerOrderId).toBe(PARTNER_ORDER_ID);
    expect(status.status).toBe("waiting_sms");

    // Cancel on the existing order still works.
    const terminal = await providerPartner.cancelPartnerOrder({
      partnerOrderId: PARTNER_ORDER_ID,
      reason: "BUYER_CANCEL",
      actorRef: BUYER,
      idempotencyKey: "cancel-e2e-17-7",
    });
    expect(terminal.status).toBe("cancelled");
    expect(terminal.partnerOrderId).toBe(PARTNER_ORDER_ID);

    // Both operations reached the (mocked) partner API even with the flag off.
    const endpoints = mocks.internalApiRequest.mock.calls.map(
      (c) => (c[0] as { method: string; endpoint: string }),
    );
    expect(endpoints).toContainEqual(
      expect.objectContaining({ method: "GET", endpoint: `/orders/${PARTNER_ORDER_ID}` }),
    );
    expect(endpoints).toContainEqual(
      expect.objectContaining({ method: "POST", endpoint: `/orders/${PARTNER_ORDER_ID}/cancel` }),
    );

    // Records/audit trail remain intact — nothing was deleted by disabling.
    expect(store.dispatches.size).toBe(1);
    expect(store.orders).toHaveLength(1);
    expect(store.orders[0].providerOrderRef).toBe(PARTNER_ORDER_ID);

    await assertExistingProvidersUnaffected();
  });

  it("Phase 4: existing non-partner providers remain unaffected after the toggle", async () => {
    // Independent of the flag state at the end of the sequence.
    await assertExistingProvidersUnaffected();
  });
});
