/**
 * Tests for the Pluto purchase saga (task 9.7, design section 5).
 *
 * Covers:
 *   - the pure saga state machine (transitions, terminal absorbing, illegal
 *     conflict detection);
 *   - reserve-error and partner-status classification;
 *   - exactly-once debit and refund (Req 20.5) via an in-memory store that
 *     mirrors the Prisma conditional (CAS + flag) semantics;
 *   - the full debit-reserve-confirm-compensate orchestration and the
 *     reconciliation resolver for `unknown` outcomes.
 *
 * The in-memory store deliberately reproduces the exact-once guards (unique
 * purchaseKey for debit; refundApplied flag for refund) so the exactly-once
 * properties are exercised against the same logic the Prisma store relies on.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { PartnerApiError } from "./partner-client";
import type {
  PartnerReserveResult,
  PartnerReconciliationResult,
  PartnerOrderStatus,
} from "./provider-partner";
import {
  applyEvent,
  classifyReserveError,
  classifyPartnerStatus,
  isTerminal,
  runPurchaseSaga,
  resolveUnknownDispatch,
  type SagaStatus,
  type SagaEvent,
  type SagaStore,
  type DispatchRecord,
  type BeginDispatchInput,
  type BeginDispatchResult,
  type ConfirmDispatchInput,
  type CompensateDispatchInput,
} from "./partner-saga";

// ==================== In-memory store (mirrors Prisma exactly-once) ====================

class InMemorySagaStore implements SagaStore {
  balances = new Map<string, number>();
  dispatches = new Map<string, DispatchRecord>(); // by id
  orders: Array<{ id: string; userId: string; number: string; providerOrderRef: string }> = [];
  private seq = 0;

  constructor(initialBalances: Record<string, number> = {}) {
    for (const [k, v] of Object.entries(initialBalances)) this.balances.set(k, v);
  }

  private byPurchaseKey(purchaseKey: string): DispatchRecord | undefined {
    for (const d of this.dispatches.values()) {
      if (d.purchaseKey === purchaseKey) return d;
    }
    return undefined;
  }

  async beginDispatch(input: BeginDispatchInput): Promise<BeginDispatchResult> {
    const existing = this.byPurchaseKey(input.purchaseKey);
    if (existing) return { ok: true, dispatch: { ...existing }, reason: "DUPLICATE" };

    const bal = this.balances.get(input.userId) ?? 0;
    if (bal < input.amount) return { ok: false, reason: "INSUFFICIENT_BALANCE" };

    // Atomic debit + create (single-threaded JS => models the DB transaction).
    this.balances.set(input.userId, bal - input.amount);
    const id = `d${++this.seq}`;
    const record: DispatchRecord = {
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
    this.dispatches.set(id, record);
    return { ok: true, dispatch: { ...record } };
  }

  async confirmDispatch(input: ConfirmDispatchInput): Promise<DispatchRecord> {
    const d = this.dispatches.get(input.dispatchId);
    if (!d) throw new Error("dispatch not found");
    // CAS: only advance from a non-terminal state.
    if (d.status === "pending" || d.status === "unknown" || d.status === "compensating") {
      d.status = "confirmed";
      d.providerOrderRef = input.providerOrderRef;
      d.providerRequestRef = input.providerRequestRef;
      if (input.order && !d.orderId && d.userId) {
        const oid = `o${++this.seq}`;
        this.orders.push({
          id: oid,
          userId: d.userId,
          number: input.order.number,
          providerOrderRef: input.providerOrderRef,
        });
        d.orderId = oid;
      }
    }
    return { ...d };
  }

  async compensateDispatch(input: CompensateDispatchInput): Promise<DispatchRecord> {
    const d = this.dispatches.get(input.dispatchId);
    if (!d) throw new Error("dispatch not found");
    // Conditional refund — exactly-once.
    const claimable =
      d.debitApplied &&
      !d.refundApplied &&
      (d.status === "pending" || d.status === "unknown" || d.status === "compensating");
    if (claimable) {
      d.status = "compensated";
      d.refundApplied = true;
      d.lastError = input.reason;
      if (d.userId) {
        this.balances.set(d.userId, (this.balances.get(d.userId) ?? 0) + d.amount);
      }
    }
    return { ...d };
  }

  async markUnknown(input: { dispatchId: string; error: string | null }): Promise<DispatchRecord> {
    const d = this.dispatches.get(input.dispatchId);
    if (!d) throw new Error("dispatch not found");
    if (d.status === "pending") {
      d.status = "unknown";
      d.attempts += 1;
      d.lastError = input.error;
    }
    return { ...d };
  }

  async getByPurchaseKey(purchaseKey: string): Promise<DispatchRecord | null> {
    const d = this.byPurchaseKey(purchaseKey);
    return d ? { ...d } : null;
  }

  async listUnknownDispatches(limit: number): Promise<DispatchRecord[]> {
    return [...this.dispatches.values()]
      .filter((d) => d.status === "unknown")
      .slice(0, limit)
      .map((d) => ({ ...d }));
  }
}

// ==================== Fixtures ====================

const RESERVE_OK: PartnerReserveResult = {
  partnerOrderId: "partner-order-uuid-1",
  number: "+6281234567890",
  status: "waiting_sms",
  snapshot: {
    serviceCode: "wa",
    countryCode: "ID",
    operatorCode: "any",
    canonicalNumber: "+6281234567890",
    basePriceIdr: 1000,
    retailPriceIdr: 3000,
    payoutIdr: 1500,
    platformMarginIdr: 500,
    currency: "IDR",
    configVersion: 1,
  },
  expiresAt: new Date().toISOString(),
};

function purchaseInput(over: Partial<Parameters<typeof runPurchaseSaga>[0]> = {}) {
  return {
    userId: "user-1",
    amount: 3000,
    purchaseKey: "buy-1",
    reserveKey: "reserve-1",
    buyerOrderRef: "bor-1",
    buyerAccountRef: "bar-1",
    quoteVersion: "q1",
    order: {
      service: "wa",
      serviceName: "WhatsApp",
      country: "indonesia",
      countryId: 62,
      operator: "any",
      source: "web",
      price: 3000,
    },
    ...over,
  };
}

function deps(store: InMemorySagaStore, over: Record<string, unknown> = {}) {
  return {
    store,
    reserveOrder: async () => RESERVE_OK,
    reconcileOrders: async (): Promise<PartnerReconciliationResult[]> => [],
    getOrderStatus: async (): Promise<PartnerOrderStatus> => ({
      partnerOrderId: "partner-order-uuid-1",
      status: "waiting_sms",
      otp: null,
      terminalReason: null,
    }),
    ...over,
  };
}

// ==================== Pure state machine ====================

describe("applyEvent — pure saga state machine", () => {
  it("pending resolves on each reserve outcome", () => {
    expect(applyEvent("pending", "reserve_success")).toMatchObject({ next: "confirmed", link: true, refund: false });
    expect(applyEvent("pending", "reserve_definitive_failure")).toMatchObject({ next: "compensated", refund: true });
    expect(applyEvent("pending", "reserve_unknown")).toMatchObject({ next: "unknown", refund: false, link: false });
  });

  it("unknown resolves via reconciliation", () => {
    expect(applyEvent("unknown", "reconcile_confirmed")).toMatchObject({ next: "confirmed", link: true, refund: false });
    expect(applyEvent("unknown", "reconcile_compensate")).toMatchObject({ next: "compensated", refund: true });
    expect(applyEvent("unknown", "reconcile_unknown")).toMatchObject({ next: "unknown", noop: true });
  });

  it("confirmed is absorbing and rejects a compensating event", () => {
    expect(applyEvent("confirmed", "reserve_success")).toMatchObject({ next: "confirmed", noop: true });
    expect(applyEvent("confirmed", "reconcile_confirmed")).toMatchObject({ next: "confirmed", noop: true });
    expect(applyEvent("confirmed", "reconcile_compensate")).toMatchObject({ illegal: true });
    expect(applyEvent("confirmed", "reserve_definitive_failure")).toMatchObject({ illegal: true });
  });

  it("compensated is absorbing and rejects a confirming event", () => {
    expect(applyEvent("compensated", "reconcile_compensate")).toMatchObject({ next: "compensated", noop: true });
    expect(applyEvent("compensated", "reserve_definitive_failure")).toMatchObject({ next: "compensated", noop: true });
    expect(applyEvent("compensated", "reconcile_confirmed")).toMatchObject({ illegal: true });
    expect(applyEvent("compensated", "reserve_success")).toMatchObject({ illegal: true });
  });

  it("marks only confirmed and compensated as terminal", () => {
    expect(isTerminal("confirmed")).toBe(true);
    expect(isTerminal("compensated")).toBe(true);
    expect(isTerminal("pending")).toBe(false);
    expect(isTerminal("unknown")).toBe(false);
    expect(isTerminal("compensating")).toBe(false);
  });
});

describe("classifyReserveError", () => {
  it("routes retryable errors to unknown (reconcile) and definitive errors to compensate", () => {
    expect(classifyReserveError(new PartnerApiError("PARTNER_UNAVAILABLE", 0, true))).toBe("unknown");
    expect(classifyReserveError(new PartnerApiError("PARTNER_RATE_LIMITED", 429, true))).toBe("unknown");
    expect(classifyReserveError(new PartnerApiError("PARTNER_CONFLICT", 409, false))).toBe("definitive");
    expect(classifyReserveError(new PartnerApiError("PARTNER_BAD_REQUEST", 400, false))).toBe("definitive");
    expect(classifyReserveError(new PartnerApiError("PARTNER_NOT_FOUND", 404, false))).toBe("definitive");
  });
});

describe("classifyPartnerStatus", () => {
  it("maps active/success to confirm, terminal-non-success/missing to compensate, in-flight to unknown", () => {
    expect(classifyPartnerStatus("reserved")).toBe("reconcile_confirmed");
    expect(classifyPartnerStatus("waiting_sms")).toBe("reconcile_confirmed");
    expect(classifyPartnerStatus("success")).toBe("reconcile_confirmed");
    expect(classifyPartnerStatus("timeout")).toBe("reconcile_compensate");
    expect(classifyPartnerStatus("cancelled")).toBe("reconcile_compensate");
    expect(classifyPartnerStatus("not_found")).toBe("reconcile_compensate");
    expect(classifyPartnerStatus(null)).toBe("reconcile_compensate");
    expect(classifyPartnerStatus("created")).toBe("reconcile_unknown");
    expect(classifyPartnerStatus("weird")).toBe("reconcile_unknown");
  });
});

// ==================== Orchestration ====================

describe("runPurchaseSaga", () => {
  it("confirms and links a buyer order on reserve success, debiting exactly once", async () => {
    const store = new InMemorySagaStore({ "user-1": 10000 });
    const out = await runPurchaseSaga(purchaseInput(), deps(store));

    expect(out.status).toBe("confirmed");
    expect(store.balances.get("user-1")).toBe(7000); // 10000 - 3000
    expect(store.orders).toHaveLength(1);
    expect(store.orders[0].providerOrderRef).toBe("partner-order-uuid-1");
    const d = out.status === "confirmed" ? out.dispatch : null;
    expect(d?.debitApplied).toBe(true);
    expect(d?.refundApplied).toBe(false);
    expect(d?.orderId).toBeTruthy();
  });

  it("compensates (refund once) on a definitive Partner failure without creating an order", async () => {
    const store = new InMemorySagaStore({ "user-1": 10000 });
    const failing = deps(store, {
      reserveOrder: async () => {
        throw new PartnerApiError("PARTNER_CONFLICT", 409, false);
      },
    });
    const out = await runPurchaseSaga(purchaseInput(), failing);

    expect(out.status).toBe("compensated");
    expect(store.balances.get("user-1")).toBe(10000); // debited then refunded
    expect(store.orders).toHaveLength(0);
  });

  it("marks unknown (no refund) on a retryable Partner failure", async () => {
    const store = new InMemorySagaStore({ "user-1": 10000 });
    const flaky = deps(store, {
      reserveOrder: async () => {
        throw new PartnerApiError("PARTNER_UNAVAILABLE", 0, true);
      },
    });
    const out = await runPurchaseSaga(purchaseInput(), flaky);

    expect(out.status).toBe("unknown");
    expect(store.balances.get("user-1")).toBe(7000); // debited, NOT refunded yet
    expect(store.orders).toHaveLength(0);
  });

  it("returns insufficient_balance without debiting or calling Partner", async () => {
    const store = new InMemorySagaStore({ "user-1": 1000 });
    let called = false;
    const out = await runPurchaseSaga(
      purchaseInput(),
      deps(store, {
        reserveOrder: async () => {
          called = true;
          return RESERVE_OK;
        },
      }),
    );

    expect(out.status).toBe("insufficient_balance");
    expect(store.balances.get("user-1")).toBe(1000);
    expect(called).toBe(false);
  });

  it("is idempotent on retry with the same purchaseKey (no double charge)", async () => {
    const store = new InMemorySagaStore({ "user-1": 10000 });
    const d = deps(store);
    const first = await runPurchaseSaga(purchaseInput(), d);
    const second = await runPurchaseSaga(purchaseInput(), d);

    expect(first.status).toBe("confirmed");
    expect(second.status).toBe("confirmed");
    expect(store.balances.get("user-1")).toBe(7000); // charged once
    expect(store.orders).toHaveLength(1);
  });
});

// ==================== Reconciliation ====================

describe("resolveUnknownDispatch", () => {
  async function makeUnknown(store: InMemorySagaStore) {
    const flaky = deps(store, {
      reserveOrder: async () => {
        throw new PartnerApiError("PARTNER_UNAVAILABLE", 0, true);
      },
    });
    const out = await runPurchaseSaga(purchaseInput(), flaky);
    if (out.status !== "unknown") throw new Error("expected unknown");
    return out.dispatch;
  }

  it("compensates an unknown dispatch when Partner has no live reservation", async () => {
    const store = new InMemorySagaStore({ "user-1": 10000 });
    const dispatch = await makeUnknown(store);

    const outcome = await resolveUnknownDispatch(
      dispatch,
      deps(store, {
        reconcileOrders: async (): Promise<PartnerReconciliationResult[]> => [
          { buyerOrderRef: "bor-1", providerOrderRef: null, status: "timeout" },
        ],
      }),
    );

    expect(outcome.to).toBe("compensated");
    expect(store.balances.get("user-1")).toBe(10000); // refunded exactly once
  });

  it("confirms an unknown dispatch when Partner holds an active reservation", async () => {
    const store = new InMemorySagaStore({ "user-1": 10000 });
    const dispatch = await makeUnknown(store);

    const outcome = await resolveUnknownDispatch(
      dispatch,
      deps(store, {
        reconcileOrders: async (): Promise<PartnerReconciliationResult[]> => [
          { buyerOrderRef: "bor-1", providerOrderRef: "partner-order-uuid-1", status: "waiting_sms" },
        ],
      }),
    );

    expect(outcome.to).toBe("confirmed");
    expect(store.balances.get("user-1")).toBe(7000); // stays debited, no refund
    // Number unavailable via reconcile -> flagged for manual link.
    expect(outcome.issue).toBeTruthy();
  });

  it("stays unknown when Partner is still in flight", async () => {
    const store = new InMemorySagaStore({ "user-1": 10000 });
    const dispatch = await makeUnknown(store);

    const outcome = await resolveUnknownDispatch(
      dispatch,
      deps(store, {
        reconcileOrders: async (): Promise<PartnerReconciliationResult[]> => [
          { buyerOrderRef: "bor-1", providerOrderRef: null, status: "created" },
        ],
      }),
    );

    expect(outcome.to).toBe("unknown");
    expect(store.balances.get("user-1")).toBe(7000);
  });
});

// ==================== Exactly-once properties ====================

describe("exactly-once debit and refund (Req 20.5)", () => {
  it("repeated beginDispatch on the same purchaseKey debits exactly once", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (retries) => {
        const store = new InMemorySagaStore({ u: 10000 });
        for (let i = 0; i < retries; i++) {
          await store.beginDispatch({
            userId: "u",
            amount: 2500,
            purchaseKey: "pk",
            reserveKey: "rk",
            buyerOrderRef: "bor",
            buyerAccountRef: "bar",
          });
        }
        // Debited once regardless of how many times begin was retried.
        expect(store.balances.get("u")).toBe(7500);
        expect([...store.dispatches.values()]).toHaveLength(1);
      }),
      { numRuns: 50 },
    );
  });

  it("repeated compensateDispatch refunds exactly once", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (retries) => {
        const store = new InMemorySagaStore({ u: 10000 });
        const begin = await store.beginDispatch({
          userId: "u",
          amount: 2500,
          purchaseKey: "pk",
          reserveKey: "rk",
          buyerOrderRef: "bor",
          buyerAccountRef: "bar",
        });
        const id = begin.dispatch!.id;
        for (let i = 0; i < retries; i++) {
          await store.compensateDispatch({ dispatchId: id, reason: "x" });
        }
        // Debit (7500) then a single refund back to 10000.
        expect(store.balances.get("u")).toBe(10000);
        const d = store.dispatches.get(id)!;
        expect(d.refundApplied).toBe(true);
        expect(d.status).toBe("compensated");
      }),
      { numRuns: 50 },
    );
  });

  it("a confirmed dispatch is never refunded and a compensated dispatch is never confirmed", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SagaStatus>("confirmed", "compensated"),
        fc.constantFrom<SagaEvent>(
          "reserve_success",
          "reserve_definitive_failure",
          "reserve_unknown",
          "reconcile_confirmed",
          "reconcile_compensate",
          "reconcile_unknown",
        ),
        (terminal, event) => {
          const t = applyEvent(terminal, event);
          if ("illegal" in t) return; // conflict surfaced, no money moved
          // A legal transition from a terminal state must be a no-op that stays
          // in the same terminal state and never triggers refund/link.
          expect(t.noop).toBe(true);
          expect(t.next).toBe(terminal);
          expect(t.refund).toBe(false);
          expect(t.link).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
