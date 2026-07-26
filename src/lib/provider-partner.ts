/**
 * Provider adapter — Pluto (Private Beta), internal id `partner`.
 *
 * Task 9.6 (design section 5). Maps the Partner Platform Internal API v1 onto
 * the Main dispatcher's provider interface shape and exposes the richer saga
 * operations (inventory / reserve / status / cancel / timeout / reconciliation)
 * that the debit-reserve-confirm-compensate saga (task 9.7) will drive.
 *
 * Boundary rules (design "Batas Kepemilikan Data"):
 *   - Main stays the owner of buyer, balance, order, debit, and refund.
 *   - Cross-boundary references are opaque pseudonymous UUIDs
 *     (`buyerOrderRef`, `buyerAccountRef`, `providerOrderRef`).
 *   - Partner order ids are UUID strings, so Main persists them in
 *     `Order.providerOrderRef` — they are NEVER coerced into `orderId Int`.
 *
 * MVP catalog is fixed to WhatsApp / Indonesia / any, currency IDR, E.164 +62.
 * Pluto is NOT part of `unified`/Bimasakti and does not alter api1..api10.
 */

import {
  internalApiRequest,
  isPartnerClientConfigured,
  PartnerApiError,
} from "@/lib/partner-client";

/** Internal provider id registered with the Main dispatcher. */
export const PARTNER_SERVER_ID = "partner" as const;

/** Display name shown for the Pluto private-beta supply. */
export const PARTNER_DISPLAY_NAME = "Pluto (Private Beta)";

/** Fixed MVP catalog dimensions (design "Katalog MVP"). */
export const PARTNER_CATALOG = {
  serviceCode: "wa",
  countryCode: "ID",
  operatorCode: "any",
  currency: "IDR",
} as const;

export { PartnerApiError, isPartnerClientConfigured };

// ==================== Response shapes (Internal API v1) ====================

export interface PartnerInventory {
  available: number;
  retailPriceIdr: number;
  currency: string;
  quoteVersion: string;
  expiresAt: string;
}

export interface PartnerOrderSnapshot {
  serviceCode: string;
  countryCode: string;
  operatorCode: string;
  canonicalNumber: string;
  basePriceIdr: number;
  retailPriceIdr: number;
  payoutIdr: number;
  platformMarginIdr: number;
  currency: string;
  configVersion: string | number;
}

export interface PartnerReserveResult {
  partnerOrderId: string;
  number: string;
  status: string; // expected "waiting_sms"
  snapshot: PartnerOrderSnapshot;
  expiresAt: string;
}

export interface PartnerOrderStatus {
  partnerOrderId: string;
  status: string;
  otp: string | null;
  terminalReason: string | null;
  createdAt?: string;
  reservedAt?: string;
  waitingAt?: string;
  succeededAt?: string;
  terminalAt?: string;
}

export interface PartnerTerminalResult {
  partnerOrderId: string;
  status: string;
  terminalReason: string | null;
  releaseDisposition?: string;
}

export interface PartnerReconciliationItem {
  buyerOrderRef?: string;
  providerOrderRef?: string;
  status?: string;
}

export interface PartnerReconciliationResult {
  buyerOrderRef: string | null;
  providerOrderRef: string | null;
  status: string;
}

// ==================== Saga operations (used by task 9.7) ====================

/**
 * GET /inventory — eligible Pluto supply + authoritative quote for the fixed
 * MVP catalog. Read: 3s timeout, no idempotency key.
 */
export async function getInventory(
  filter: {
    service?: string;
    country?: string;
    operator?: string;
  } = {},
): Promise<PartnerInventory> {
  const { data } = await internalApiRequest<PartnerInventory>({
    method: "GET",
    endpoint: "/inventory",
    query: {
      service: filter.service ?? PARTNER_CATALOG.serviceCode,
      country: filter.country ?? PARTNER_CATALOG.countryCode,
      operator: filter.operator ?? PARTNER_CATALOG.operatorCode,
    },
  });
  return data;
}

/**
 * Coerce a quote version into the INTEGER the producer contract requires.
 *
 * The Internal API reserve route (`kirimkode-partner .../orders/reserve`)
 * validates `Number.isInteger(body.quoteVersion)` and rejects anything else
 * with a 400 `VALIDATION_ERROR`. Inventory quotes are surfaced as strings for
 * display, so normalise here: numeric strings become their integer value; a
 * non-numeric value is left as `NaN` so validation fails loudly instead of
 * silently sending a bad shape.
 */
function toQuoteVersionInt(quoteVersion: number | string): number {
  if (typeof quoteVersion === "number") return Math.trunc(quoteVersion);
  const parsed = Number(quoteVersion);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : Number.NaN;
}

/**
 * POST /orders/reserve — atomically reserve a number. Mutation: 8s timeout,
 * idempotency key required. The key is the saga's stable reserve key so a retry
 * returns the first reservation instead of double-reserving.
 *
 * The producer contract expects a NESTED `filter { service, country, operator }`
 * and an INTEGER `quoteVersion` (see the reserve route + the golden reserve
 * vector in `internal-api-contract.producer.unit.test.ts`). The body field order
 * here matches that golden vector so the signed body hash reproduces exactly.
 */
export async function reserveOrder(input: {
  buyerOrderRef: string;
  buyerAccountRef: string;
  quoteVersion: number | string;
  idempotencyKey: string;
  service?: string;
  country?: string;
  operator?: string;
}): Promise<PartnerReserveResult> {
  const { data } = await internalApiRequest<PartnerReserveResult>({
    method: "POST",
    endpoint: "/orders/reserve",
    idempotencyKey: input.idempotencyKey,
    body: {
      buyerOrderRef: input.buyerOrderRef,
      buyerAccountRef: input.buyerAccountRef,
      quoteVersion: toQuoteVersionInt(input.quoteVersion),
      filter: {
        service: input.service ?? PARTNER_CATALOG.serviceCode,
        country: input.country ?? PARTNER_CATALOG.countryCode,
        operator: input.operator ?? PARTNER_CATALOG.operatorCode,
      },
    },
  });
  return data;
}

/**
 * GET /orders/{id} — order status, including the OTP once available. Raw SMS is
 * never returned by the Internal API. Read: 3s timeout.
 */
export async function getOrderStatus(
  partnerOrderId: string,
): Promise<PartnerOrderStatus> {
  const { data } = await internalApiRequest<PartnerOrderStatus>({
    method: "GET",
    endpoint: `/orders/${encodeURIComponent(partnerOrderId)}`,
  });
  return data;
}

/**
 * POST /orders/{id}/cancel — deterministic terminal cancel. Mutation: 8s
 * timeout, idempotency key required.
 */
export async function cancelPartnerOrder(input: {
  partnerOrderId: string;
  reason: string;
  actorRef: string;
  idempotencyKey: string;
}): Promise<PartnerTerminalResult> {
  const { data } = await internalApiRequest<PartnerTerminalResult>({
    method: "POST",
    endpoint: `/orders/${encodeURIComponent(input.partnerOrderId)}/cancel`,
    idempotencyKey: input.idempotencyKey,
    body: { reason: input.reason, actorRef: input.actorRef },
  });
  return data;
}

/**
 * POST /orders/{id}/timeout — deterministic terminal timeout. Mutation: 8s
 * timeout, idempotency key required.
 */
export async function timeoutPartnerOrder(input: {
  partnerOrderId: string;
  observedAt: string;
  reason: string;
  idempotencyKey: string;
}): Promise<PartnerTerminalResult> {
  const { data } = await internalApiRequest<PartnerTerminalResult>({
    method: "POST",
    endpoint: `/orders/${encodeURIComponent(input.partnerOrderId)}/timeout`,
    idempotencyKey: input.idempotencyKey,
    body: { observedAt: input.observedAt, reason: input.reason },
  });
  return data;
}

/**
 * POST /orders/{id}/complete — close a successful order's listening window and
 * release its number hold. Mutation: 8s timeout, idempotency key required.
 *
 * A Partner order that received its OTP does NOT release its number right away:
 * it keeps holding it so the buyer can still receive a REPEAT code (services
 * routinely resend one), and so the number cannot be resold while a resent SMS
 * for this buyer is still in flight. Call this when the buyer is done with the
 * number — the order stays `success` and no money moves, only the hold ends.
 *
 * Skipping this call is safe but wasteful: the Partner side sweeps expired
 * windows on its own (the order's 20-minute expiry), so the number is released
 * eventually either way. Calling it returns the number to sale immediately.
 *
 * Idempotent: a repeated call replays the first outcome, and an already-released
 * hold reports success without changing anything.
 */
export async function completePartnerOrder(input: {
  partnerOrderId: string;
  actorRef: string;
  idempotencyKey: string;
}): Promise<PartnerTerminalResult> {
  const { data } = await internalApiRequest<PartnerTerminalResult>({
    method: "POST",
    endpoint: `/orders/${encodeURIComponent(input.partnerOrderId)}/complete`,
    idempotencyKey: input.idempotencyKey,
    body: { actorRef: input.actorRef },
  });
  return data;
}

/**
 * POST /reconciliation/orders — authoritative Partner status for up to 100
 * ref/status pairs. Used to resolve `unknown` saga outcomes. Mutation: 8s
 * timeout, idempotency key required.
 */
export async function reconcileOrders(input: {
  items: PartnerReconciliationItem[];
  idempotencyKey: string;
}): Promise<PartnerReconciliationResult[]> {
  if (input.items.length > 100) {
    throw new RangeError("reconcileOrders accepts at most 100 items per batch");
  }
  const { data } = await internalApiRequest<PartnerReconciliationResult[]>({
    method: "POST",
    endpoint: "/reconciliation/orders",
    idempotencyKey: input.idempotencyKey,
    body: { items: input.items },
  });
  return data;
}

// ==================== Dispatcher-shape wrappers ====================
//
// These mirror the shape the Main dispatcher (`src/lib/otp.ts`) uses for the
// numeric-id providers. Pluto's real order lifecycle uses UUID refs through the
// saga above, so the numeric create/check/cancel are intentionally NOT part of
// this module (the dispatcher guards `partner` there). Only the read surface is
// mapped, so inventory browsing stays consistent with other providers.

/**
 * Pluto does not expose a supplier balance to Main (Main owns buyer balance).
 * Returned as zero so any generic server-info sweep does not crash.
 */
export async function getBalance() {
  return { balance: 0 };
}

/**
 * Numeric country ids follow the HeroSMS/api4 catalog (`action=getCountries`),
 * which is the convention already on screen for the other servers — Indonesia is
 * **6** there, not the E.164 calling code. Aligning matters because the buy page
 * can show several servers at once: two different ids for one country would read
 * as two different countries.
 *
 * This mapping lives here, at the dispatcher boundary, on purpose. The Partner
 * platform stores ISO-2 (`countryCode = "ID"`) in its own database, so adding a
 * country never touches an existing column or row — only this table and a new
 * offer row.
 */
export const PARTNER_COUNTRY_IDS: Readonly<Record<string, number>> = Object.freeze({
  ID: 6,
});

/** ISO-2 for a HeroSMS-style numeric id, or `undefined` when unmapped. */
export function partnerCountryIsoFor(id: number): string | undefined {
  return Object.keys(PARTNER_COUNTRY_IDS).find((iso) => PARTNER_COUNTRY_IDS[iso] === id);
}

/**
 * Countries Pluto serves, in the dispatcher's shape. Ids come from
 * {@link PARTNER_COUNTRY_IDS} so they match the other servers on screen.
 */
export async function getNegara() {
  return {
    success: true as const,
    data: [{ id_negara: PARTNER_COUNTRY_IDS.ID, nama_negara: "indonesia" }],
  };
}

/** Operator selection is not exposed for Pluto MVP. */
export async function getOperator(negara: number) {
  return { data: { [String(negara)]: ["any"] } };
}

/**
 * Map the fixed MVP catalog to the dispatcher's layanan shape. Returns an empty
 * catalog (rather than throwing) when Pluto is unavailable, so a browse never
 * breaks the buy page.
 */
export async function getLayanan(negara: number) {
  const negaraKey = String(negara);
  const empty = { [negaraKey]: {} as Record<string, { harga: number; stok: number; layanan: string }> };

  if (!isPartnerClientConfigured()) return empty;

  try {
    const inv = await getInventory();
    if (inv.available <= 0) return empty;
    return {
      [negaraKey]: {
        [PARTNER_CATALOG.serviceCode]: {
          harga: inv.retailPriceIdr,
          stok: inv.available,
          layanan: "WhatsApp",
        },
      },
    };
  } catch {
    // Unavailable / stockout — treat as no catalog for browsing purposes.
    return empty;
  }
}
