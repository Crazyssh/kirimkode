/**
 * Partner (Pluto) purchase saga — debit / reserve / confirm / compensate.
 *
 * Task 9.7 (design section 5 "Saga Main Platform dan Kompensasi").
 *
 * Ownership boundary (design "Batas Kepemilikan Data"):
 *   - Main owns the buyer, buyer balance, buyer order, debit, and refund.
 *   - Partner owns the reservation + supplier earning.
 *   - There is NO distributed transaction. Cross-boundary identity is exchanged
 *     only through opaque pseudonymous refs (buyerOrderRef / buyerAccountRef /
 *     providerOrderRef / providerRequestRef).
 *   - Main NEVER creates a refund on the Partner Platform. Compensation is a
 *     buyer-balance refund on Main only; the Partner reservation simply times
 *     out on its own and produces no earning.
 *
 * Saga sequence (design section 5):
 *   1. tx: conditional debit (only when balance is sufficient) + create a
 *      PartnerDispatch(pending) carrying a unique purchaseKey and a stable
 *      reserveKey. The unique purchaseKey makes the debit exactly-once.
 *   2. call Partner reserve with idempotencyKey = dispatch.reserveKey.
 *   3a. reserve success        => tx: create/link buyer Order (store
 *       providerOrderRef/providerRequestRef) + dispatch = confirmed.
 *   3b. definitive stock/error => tx: refund once (conditional, exactly-once)
 *       + dispatch = compensated.
 *   3c. outcome unknown        => dispatch = unknown; reconciliation later
 *       polls Partner by the same key/ref and resolves to confirmed or
 *       compensated.
 *
 * Exactly-once (Req 20.5 — "tidak menghasilkan double charge, double refund,
 * atau double payout"): debit and refund both use conditional state transitions
 * inside a transaction (unique purchaseKey for debit; debitApplied/refundApplied
 * flags guarded by a CAS updateMany for refund), so a retry can never double
 * charge or double refund.
 *
 * If Partner fails or is out of stock the existing providers stay available —
 * this module only fails the Pluto attempt (returns a stable result), it never
 * throws in a way that would break the normal buy flow.
 *
 * No buyer PII is logged here; refs are opaque and errors are stable codes.
 */

import { db } from "@/lib/db";
import {
  PartnerApiError,
  reserveOrder as defaultReserveOrder,
  reconcileOrders as defaultReconcileOrders,
  getOrderStatus as defaultGetOrderStatus,
  type PartnerReserveResult,
  type PartnerReconciliationResult,
  type PartnerOrderStatus,
} from "@/lib/provider-partner";

// ==================== State machine (pure) ====================

/** Saga states persisted on PartnerDispatch.status. */
export type SagaStatus =
  | "pending"
  | "confirmed"
  | "compensating"
  | "compensated"
  | "unknown";

/** Events that drive a dispatch between states. */
export type SagaEvent =
  | "reserve_success"
  | "reserve_definitive_failure"
  | "reserve_unknown"
  | "reconcile_confirmed"
  | "reconcile_compensate"
  | "reconcile_unknown";

/** Result of a legal transition. */
export interface Transition {
  next: SagaStatus;
  /** This transition should refund the buyer (exactly-once guarded downstream). */
  refund: boolean;
  /** This transition should create/link the buyer order and mark confirmed. */
  link: boolean;
  /** No state change (idempotent replay of an already-resolved dispatch). */
  noop: boolean;
}

/** Marker for a transition that must never execute (money inconsistency). */
export interface IllegalTransition {
  illegal: true;
  reason: string;
}

const TERMINAL: ReadonlySet<SagaStatus> = new Set(["confirmed", "compensated"]);

/** True when a status is absorbing (no further money movement allowed). */
export function isTerminal(status: SagaStatus): boolean {
  return TERMINAL.has(status);
}

/**
 * Pure saga transition function. Terminal states are absorbing: replaying the
 * same resolving event is an idempotent no-op, while a *conflicting* terminal
 * event (e.g. compensate a confirmed purchase) is illegal and must be surfaced
 * as a reconciliation issue rather than silently moving money.
 */
export function applyEvent(
  current: SagaStatus,
  event: SagaEvent,
): Transition | IllegalTransition {
  // --- Absorbing terminal: confirmed ---
  if (current === "confirmed") {
    switch (event) {
      case "reserve_success":
      case "reconcile_confirmed":
      case "reserve_unknown":
      case "reconcile_unknown":
        return { next: "confirmed", refund: false, link: false, noop: true };
      case "reserve_definitive_failure":
      case "reconcile_compensate":
        return {
          illegal: true,
          reason: "cannot compensate a confirmed dispatch (would refund a completed purchase)",
        };
    }
  }

  // --- Absorbing terminal: compensated ---
  if (current === "compensated") {
    switch (event) {
      case "reserve_definitive_failure":
      case "reconcile_compensate":
      case "reserve_unknown":
      case "reconcile_unknown":
        return { next: "compensated", refund: false, link: false, noop: true };
      case "reserve_success":
      case "reconcile_confirmed":
        return {
          illegal: true,
          reason: "cannot confirm a compensated dispatch (already refunded)",
        };
    }
  }

  // --- pending: awaiting reserve outcome ---
  if (current === "pending") {
    switch (event) {
      case "reserve_success":
        return { next: "confirmed", refund: false, link: true, noop: false };
      case "reserve_definitive_failure":
        return { next: "compensated", refund: true, link: false, noop: false };
      case "reserve_unknown":
        return { next: "unknown", refund: false, link: false, noop: false };
      // Reconciliation events only apply to an unknown dispatch. A crash can,
      // however, leave a dispatch pending; treat a reconcile as valid so the
      // resolver can still finish the saga.
      case "reconcile_confirmed":
        return { next: "confirmed", refund: false, link: true, noop: false };
      case "reconcile_compensate":
        return { next: "compensated", refund: true, link: false, noop: false };
      case "reconcile_unknown":
        return { next: "unknown", refund: false, link: false, noop: false };
    }
  }

  // --- unknown: reserve outcome ambiguous, reconciliation decides ---
  if (current === "unknown") {
    switch (event) {
      case "reconcile_confirmed":
      case "reserve_success":
        return { next: "confirmed", refund: false, link: true, noop: false };
      case "reconcile_compensate":
      case "reserve_definitive_failure":
        return { next: "compensated", refund: true, link: false, noop: false };
      case "reconcile_unknown":
      case "reserve_unknown":
        return { next: "unknown", refund: false, link: false, noop: true };
    }
  }

  // --- compensating: refund in progress, resolve forward to compensated ---
  if (current === "compensating") {
    switch (event) {
      case "reconcile_compensate":
      case "reserve_definitive_failure":
        return { next: "compensated", refund: true, link: false, noop: false };
      case "reconcile_unknown":
      case "reserve_unknown":
        return { next: "compensating", refund: false, link: false, noop: true };
      case "reserve_success":
      case "reconcile_confirmed":
        return {
          illegal: true,
          reason: "cannot confirm a dispatch that is compensating",
        };
    }
  }

  return { illegal: true, reason: `unhandled state/event: ${current}/${event}` };
}

/**
 * Classify a Partner reserve failure into the outcome that drives the saga.
 *
 * Retryable transport/availability failures (network, timeout, HTTP 5xx, 429)
 * leave the reservation outcome genuinely UNKNOWN — the request may or may not
 * have reserved a number — so we reconcile rather than refund blindly.
 *
 * Every other (non-retryable) rejection is DEFINITIVE. Because Main sends a
 * stable reserveKey with a deterministic payload, a non-retryable error means
 * no reservation is holding for our key, so it is safe to refund exactly once.
 */
export function classifyReserveError(err: PartnerApiError): "definitive" | "unknown" {
  return err.retryable ? "unknown" : "definitive";
}

/**
 * Map an authoritative Partner order status (from reconcile/status) to a saga
 * reconciliation event. Active or successful reservations confirm; terminal
 * non-success (or missing) reservations compensate; still-in-flight stays
 * unknown.
 */
export function classifyPartnerStatus(status: string | null | undefined): SagaEvent {
  const s = (status ?? "").toLowerCase();
  switch (s) {
    case "reserved":
    case "waiting_sms":
    case "success":
      return "reconcile_confirmed";
    case "cancelled":
    case "canceled":
    case "timeout":
    case "failed":
    case "not_found":
    case "expired":
    case "released":
    case "":
      return "reconcile_compensate";
    case "created":
    case "pending":
      // Still in flight on the Partner side — cannot resolve yet.
      return "reconcile_unknown";
    default:
      // Unrecognised status is treated as still-unknown; never move money on a
      // status we do not understand.
      return "reconcile_unknown";
  }
}

// ==================== Persistence port ====================

/** Normalised view of a PartnerDispatch row used by the saga. */
export interface DispatchRecord {
  id: string;
  purchaseKey: string;
  reserveKey: string;
  status: SagaStatus;
  userId: string | null;
  orderId: string | null;
  buyerOrderRef: string | null;
  buyerAccountRef: string | null;
  providerOrderRef: string | null;
  providerRequestRef: string | null;
  amount: number;
  debitApplied: boolean;
  refundApplied: boolean;
  attempts: number;
  lastError: string | null;
}

/** Buyer order metadata needed to link a confirmed Pluto purchase. */
export interface OrderLinkInput {
  service: string;
  serviceName: string;
  country: string;
  countryId: number;
  number: string;
  price: number;
  operator: string;
  source: string;
}

export interface BeginDispatchInput {
  userId: string;
  amount: number;
  purchaseKey: string;
  reserveKey: string;
  buyerOrderRef: string;
  buyerAccountRef: string;
}

export interface BeginDispatchResult {
  ok: boolean;
  dispatch?: DispatchRecord;
  /** Present when ok=false, or when a retry re-used an existing purchaseKey. */
  reason?: "INSUFFICIENT_BALANCE" | "DUPLICATE";
}

export interface ConfirmDispatchInput {
  dispatchId: string;
  providerOrderRef: string;
  providerRequestRef: string;
  /** Buyer order metadata; omit when the number is not (yet) known. */
  order?: OrderLinkInput | null;
}

export interface CompensateDispatchInput {
  dispatchId: string;
  reason: string;
}

/**
 * Persistence operations for the saga. The default implementation is backed by
 * Prisma; tests inject an in-memory store that mirrors the same conditional
 * (exactly-once) semantics.
 */
export interface SagaStore {
  beginDispatch(input: BeginDispatchInput): Promise<BeginDispatchResult>;
  confirmDispatch(input: ConfirmDispatchInput): Promise<DispatchRecord>;
  compensateDispatch(input: CompensateDispatchInput): Promise<DispatchRecord>;
  markUnknown(input: { dispatchId: string; error: string | null }): Promise<DispatchRecord>;
  getByPurchaseKey(purchaseKey: string): Promise<DispatchRecord | null>;
  listUnknownDispatches(limit: number): Promise<DispatchRecord[]>;
}

// ==================== Prisma-backed store ====================

type PrismaLike = typeof db;

interface DispatchRow {
  id: string;
  purchaseKey: string;
  reserveKey: string;
  status: string;
  userId: string | null;
  orderId: string | null;
  buyerOrderRef: string | null;
  buyerAccountRef: string | null;
  providerOrderRef: string | null;
  providerRequestRef: string | null;
  amount: number;
  debitApplied: boolean;
  refundApplied: boolean;
  attempts: number;
  lastError: string | null;
}

function mapRow(row: DispatchRow): DispatchRecord {
  return {
    id: row.id,
    purchaseKey: row.purchaseKey,
    reserveKey: row.reserveKey,
    status: row.status as SagaStatus,
    userId: row.userId,
    orderId: row.orderId,
    buyerOrderRef: row.buyerOrderRef,
    buyerAccountRef: row.buyerAccountRef,
    providerOrderRef: row.providerOrderRef,
    providerRequestRef: row.providerRequestRef,
    amount: row.amount,
    debitApplied: row.debitApplied,
    refundApplied: row.refundApplied,
    attempts: row.attempts,
    lastError: row.lastError,
  };
}

/** Detect a Prisma unique-constraint violation (P2002) without importing runtime error classes. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

export class PrismaSagaStore implements SagaStore {
  constructor(private readonly client: PrismaLike = db) {}

  async beginDispatch(input: BeginDispatchInput): Promise<BeginDispatchResult> {
    // Idempotent retry: if a dispatch already exists for this purchaseKey,
    // return it and never debit again.
    const existing = await this.client.partnerDispatch.findUnique({
      where: { purchaseKey: input.purchaseKey },
    });
    if (existing) {
      return { ok: true, dispatch: mapRow(existing as DispatchRow), reason: "DUPLICATE" };
    }

    try {
      return await this.client.$transaction(async (tx) => {
        // Conditional debit: only succeeds when balance is sufficient. Atomic
        // WHERE balance >= amount prevents a negative balance under concurrency.
        const charge = await tx.user.updateMany({
          where: { id: input.userId, balance: { gte: input.amount } },
          data: { balance: { decrement: input.amount } },
        });
        if (charge.count === 0) {
          return { ok: false, reason: "INSUFFICIENT_BALANCE" as const };
        }

        // Unique purchaseKey makes this the exactly-once boundary: a concurrent
        // begin that loses the race throws P2002 and rolls back its own debit.
        const created = await tx.partnerDispatch.create({
          data: {
            purchaseKey: input.purchaseKey,
            reserveKey: input.reserveKey,
            status: "pending",
            userId: input.userId,
            amount: input.amount,
            debitApplied: true,
            buyerOrderRef: input.buyerOrderRef,
            buyerAccountRef: input.buyerAccountRef,
          },
        });
        return { ok: true, dispatch: mapRow(created as DispatchRow) };
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Lost the race — the winner's dispatch is authoritative; our debit was
        // rolled back with the transaction, so no double charge.
        const winner = await this.client.partnerDispatch.findUnique({
          where: { purchaseKey: input.purchaseKey },
        });
        if (winner) {
          return { ok: true, dispatch: mapRow(winner as DispatchRow), reason: "DUPLICATE" };
        }
      }
      throw err;
    }
  }

  async confirmDispatch(input: ConfirmDispatchInput): Promise<DispatchRecord> {
    return this.client.$transaction(async (tx) => {
      // CAS: only advance from a non-terminal state. Idempotent when already
      // confirmed/compensated (count === 0 -> no duplicate order).
      const advanced = await tx.partnerDispatch.updateMany({
        where: {
          id: input.dispatchId,
          status: { in: ["pending", "unknown", "compensating"] },
        },
        data: {
          status: "confirmed",
          providerOrderRef: input.providerOrderRef,
          providerRequestRef: input.providerRequestRef,
        },
      });

      if (advanced.count === 1) {
        const current = await tx.partnerDispatch.findUnique({
          where: { id: input.dispatchId },
        });
        // Only create the buyer order if we have the number and have not linked
        // one yet. Partner order ids are UUID -> stored in providerOrderRef;
        // Order.orderId (Int) holds a 0 sentinel (never used for Pluto).
        if (input.order && current && !current.orderId && current.userId) {
          const order = await tx.order.create({
            data: {
              userId: current.userId,
              server: "partner",
              orderId: 0,
              service: input.order.service,
              serviceName: input.order.serviceName,
              country: input.order.country,
              countryId: input.order.countryId,
              number: input.order.number,
              price: input.order.price,
              status: "waiting",
              operator: input.order.operator,
              source: input.order.source,
              providerOrderRef: input.providerOrderRef,
              providerRequestRef: input.providerRequestRef,
            },
          });
          await tx.partnerDispatch.update({
            where: { id: input.dispatchId },
            data: { orderId: order.id },
          });
        }
      }

      const fresh = await tx.partnerDispatch.findUnique({
        where: { id: input.dispatchId },
      });
      return mapRow(fresh as DispatchRow);
    });
  }

  async compensateDispatch(input: CompensateDispatchInput): Promise<DispatchRecord> {
    return this.client.$transaction(async (tx) => {
      // Conditional refund — exactly-once. The updateMany only claims when the
      // dispatch was debited, has not been refunded, and is not terminal; the
      // balance increment runs only when that claim succeeds (count === 1).
      const claim = await tx.partnerDispatch.updateMany({
        where: {
          id: input.dispatchId,
          debitApplied: true,
          refundApplied: false,
          status: { in: ["pending", "unknown", "compensating"] },
        },
        data: {
          status: "compensated",
          refundApplied: true,
          lastError: input.reason,
        },
      });

      const current = await tx.partnerDispatch.findUnique({
        where: { id: input.dispatchId },
      });

      if (claim.count === 1 && current?.userId) {
        await tx.user.update({
          where: { id: current.userId },
          data: { balance: { increment: current.amount } },
        });
      }

      return mapRow(current as DispatchRow);
    });
  }

  async markUnknown(input: { dispatchId: string; error: string | null }): Promise<DispatchRecord> {
    await this.client.partnerDispatch.updateMany({
      where: { id: input.dispatchId, status: "pending" },
      data: { status: "unknown", attempts: { increment: 1 }, lastError: input.error },
    });
    const fresh = await this.client.partnerDispatch.findUnique({
      where: { id: input.dispatchId },
    });
    return mapRow(fresh as DispatchRow);
  }

  async getByPurchaseKey(purchaseKey: string): Promise<DispatchRecord | null> {
    const row = await this.client.partnerDispatch.findUnique({ where: { purchaseKey } });
    return row ? mapRow(row as DispatchRow) : null;
  }

  async listUnknownDispatches(limit: number): Promise<DispatchRecord[]> {
    const rows = await this.client.partnerDispatch.findMany({
      where: { status: "unknown" },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return rows.map((r) => mapRow(r as DispatchRow));
  }
}

// ==================== Orchestration ====================

/** Injected dependencies for the saga (real Partner client by default). */
export interface SagaDeps {
  store: SagaStore;
  reserveOrder: typeof defaultReserveOrder;
  reconcileOrders: typeof defaultReconcileOrders;
  getOrderStatus: typeof defaultGetOrderStatus;
  /** Optional structured logger (PII-free). */
  log?: (event: string, meta: Record<string, unknown>) => void;
}

/** Build the default dependency set backed by Prisma + the real Partner client. */
export function defaultSagaDeps(overrides: Partial<SagaDeps> = {}): SagaDeps {
  return {
    store: overrides.store ?? new PrismaSagaStore(),
    reserveOrder: overrides.reserveOrder ?? defaultReserveOrder,
    reconcileOrders: overrides.reconcileOrders ?? defaultReconcileOrders,
    getOrderStatus: overrides.getOrderStatus ?? defaultGetOrderStatus,
    log: overrides.log,
  };
}

export interface PurchaseInput {
  userId: string;
  amount: number;
  /** Unique per buyer purchase — makes the debit exactly-once. */
  purchaseKey: string;
  /** Stable idempotency key sent to Partner reserve. */
  reserveKey: string;
  buyerOrderRef: string;
  buyerAccountRef: string;
  quoteVersion: string;
  order: Omit<OrderLinkInput, "number" | "price"> & { price: number };
  service?: string;
  country?: string;
  operator?: string;
}

export type PurchaseOutcome =
  | { status: "confirmed"; dispatch: DispatchRecord }
  | { status: "compensated"; dispatch: DispatchRecord; reason: string }
  | { status: "unknown"; dispatch: DispatchRecord }
  | { status: "insufficient_balance" };

function logSafe(deps: SagaDeps, event: string, meta: Record<string, unknown>) {
  deps.log?.(event, meta);
}

/**
 * Run the debit-reserve-confirm-compensate saga for one Pluto purchase.
 *
 * Never throws for an expected Partner failure — returns a stable outcome so the
 * caller can keep offering the existing providers.
 */
export async function runPurchaseSaga(
  input: PurchaseInput,
  depsOverride: Partial<SagaDeps> = {},
): Promise<PurchaseOutcome> {
  const deps = defaultSagaDeps(depsOverride);

  // Step 1: conditional debit + persist dispatch(pending) BEFORE calling Partner.
  const begin = await deps.store.beginDispatch({
    userId: input.userId,
    amount: input.amount,
    purchaseKey: input.purchaseKey,
    reserveKey: input.reserveKey,
    buyerOrderRef: input.buyerOrderRef,
    buyerAccountRef: input.buyerAccountRef,
  });

  if (!begin.ok || !begin.dispatch) {
    if (begin.reason === "INSUFFICIENT_BALANCE") {
      return { status: "insufficient_balance" };
    }
    // Defensive: no dispatch and not an insufficient-balance -> treat as no-op.
    return { status: "insufficient_balance" };
  }

  const dispatch = begin.dispatch;

  // Retry that re-used an existing purchaseKey: the dispatch may already be
  // resolved. Return its current outcome without re-reserving.
  if (begin.reason === "DUPLICATE" && dispatch.status !== "pending") {
    return outcomeFor(dispatch);
  }

  // Step 2: reserve on Partner using the stable reserveKey as idempotency key.
  let reserve: PartnerReserveResult;
  try {
    reserve = await deps.reserveOrder({
      buyerOrderRef: input.buyerOrderRef,
      buyerAccountRef: input.buyerAccountRef,
      quoteVersion: input.quoteVersion,
      idempotencyKey: dispatch.reserveKey,
      service: input.service,
      country: input.country,
      operator: input.operator,
    });
  } catch (err) {
    if (err instanceof PartnerApiError) {
      const outcome = classifyReserveError(err);
      if (outcome === "definitive") {
        // Step 3b: definitive failure/stockout -> refund once, compensated.
        // Main NEVER refunds on the Partner Platform.
        const compensated = await deps.store.compensateDispatch({
          dispatchId: dispatch.id,
          reason: err.code,
        });
        logSafe(deps, "partner_saga.compensated", {
          purchaseKey: dispatch.purchaseKey,
          code: err.code,
          status: err.status,
        });
        return { status: "compensated", dispatch: compensated, reason: err.code };
      }
      // Step 3c: retryable/ambiguous -> unknown, reconcile later.
      const unknown = await deps.store.markUnknown({
        dispatchId: dispatch.id,
        error: err.code,
      });
      logSafe(deps, "partner_saga.unknown", {
        purchaseKey: dispatch.purchaseKey,
        code: err.code,
      });
      return { status: "unknown", dispatch: unknown };
    }
    // Unexpected (non-Partner) error: outcome is ambiguous -> unknown, never
    // refund on a surprise so a real reservation is not orphaned+refunded.
    const unknown = await deps.store.markUnknown({
      dispatchId: dispatch.id,
      error: "PARTNER_ERROR",
    });
    logSafe(deps, "partner_saga.unknown", {
      purchaseKey: dispatch.purchaseKey,
      code: "PARTNER_ERROR",
    });
    return { status: "unknown", dispatch: unknown };
  }

  // Step 3a: reserve success -> link buyer order + confirmed.
  const transition = applyEvent(dispatch.status, "reserve_success");
  if ("illegal" in transition) {
    // Should not happen from pending; guard anyway.
    logSafe(deps, "partner_saga.illegal", {
      purchaseKey: dispatch.purchaseKey,
      from: dispatch.status,
      reason: transition.reason,
    });
    return outcomeFor(dispatch);
  }

  const confirmed = await deps.store.confirmDispatch({
    dispatchId: dispatch.id,
    providerOrderRef: reserve.partnerOrderId,
    providerRequestRef: dispatch.reserveKey,
    order: {
      service: input.order.service,
      serviceName: input.order.serviceName,
      country: input.order.country,
      countryId: input.order.countryId,
      number: reserve.number,
      price: input.order.price,
      operator: input.order.operator,
      source: input.order.source,
    },
  });
  logSafe(deps, "partner_saga.confirmed", {
    purchaseKey: dispatch.purchaseKey,
    providerOrderRef: reserve.partnerOrderId,
  });
  return { status: "confirmed", dispatch: confirmed };
}

function outcomeFor(dispatch: DispatchRecord): PurchaseOutcome {
  switch (dispatch.status) {
    case "confirmed":
      return { status: "confirmed", dispatch };
    case "compensated":
      return { status: "compensated", dispatch, reason: dispatch.lastError ?? "compensated" };
    default:
      return { status: "unknown", dispatch };
  }
}

// ==================== Reconciliation resolver ====================

export interface ReconcileOutcome {
  dispatchId: string;
  purchaseKey: string;
  from: SagaStatus;
  to: SagaStatus;
  /** True when the authoritative Partner status conflicted with a terminal state. */
  issue?: string;
}

/**
 * Resolve a single `unknown` dispatch by asking Partner for the authoritative
 * status of the same buyerOrderRef/providerOrderRef, then applying the saga
 * transition. Reconciliation NEVER performs a silent money repair: a conflict
 * with a terminal state is reported as an issue instead of moving money.
 */
export async function resolveUnknownDispatch(
  dispatch: DispatchRecord,
  depsOverride: Partial<SagaDeps> = {},
): Promise<ReconcileOutcome> {
  const deps = defaultSagaDeps(depsOverride);

  let results: PartnerReconciliationResult[];
  try {
    results = await deps.reconcileOrders({
      items: [
        {
          buyerOrderRef: dispatch.buyerOrderRef ?? undefined,
          providerOrderRef: dispatch.providerOrderRef ?? undefined,
        },
      ],
      // Stable idempotency key derived from the reserveKey.
      idempotencyKey: `${dispatch.reserveKey}:recon`,
    });
  } catch {
    // Reconciliation source unavailable — stay unknown, try again later.
    return {
      dispatchId: dispatch.id,
      purchaseKey: dispatch.purchaseKey,
      from: dispatch.status,
      to: dispatch.status,
    };
  }

  const match = results.find(
    (r) =>
      (dispatch.buyerOrderRef && r.buyerOrderRef === dispatch.buyerOrderRef) ||
      (dispatch.providerOrderRef && r.providerOrderRef === dispatch.providerOrderRef),
  ) ?? results[0];

  const event = classifyPartnerStatus(match?.status);
  const transition = applyEvent(dispatch.status, event);

  if ("illegal" in transition) {
    return {
      dispatchId: dispatch.id,
      purchaseKey: dispatch.purchaseKey,
      from: dispatch.status,
      to: dispatch.status,
      issue: transition.reason,
    };
  }

  if (transition.noop) {
    return {
      dispatchId: dispatch.id,
      purchaseKey: dispatch.purchaseKey,
      from: dispatch.status,
      to: transition.next,
    };
  }

  if (transition.refund) {
    const compensated = await deps.store.compensateDispatch({
      dispatchId: dispatch.id,
      reason: `reconcile:${match?.status ?? "missing"}`,
    });
    return {
      dispatchId: dispatch.id,
      purchaseKey: dispatch.purchaseKey,
      from: dispatch.status,
      to: compensated.status,
    };
  }

  if (transition.link) {
    // Partner holds an active/successful reservation. Fetch status for tracing;
    // the Internal API status does not carry the number, so the buyer order is
    // linked by ref only and flagged when the number is unavailable.
    let providerOrderRef = match?.providerOrderRef ?? dispatch.providerOrderRef ?? "";
    try {
      if (providerOrderRef) {
        const status: PartnerOrderStatus = await deps.getOrderStatus(providerOrderRef);
        providerOrderRef = status.partnerOrderId || providerOrderRef;
      }
    } catch {
      // Non-fatal: proceed with the ref we have.
    }
    const confirmed = await deps.store.confirmDispatch({
      dispatchId: dispatch.id,
      providerOrderRef,
      providerRequestRef: dispatch.reserveKey,
      order: null, // number not available via reconcile/status — link by ref only
    });
    return {
      dispatchId: dispatch.id,
      purchaseKey: dispatch.purchaseKey,
      from: dispatch.status,
      to: confirmed.status,
      issue: confirmed.orderId
        ? undefined
        : "confirmed by reconciliation without buyer order link (number unavailable) — manual link required",
    };
  }

  return {
    dispatchId: dispatch.id,
    purchaseKey: dispatch.purchaseKey,
    from: dispatch.status,
    to: transition.next,
  };
}

/**
 * Batch reconciliation: resolve up to `limit` unknown dispatches. Returns the
 * per-dispatch outcomes (including any surfaced issues).
 */
export async function reconcileUnknownDispatches(
  limit = 100,
  depsOverride: Partial<SagaDeps> = {},
): Promise<ReconcileOutcome[]> {
  const deps = defaultSagaDeps(depsOverride);
  const pending = await deps.store.listUnknownDispatches(Math.min(limit, 100));
  const outcomes: ReconcileOutcome[] = [];
  for (const dispatch of pending) {
    outcomes.push(await resolveUnknownDispatch(dispatch, deps));
  }
  return outcomes;
}
