import { describe, it, expect } from "vitest";

import { orderFromPartner, type PartnerOrderDeps } from "@/lib/partner-order";
import { PARTNER_COUNTRY_IDS } from "@/lib/provider-partner";

/**
 * Pluto (Partner Platform) branch of `POST /api/otp/order`.
 *
 * This is the demand-side entry point for partner supply, grafted onto a route
 * that serves real customers, so the properties worth pinning are the ones that
 * protect them:
 *
 *  - **The gates actually close.** Pluto is a private beta. An un-admitted buyer
 *    must be told the server is unavailable and must never reach the saga — no
 *    remote reserve, no debit.
 *  - **The buyer's money is never left behind.** A compensated saga means the
 *    debit was reversed, so the buyer is whole and must see a stockout, not a
 *    success. An `unknown` outcome must NOT be reported as success, because the
 *    reconciler has not yet established what Partner actually did.
 *  - **Errors reuse the existing vocabulary**, so the buy page needs no new
 *    handling for a new provider.
 *
 * Dependencies are injected, so nothing here touches the database, the network,
 * or the Partner platform.
 */
const USER_ID = "user-1";
const ORDER_ROW = { id: "order-row-1", number: "+628123456789" };

const INVENTORY = {
  available: true as unknown as number,
  retailPriceIdr: 900,
  currency: "IDR",
  quoteVersion: "1",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

const DISPATCH = {
  id: "dispatch-1",
  purchaseKey: "pk-1",
  reserveKey: "rk-1",
  status: "confirmed" as const,
  userId: USER_ID,
  orderId: ORDER_ROW.id,
  buyerOrderRef: "buyer-ref-1",
  buyerAccountRef: "acct-ref-1",
  providerOrderRef: "partner-order-uuid-1",
  providerRequestRef: "partner-request-uuid-1",
  amount: 900,
  debitApplied: true,
  refundApplied: false,
  attempts: 1,
  lastError: null,
};

interface Calls {
  inventory: number;
  saga: number;
  sagaInput: Record<string, unknown> | null;
}

function makeDeps(
  over: Partial<PartnerOrderDeps> = {},
): { deps: Partial<PartnerOrderDeps>; calls: Calls } {
  const calls: Calls = { inventory: 0, saga: 0, sagaInput: null };
  const deps: Partial<PartnerOrderDeps> = {
    isAdmitted: async () => true,
    loadUser: async () => ({ status: "active", balance: 10_000 }),
    getInventory: (async () => {
      calls.inventory += 1;
      return INVENTORY;
    }) as PartnerOrderDeps["getInventory"],
    runSaga: (async (input: Record<string, unknown>) => {
      calls.saga += 1;
      calls.sagaInput = input;
      return { status: "confirmed", dispatch: DISPATCH };
    }) as unknown as PartnerOrderDeps["runSaga"],
    loadOrder: async () => ORDER_ROW,
    ...over,
  };
  return { deps, calls };
}

function baseInput(over: Record<string, unknown> = {}) {
  return {
    userId: USER_ID,
    negara: PARTNER_COUNTRY_IDS.ID,
    layanan: "wa",
    operator: "any",
    serviceName: "WhatsApp",
    countryName: "indonesia",
    ...over,
  } as Parameters<typeof orderFromPartner>[0];
}

async function body(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe("orderFromPartner — private-beta gates", () => {
  it("refuses a buyer the flag/allowlist does not admit, without touching the saga", async () => {
    const { deps, calls } = makeDeps({ isAdmitted: async () => false });

    const res = await orderFromPartner(baseInput(), deps);

    expect(res.status).toBe(403);
    // Same wording the shared path uses for a hidden server: an un-admitted buyer
    // must not be able to tell Pluto exists.
    expect((await body(res)).error).toBe("Server tidak tersedia. Silakan pilih server lain.");
    // Nothing remote happened: no quote fetched, no reserve, no debit.
    expect(calls.inventory).toBe(0);
    expect(calls.saga).toBe(0);
  });

  it("refuses a country id that is not mapped to an ISO code", async () => {
    const { deps, calls } = makeDeps();

    const res = await orderFromPartner(baseInput({ negara: 9_999 }), deps);

    expect(res.status).toBe(404);
    expect(calls.saga).toBe(0);
  });

  it("refuses a banned account before any remote call", async () => {
    const { deps, calls } = makeDeps({
      loadUser: async () => ({ status: "banned", balance: 10_000 }),
    });

    const res = await orderFromPartner(baseInput(), deps);

    expect(res.status).toBe(403);
    expect((await body(res)).error).toBe("Akun Anda telah diblokir. Hubungi admin.");
    expect(calls.inventory).toBe(0);
    expect(calls.saga).toBe(0);
  });
});

describe("orderFromPartner — quote and stock", () => {
  it("reports a stockout when the supplier has no number", async () => {
    const { deps, calls } = makeDeps({
      getInventory: (async () => ({ ...INVENTORY, available: 0 })) as PartnerOrderDeps["getInventory"],
    });

    const res = await orderFromPartner(baseInput(), deps);

    expect(res.status).toBe(409);
    expect((await body(res)).message).toBe("Stok habis");
    expect(calls.saga).toBe(0);
  });

  it("treats a supplier outage as a retryable server problem, never a charge", async () => {
    const { deps, calls } = makeDeps({
      getInventory: (async () => {
        throw new Error("ECONNREFUSED");
      }) as PartnerOrderDeps["getInventory"],
    });

    const res = await orderFromPartner(baseInput(), deps);

    expect(res.status).toBe(503);
    expect(calls.saga).toBe(0);
  });

  it("refuses when the balance cannot cover the supplier's quote", async () => {
    const { deps, calls } = makeDeps({
      loadUser: async () => ({ status: "active", balance: 100 }),
    });

    const res = await orderFromPartner(baseInput(), deps);

    expect(res.status).toBe(402);
    expect((await body(res)).error).toBe("Saldo tidak cukup. Silakan deposit terlebih dahulu.");
    // The pre-check exists precisely to avoid a remote reserve we cannot pay for.
    expect(calls.saga).toBe(0);
  });

  it("passes the supplier's own price and quote version into the saga", async () => {
    const { deps, calls } = makeDeps();

    await orderFromPartner(baseInput(), deps);

    expect(calls.saga).toBe(1);
    const sent = calls.sagaInput!;
    // The charge is the supplier's authoritative retail price, not a client value
    // and not our own pricing rules.
    expect(sent.amount).toBe(INVENTORY.retailPriceIdr);
    expect(sent.quoteVersion).toBe(String(INVENTORY.quoteVersion));
    // Partner speaks ISO-2 even though the id on screen is numeric.
    expect(sent.country).toBe("ID");
    // Buyer identity is pseudonymous: the Main user id must never be sent.
    expect(String(sent.buyerAccountRef)).not.toContain(USER_ID);
    expect(String(sent.buyerAccountRef)).toMatch(/^[0-9a-f]{64}$/);
    // The debit and the remote reserve share one key, so a retry cannot double-charge.
    expect(sent.purchaseKey).toBe(sent.reserveKey);
  });
});

describe("orderFromPartner — saga outcomes never lose the buyer's money", () => {
  it("returns the order and number on a confirmed purchase", async () => {
    const { deps } = makeDeps();

    const res = await orderFromPartner(baseInput(), deps);

    expect(res.status).toBe(200);
    const payload = (await body(res)).data as Record<string, unknown>;
    expect(payload.order_id).toBe(DISPATCH.providerOrderRef);
    expect(payload.number).toBe(ORDER_ROW.number);
    expect(payload.id).toBe(ORDER_ROW.id);
  });

  it("reports a compensated purchase as a stockout, since the debit was reversed", async () => {
    const { deps } = makeDeps({
      runSaga: (async () => ({
        status: "compensated",
        dispatch: { ...DISPATCH, status: "compensated", refundApplied: true },
        reason: "OUT_OF_STOCK",
      })) as unknown as PartnerOrderDeps["runSaga"],
    });

    const res = await orderFromPartner(baseInput(), deps);

    expect(res.status).toBe(409);
    const payload = await body(res);
    expect(payload.message).toBe("Stok habis");
    // Critically NOT a success: the buyer got no number.
    expect(payload.success).toBeUndefined();
  });

  it("never reports an unknown outcome as success", async () => {
    const { deps } = makeDeps({
      runSaga: (async () => ({
        status: "unknown",
        dispatch: { ...DISPATCH, status: "unknown" },
      })) as unknown as PartnerOrderDeps["runSaga"],
    });

    const res = await orderFromPartner(baseInput(), deps);

    // 202: neither confirmed nor safely reversed yet — the reconciler decides.
    expect(res.status).toBe(202);
    const payload = await body(res);
    expect(payload.success).toBeUndefined();
    // The buyer is told their balance is safe rather than that the order failed,
    // because a refund may still be pending resolution.
    expect(String(payload.error)).toContain("Saldo Anda aman");
  });

  it("maps an insufficient-balance saga outcome to the shared error", async () => {
    const { deps } = makeDeps({
      runSaga: (async () => ({ status: "insufficient_balance" })) as unknown as PartnerOrderDeps["runSaga"],
    });

    const res = await orderFromPartner(baseInput(), deps);

    expect(res.status).toBe(402);
    expect((await body(res)).error).toBe("Saldo tidak cukup. Silakan deposit terlebih dahulu.");
  });
});
