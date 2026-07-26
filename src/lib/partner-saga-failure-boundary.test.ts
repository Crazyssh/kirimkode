/**
 * Saga failure-boundary integration tests (task 17.3, cross-repo).
 *
 * Drives fault injection (timeout / crash) at every saga boundary and asserts
 * the money-safety invariants survive retry/restart:
 *
 *   - debit boundary            (Main DB conditional debit)
 *   - reserve boundary          (Partner Internal API reserve call)
 *   - persist-link boundary     (Main DB buyer order/link create)
 *   - refund boundary           (Main DB conditional refund / compensation)
 *   - cancel boundary           (Partner Internal API cancel call, HTTP layer)
 *   - reconcile boundary        (Partner Internal API reconciliation call)
 *
 * For each boundary the test crashes the operation either BEFORE its commit
 * (the DB transaction rolls back) or AFTER its commit (the effect persisted but
 * the response was lost), then restarts the saga with the SAME keys and asserts:
 *
 *   - no double debit             (buyer charged at most once)
 *   - no double refund            (buyer refunded at most once)
 *   - no double earning           (at most one linked buyer order == one earning)
 *   - the dispatch state converges (pending -> confirmed | compensated |
 *     resolved-unknown-via-reconcile)
 *   - existing providers stay usable when Partner fails/stockout (Req 22.5)
 *
 * The exactly-once backstops under test are the ones the saga already
 * implements: the unique purchaseKey (debit), the CAS state transition +
 * refundApplied flag (refund/link), and the stable idempotency key sent to the
 * Partner (reserve/cancel/reconcile).
 *
 * _Requirements: 9.6, 17.5, 20.2, 20.5, 22.5_
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { PartnerApiError } from "./partner-client";
import type {
  PartnerReserveResult,
  PartnerReconciliationResult,
  PartnerOrderStatus,
} from "./provider-partner";
import * as providerPartner from "./provider-partner";
import {
  runPurchaseSaga,
  resolveUnknownDispatch,
  type SagaStore,
  type DispatchRecord,
  type BeginDispatchInput,
  type BeginDispatchResult,
  type ConfirmDispatchInput,
  type CompensateDispatchInput,
} from "./partner-saga";

// ==================== Fault-injecting in-memory store ====================
//
// Mirrors the Prisma store's exactly-once guards (unique purchaseKey for debit;
// CAS + refundApplied flag for refund/link) and models a crash as either a
// rollback (before commit) or a lost-response (after commit).

type CrashMode = "before-commit" | "after-commit";
type Op = "begin" | "confirm" | "compensate";

class CrashError extends Error {
  constructor(op: Op, mode: CrashMode) {
    super(`crash ${mode} on ${op}`);
    this.name = "CrashError";
  }
}

class FaultStore implements SagaStore {
  balances = new Map<string, number>();
  dispatches = new Map<string, DispatchRecord>();
  orders: Array<{ id: string; userId: string; number: string; providerOrderRef: string }> = [];
  private seq = 0;
  /** One-shot crash script consumed per call, per operation. */
  private scripts: Record<Op, CrashMode[]> = { begin: [], confirm: [], compensate: [] };

  constructor(initialBalances: Record<string, number> = {}) {
    for (const [k, v] of Object.entries(initialBalances)) this.balances.set(k, v);
  }

  /** Queue a crash for the next call(s) of an operation. */
  crash(op: Op, ...modes: CrashMode[]) {
    this.scripts[op].push(...modes);
  }

  private nextMode(op: Op): CrashMode | null {
    return this.scripts[op].shift() ?? null;
  }

  private byPurchaseKey(purchaseKey: string): DispatchRecord | undefined {
    for (const d of this.dispatches.values()) if (d.purchaseKey === purchaseKey) return d;
    return undefined;
  }

  async beginDispatch(input: BeginDispatchInput): Promise<BeginDispatchResult> {
    // Idempotent retry: an existing dispatch for this purchaseKey never debits
    // again (the unique purchaseKey is the exactly-once boundary).
    const existing = this.byPurchaseKey(input.purchaseKey);
    if (existing) return { ok: true, dispatch: { ...existing }, reason: "DUPLICATE" };

    const bal = this.balances.get(input.userId) ?? 0;
    if (bal < input.amount) return { ok: false, reason: "INSUFFICIENT_BALANCE" };

    const mode = this.nextMode("begin");
    if (mode === "before-commit") throw new CrashError("begin", mode); // rollback: nothing debited

    // Atomic debit + create (single-threaded JS models the DB transaction).
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

    if (mode === "after-commit") throw new CrashError("begin", mode); // committed, response lost
    return { ok: true, dispatch: { ...record } };
  }

  async confirmDispatch(input: ConfirmDispatchInput): Promise<DispatchRecord> {
    const d = this.dispatches.get(input.dispatchId);
    if (!d) throw new Error("dispatch not found");

    const mode = this.nextMode("confirm");
    if (mode === "before-commit") throw new CrashError("confirm", mode);

    // CAS: only advance from a non-terminal state (idempotent when already
    // confirmed -> no duplicate order/earning).
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

    if (mode === "after-commit") throw new CrashError("confirm", mode);
    return { ...d };
  }

  async compensateDispatch(input: CompensateDispatchInput): Promise<DispatchRecord> {
    const d = this.dispatches.get(input.dispatchId);
    if (!d) throw new Error("dispatch not found");

    const mode = this.nextMode("compensate");
    if (mode === "before-commit") throw new CrashError("compensate", mode);

    // Conditional refund — exactly-once (only claims when debited, not yet
    // refunded, and non-terminal).
    const claimable =
      d.debitApplied &&
      !d.refundApplied &&
      (d.status === "pending" || d.status === "unknown" || d.status === "compensating");
    if (claimable) {
      d.status = "compensated";
      d.refundApplied = true;
      d.lastError = input.reason;
      if (d.userId) this.balances.set(d.userId, (this.balances.get(d.userId) ?? 0) + d.amount);
    }

    if (mode === "after-commit") throw new CrashError("compensate", mode);
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
    quoteVersion: "1",
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

function deps(store: FaultStore, over: Record<string, unknown> = {}) {
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

/** Run the saga, tolerating an injected crash (models a process restart). */
async function runTolerant(
  input: ReturnType<typeof purchaseInput>,
  d: ReturnType<typeof deps>,
) {
  try {
    return await runPurchaseSaga(input, d);
  } catch (err) {
    if (err instanceof CrashError) return null; // simulated crash -> caller restarts
    throw err;
  }
}

// ==================== 1. Debit boundary ====================

describe("debit boundary: timeout/crash on conditional debit", () => {
  it("crash BEFORE debit commit rolls back -> retry debits exactly once and converges to confirmed", async () => {
    const store = new FaultStore({ "user-1": 10000 });
    store.crash("begin", "before-commit");

    const first = await runTolerant(purchaseInput(), deps(store));
    expect(first).toBeNull(); // crashed before any debit
    expect(store.balances.get("user-1")).toBe(10000); // rolled back: nothing charged
    expect(store.dispatches.size).toBe(0);

    // Restart with the same purchaseKey.
    const second = await runTolerant(purchaseInput(), deps(store));
    expect(second?.status).toBe("confirmed");
    expect(store.balances.get("user-1")).toBe(7000); // charged exactly once
    expect(store.orders).toHaveLength(1); // exactly one earning-bearing order
  });

  it("crash AFTER debit commit (lost response) -> retry does NOT double debit", async () => {
    const store = new FaultStore({ "user-1": 10000 });
    store.crash("begin", "after-commit");

    const first = await runTolerant(purchaseInput(), deps(store));
    expect(first).toBeNull(); // response lost, but debit persisted
    expect(store.balances.get("user-1")).toBe(7000); // debited once (committed)
    expect(store.dispatches.size).toBe(1);

    // Restart: the persisted dispatch is found by purchaseKey (DUPLICATE) and
    // the saga resumes reserve+confirm without a second debit.
    const second = await runTolerant(purchaseInput(), deps(store));
    expect(second?.status).toBe("confirmed");
    expect(store.balances.get("user-1")).toBe(7000); // still charged exactly once
    expect(store.orders).toHaveLength(1);
  });
});

// ==================== 2. Reserve boundary ====================

describe("reserve boundary: timeout/crash on Partner reserve call", () => {
  it("timeout (retryable) -> unknown (no refund), then reconcile confirms with no double debit/earning", async () => {
    const store = new FaultStore({ "user-1": 10000 });
    const timingOut = deps(store, {
      reserveOrder: async () => {
        throw new PartnerApiError("PARTNER_UNAVAILABLE", 0, true); // timeout/abort
      },
    });

    const out = await runPurchaseSaga(purchaseInput(), timingOut);
    expect(out.status).toBe("unknown");
    expect(store.balances.get("user-1")).toBe(7000); // debited, NOT refunded on unknown
    expect(store.orders).toHaveLength(0);

    // Reconcile: Partner actually holds the reservation -> converge to confirmed.
    const dispatch = out.status === "unknown" ? out.dispatch : null;
    const outcome = await resolveUnknownDispatch(
      dispatch!,
      deps(store, {
        reconcileOrders: async (): Promise<PartnerReconciliationResult[]> => [
          { buyerOrderRef: "bor-1", providerOrderRef: "partner-order-uuid-1", status: "waiting_sms" },
        ],
      }),
    );
    expect(outcome.to).toBe("confirmed");
    expect(store.balances.get("user-1")).toBe(7000); // still charged once, never refunded
  });

  it("timeout -> unknown, then reconcile finds no reservation -> refund exactly once", async () => {
    const store = new FaultStore({ "user-1": 10000 });
    const timingOut = deps(store, {
      reserveOrder: async () => {
        throw new PartnerApiError("PARTNER_UNAVAILABLE", 0, true);
      },
    });

    const out = await runPurchaseSaga(purchaseInput(), timingOut);
    expect(out.status).toBe("unknown");
    const dispatch = out.status === "unknown" ? out.dispatch : null;

    // Reconcile twice (retry) -> refund still happens exactly once.
    const reconcileDeps = deps(store, {
      reconcileOrders: async (): Promise<PartnerReconciliationResult[]> => [
        { buyerOrderRef: "bor-1", providerOrderRef: null, status: "timeout" },
      ],
    });
    const a = await resolveUnknownDispatch(dispatch!, reconcileDeps);
    const b = await resolveUnknownDispatch({ ...dispatch!, status: a.to }, reconcileDeps);

    expect(a.to).toBe("compensated");
    expect(b.to).toBe("compensated");
    expect(store.balances.get("user-1")).toBe(10000); // refunded exactly once
    expect(store.orders).toHaveLength(0);
  });

  it("definitive failure (non-retryable) -> refund once, no order/earning, never throws", async () => {
    const store = new FaultStore({ "user-1": 10000 });
    const stockout = deps(store, {
      reserveOrder: async () => {
        throw new PartnerApiError("PARTNER_CONFLICT", 409, false); // OUT_OF_STOCK / definitive
      },
    });

    const out = await runPurchaseSaga(purchaseInput(), stockout);
    expect(out.status).toBe("compensated");
    expect(store.balances.get("user-1")).toBe(10000); // debited then refunded once
    expect(store.orders).toHaveLength(0);
  });

  it("unexpected (non-Partner) crash -> unknown, never blindly refunds a possibly-live reservation", async () => {
    const store = new FaultStore({ "user-1": 10000 });
    const crashing = deps(store, {
      reserveOrder: async () => {
        throw new Error("socket hang up"); // surprise crash mid-call
      },
    });

    const out = await runPurchaseSaga(purchaseInput(), crashing);
    expect(out.status).toBe("unknown");
    expect(store.balances.get("user-1")).toBe(7000); // held, resolved by reconcile later
  });
});

// ==================== 3. Persist-link boundary ====================

describe("persist-link boundary: timeout/crash while persisting buyer order/link", () => {
  it("crash BEFORE link commit rolls back -> restart re-reserves (same key) and links exactly once", async () => {
    const store = new FaultStore({ "user-1": 10000 });
    store.crash("confirm", "before-commit");

    const reserveCalls = { n: 0 };
    const d = deps(store, {
      reserveOrder: async () => {
        reserveCalls.n += 1;
        return RESERVE_OK; // idempotent: same reserveKey returns the same reservation
      },
    });

    const first = await runTolerant(purchaseInput(), d);
    expect(first).toBeNull(); // crashed before link committed
    expect(store.orders).toHaveLength(0); // nothing linked (rolled back)
    expect(store.balances.get("user-1")).toBe(7000); // already debited

    const second = await runTolerant(purchaseInput(), d);
    expect(second?.status).toBe("confirmed");
    expect(store.orders).toHaveLength(1); // exactly one order == one earning
    expect(store.balances.get("user-1")).toBe(7000); // no double debit
    expect(reserveCalls.n).toBe(2); // re-reserved with the SAME idempotency key
  });

  it("crash AFTER link commit (lost response) -> restart does NOT create a second order/earning", async () => {
    const store = new FaultStore({ "user-1": 10000 });
    store.crash("confirm", "after-commit");

    const first = await runTolerant(purchaseInput(), deps(store));
    expect(first).toBeNull(); // response lost but link committed
    expect(store.orders).toHaveLength(1);
    expect(store.dispatches.size).toBe(1);

    // Restart: dispatch already confirmed -> early return, no second order.
    const second = await runTolerant(purchaseInput(), deps(store));
    expect(second?.status).toBe("confirmed");
    expect(store.orders).toHaveLength(1); // still exactly one earning
    expect(store.balances.get("user-1")).toBe(7000);
  });
});

// ==================== 4. Refund boundary ====================

describe("refund boundary: timeout/crash during compensation", () => {
  it("crash BEFORE refund commit rolls back -> restart refunds exactly once", async () => {
    const store = new FaultStore({ "user-1": 10000 });
    store.crash("compensate", "before-commit");

    const definitive = deps(store, {
      reserveOrder: async () => {
        throw new PartnerApiError("PARTNER_CONFLICT", 409, false);
      },
    });

    const first = await runTolerant(purchaseInput(), definitive);
    expect(first).toBeNull(); // crashed before refund committed
    expect(store.balances.get("user-1")).toBe(7000); // still debited, not yet refunded

    const second = await runTolerant(purchaseInput(), definitive);
    expect(second?.status).toBe("compensated");
    expect(store.balances.get("user-1")).toBe(10000); // refunded exactly once
    expect(store.orders).toHaveLength(0);
  });

  it("crash AFTER refund commit (lost response) -> restart does NOT double refund", async () => {
    const store = new FaultStore({ "user-1": 10000 });
    store.crash("compensate", "after-commit");

    const definitive = deps(store, {
      reserveOrder: async () => {
        throw new PartnerApiError("PARTNER_CONFLICT", 409, false);
      },
    });

    const first = await runTolerant(purchaseInput(), definitive);
    expect(first).toBeNull(); // response lost but refund committed
    expect(store.balances.get("user-1")).toBe(10000); // refunded once (committed)

    const second = await runTolerant(purchaseInput(), definitive);
    expect(second?.status).toBe("compensated");
    expect(store.balances.get("user-1")).toBe(10000); // still exactly one refund
    expect(store.orders).toHaveLength(0);
  });

  it("repeated compensation attempts never over-refund", async () => {
    const store = new FaultStore({ "user-1": 10000 });
    const definitive = deps(store, {
      reserveOrder: async () => {
        throw new PartnerApiError("PARTNER_CONFLICT", 409, false);
      },
    });
    await runPurchaseSaga(purchaseInput(), definitive);
    // Drive several extra compensation retries on the same dispatch.
    const d = [...store.dispatches.values()][0];
    for (let i = 0; i < 5; i++) {
      await store.compensateDispatch({ dispatchId: d.id, reason: "retry" });
    }
    expect(store.balances.get("user-1")).toBe(10000); // still one refund total
  });
});

// ==================== 5. Cancel boundary (HTTP layer) ====================

describe("cancel boundary: timeout/crash on Partner cancel call (idempotency key backstop)", () => {
  function configureEnv() {
    process.env.PARTNER_INTERNAL_API_URL = "https://partner-api.example.com/api/internal/v1";
    process.env.PARTNER_INTERNAL_API_HMAC_CLIENT_ID = "client-1";
    process.env.PARTNER_INTERNAL_API_HMAC_KEY_ID = "key-1";
    process.env.PARTNER_INTERNAL_API_HMAC_SECRET = "secret-secret-secret-secret-01";
  }
  function clearEnv() {
    delete process.env.PARTNER_INTERNAL_API_URL;
    delete process.env.PARTNER_INTERNAL_API_HMAC_CLIENT_ID;
    delete process.env.PARTNER_INTERNAL_API_HMAC_KEY_ID;
    delete process.env.PARTNER_INTERNAL_API_HMAC_SECRET;
  }
  beforeEach(configureEnv);
  afterEach(() => {
    vi.restoreAllMocks();
    clearEnv();
  });

  const terminal = {
    data: { partnerOrderId: "po-1", status: "cancelled", terminalReason: "MAIN_COMPENSATION", releaseDisposition: "released" },
    requestId: "req-1",
  };

  it("transient timeout then success: retry reuses the SAME Idempotency-Key (no double cancel)", async () => {
    const keys: string[] = [];
    let call = 0;
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      call += 1;
      keys.push((init.headers as Record<string, string>)["Idempotency-Key"]);
      if (call === 1) throw new Error("network timeout"); // first attempt times out
      return new Response(JSON.stringify(terminal), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await providerPartner.cancelPartnerOrder({
      partnerOrderId: "po-1",
      reason: "MAIN_COMPENSATION",
      actorRef: "actor-1",
      idempotencyKey: "cancel-key-1",
    });

    expect(result.status).toBe("cancelled");
    expect(fetchMock).toHaveBeenCalledTimes(2); // client retried once
    expect(keys).toEqual(["cancel-key-1", "cancel-key-1"]); // identical key -> Partner dedupes
  });

  it("full crash then operator restart: cancel converges to a single terminal with the same key", async () => {
    const keys: string[] = [];
    // First cancelPartnerOrder call: both attempts crash (client retries once).
    const crashingFetch = vi.fn(async (_url: string, init: RequestInit) => {
      keys.push((init.headers as Record<string, string>)["Idempotency-Key"]);
      throw new Error("connection reset");
    });
    vi.stubGlobal("fetch", crashingFetch);

    await expect(
      providerPartner.cancelPartnerOrder({
        partnerOrderId: "po-1",
        reason: "MAIN_COMPENSATION",
        actorRef: "actor-1",
        idempotencyKey: "cancel-key-1",
      }),
    ).rejects.toBeInstanceOf(PartnerApiError);
    expect(crashingFetch).toHaveBeenCalledTimes(2); // one internal retry, both failed

    // Restart: the operator retries cancel with the SAME key; Partner returns
    // the authoritative terminal result exactly once.
    const okFetch = vi.fn(async (_url: string, init: RequestInit) => {
      keys.push((init.headers as Record<string, string>)["Idempotency-Key"]);
      return new Response(JSON.stringify(terminal), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", okFetch);

    const result = await providerPartner.cancelPartnerOrder({
      partnerOrderId: "po-1",
      reason: "MAIN_COMPENSATION",
      actorRef: "actor-1",
      idempotencyKey: "cancel-key-1",
    });
    expect(result.status).toBe("cancelled");
    // Every attempt across the crash + restart carried the identical key.
    expect(new Set(keys)).toEqual(new Set(["cancel-key-1"]));
  });
});

// ==================== 6. Reconcile boundary ====================

describe("reconcile boundary: timeout/crash on Partner reconciliation call", () => {
  async function makeUnknown(store: FaultStore) {
    const out = await runPurchaseSaga(
      purchaseInput(),
      deps(store, {
        reserveOrder: async () => {
          throw new PartnerApiError("PARTNER_UNAVAILABLE", 0, true);
        },
      }),
    );
    if (out.status !== "unknown") throw new Error("expected unknown");
    return out.dispatch;
  }

  it("reconcile call crashes -> dispatch stays unknown, no money moved, retry resolves later", async () => {
    const store = new FaultStore({ "user-1": 10000 });
    const dispatch = await makeUnknown(store);
    expect(store.balances.get("user-1")).toBe(7000);

    // Reconcile source unavailable -> resolver swallows and stays unknown.
    const failing = await resolveUnknownDispatch(
      dispatch,
      deps(store, {
        reconcileOrders: async (): Promise<PartnerReconciliationResult[]> => {
          throw new PartnerApiError("PARTNER_UNAVAILABLE", 0, true);
        },
      }),
    );
    expect(failing.to).toBe("unknown");
    expect(store.balances.get("user-1")).toBe(7000); // untouched: no premature refund

    // Retry later with a working reconcile -> compensates exactly once.
    const resolved = await resolveUnknownDispatch(
      dispatch,
      deps(store, {
        reconcileOrders: async (): Promise<PartnerReconciliationResult[]> => [
          { buyerOrderRef: "bor-1", providerOrderRef: null, status: "timeout" },
        ],
      }),
    );
    expect(resolved.to).toBe("compensated");
    expect(store.balances.get("user-1")).toBe(10000); // refunded once after resolution
  });

  it("reconcile reports still-in-flight -> stays unknown without moving money", async () => {
    const store = new FaultStore({ "user-1": 10000 });
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
    expect(store.balances.get("user-1")).toBe(7000); // held, no refund, no double debit
  });
});

// ==================== 7. Failure isolation (Req 22.5) ====================

describe("failure isolation: existing providers stay usable when Partner fails/stockout (Req 22.5)", () => {
  it("a Partner failure never throws out of the saga (buy flow keeps working)", async () => {
    const store = new FaultStore({ "user-1": 10000 });
    await expect(
      runPurchaseSaga(
        purchaseInput(),
        deps(store, {
          reserveOrder: async () => {
            throw new PartnerApiError("PARTNER_UNAVAILABLE", 0, true);
          },
        }),
      ),
    ).resolves.toMatchObject({ status: "unknown" });
  });

  it("getLayanan returns an empty catalog (not an error) on Partner stockout/unavailability", async () => {
    process.env.PARTNER_INTERNAL_API_URL = "https://partner-api.example.com/api/internal/v1";
    process.env.PARTNER_INTERNAL_API_HMAC_CLIENT_ID = "client-1";
    process.env.PARTNER_INTERNAL_API_HMAC_KEY_ID = "key-1";
    process.env.PARTNER_INTERNAL_API_HMAC_SECRET = "secret-secret-secret-secret-01";

    // Inventory reports zero available -> Pluto simply shows no catalog; the
    // rest of the buy page (other providers) is unaffected.
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: { available: 0, retailPriceIdr: 0, currency: "IDR", quoteVersion: "1", expiresAt: new Date().toISOString() },
          requestId: "req-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const layanan = await providerPartner.getLayanan(62);
    expect(layanan).toEqual({ "62": {} });

    vi.restoreAllMocks();
    delete process.env.PARTNER_INTERNAL_API_URL;
    delete process.env.PARTNER_INTERNAL_API_HMAC_CLIENT_ID;
    delete process.env.PARTNER_INTERNAL_API_HMAC_KEY_ID;
    delete process.env.PARTNER_INTERNAL_API_HMAC_SECRET;
  });

  it("insufficient balance short-circuits without debit or Partner call", async () => {
    const store = new FaultStore({ "user-1": 1000 });
    let reserveCalled = false;
    const out = await runPurchaseSaga(
      purchaseInput(),
      deps(store, {
        reserveOrder: async () => {
          reserveCalled = true;
          return RESERVE_OK;
        },
      }),
    );
    expect(out.status).toBe("insufficient_balance");
    expect(store.balances.get("user-1")).toBe(1000);
    expect(reserveCalled).toBe(false);
  });
});
