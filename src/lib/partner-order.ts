/**
 * Pluto (Partner Platform) purchase path for `POST /api/otp/order`.
 *
 * Extracted from the route module on purpose: the route imports `next-auth`, which
 * cannot be resolved outside a Next server context, so keeping this logic in its
 * own module is what makes the money-path branches testable without a database,
 * a network, or a running server.
 */
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { isPartnerSupplyEnabledForUser } from "@/lib/partner-flag";
import { runPurchaseSaga } from "@/lib/partner-saga";
import * as providerPartner from "@/lib/provider-partner";
import { partnerCountryIsoFor } from "@/lib/provider-partner";

export interface PartnerOrderDeps {
  isAdmitted: typeof isPartnerSupplyEnabledForUser;
  getInventory: typeof providerPartner.getInventory;
  runSaga: typeof runPurchaseSaga;
  loadUser: (userId: string) => Promise<{ status: string; balance: number } | null>;
  loadOrder: (orderId: string) => Promise<{ id: string; number: string } | null>;
}

/** Production wiring; the exported function accepts overrides so it is testable. */
function defaultPartnerOrderDeps(): PartnerOrderDeps {
  return {
    isAdmitted: isPartnerSupplyEnabledForUser,
    getInventory: providerPartner.getInventory,
    runSaga: runPurchaseSaga,
    loadUser: (userId) =>
      db.user.findUnique({ where: { id: userId }, select: { status: true, balance: true } }),
    loadOrder: (orderId) =>
      db.order.findUnique({ where: { id: orderId }, select: { id: true, number: true } }),
  };
}

/**
 * Buy one number from Pluto (the Partner Platform).
 *
 * Kept in its own function, returning its own response, so the shared
 * `api1..api10` path is not reshaped to accommodate a provider with different
 * semantics. Two differences drive that:
 *
 *  - **Debit first, compensate on failure.** Reserve on Partner is a remote,
 *    money-bearing effect; if we took the number first and our debit then failed,
 *    the Partner side would hold a reserved number we never paid for. The saga in
 *    `partner-saga.ts` owns that ordering, the exactly-once debit (keyed on
 *    `purchaseKey`), the `Order` row, and the compensation path.
 *  - **Price comes from a signed quote, not our pricing rules.** Partner returns
 *    the authoritative retail price plus a `quoteVersion`; reserve rejects a stale
 *    version with `QUOTE_EXPIRED`, so the buyer can never be charged against a
 *    price the supplier no longer honours.
 *
 * Every failure maps to the SAME error strings the shared path already throws, so
 * the buy page needs no new error handling.
 */
export async function orderFromPartner(
  input: {
    userId: string;
    negara: number;
    layanan: string;
    operator: string;
    serviceName?: string;
    countryName?: string;
  },
  depsOverride: Partial<PartnerOrderDeps> = {},
): Promise<NextResponse> {
  const deps = { ...defaultPartnerOrderDeps(), ...depsOverride };
  // Private-beta gate: the flag AND the buyer allowlist must both admit this
  // user. Absent either, Pluto must be indistinguishable from "not offered".
  const admitted = await deps.isAdmitted(input.userId);
  if (!admitted) {
    return NextResponse.json(
      { error: "Server tidak tersedia. Silakan pilih server lain." },
      { status: 403 },
    );
  }

  // Numeric country ids on screen follow the HeroSMS/api4 catalog; Partner speaks
  // ISO-2. An id we do not map is simply not offered.
  const countryIso = partnerCountryIsoFor(input.negara);
  if (countryIso === undefined) {
    return NextResponse.json(
      { error: "Layanan tidak ditemukan atau harga tidak tersedia" },
      { status: 404 },
    );
  }

  const user = await deps.loadUser(input.userId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.status === "banned") {
    return NextResponse.json(
      { error: "Akun Anda telah diblokir. Hubungi admin." },
      { status: 403 },
    );
  }

  // Authoritative price + quote version straight from the supplier.
  let inventory;
  try {
    inventory = await deps.getInventory({
      service: input.layanan,
      country: countryIso,
      operator: input.operator || "any",
    });
  } catch {
    return NextResponse.json(
      { error: "Server sedang gangguan. Silakan pilih server lain." },
      { status: 503 },
    );
  }

  if (!inventory.available || inventory.retailPriceIdr === null) {
    return NextResponse.json(
      { error: "Stok habis untuk layanan ini.", message: "Stok habis" },
      { status: 409 },
    );
  }

  const price = inventory.retailPriceIdr;
  // Cheap pre-check to avoid a remote reserve we know cannot be paid for; the
  // authoritative, atomic debit still happens inside the saga.
  if (user.balance < price) {
    return NextResponse.json(
      { error: "Saldo tidak cukup. Silakan deposit terlebih dahulu." },
      { status: 402 },
    );
  }

  // Opaque, pseudonymous refs: the Partner side never learns a Main user id.
  const purchaseKey = randomUUID();
  const outcome = await deps.runSaga({
    userId: input.userId,
    amount: price,
    purchaseKey,
    reserveKey: purchaseKey,
    buyerOrderRef: randomUUID(),
    buyerAccountRef: createHash("sha256")
      .update(`pluto-account:${input.userId}`, "utf8")
      .digest("hex"),
    quoteVersion: String(inventory.quoteVersion),
    service: input.layanan,
    country: countryIso,
    operator: input.operator || "any",
    order: {
      service: input.layanan,
      serviceName: input.serviceName || input.layanan,
      country: input.countryName || countryIso,
      countryId: input.negara,
      price,
      operator: input.operator || "any",
      source: providerPartner.PARTNER_SERVER_ID,
    },
  });

  if (outcome.status === "insufficient_balance") {
    return NextResponse.json(
      { error: "Saldo tidak cukup. Silakan deposit terlebih dahulu." },
      { status: 402 },
    );
  }
  if (outcome.status === "compensated") {
    // The debit was reversed by the saga, so the buyer is whole. Report it as a
    // stockout: from their side no number was obtained and nothing was charged.
    return NextResponse.json(
      { error: "Stok habis untuk layanan ini.", message: "Stok habis" },
      { status: 409 },
    );
  }
  if (outcome.status === "unknown") {
    // Neither confirmed nor safely reversed. The reconciler resolves it against
    // Partner's authoritative status; never tell the buyer it succeeded.
    return NextResponse.json(
      {
        error:
          "Pesanan sedang diverifikasi. Saldo Anda aman — cek riwayat sebentar lagi.",
      },
      { status: 202 },
    );
  }

  const { dispatch } = outcome;
  // The dispatch record tracks the saga, not the number; the number lives on the
  // `Order` row the saga created, which is also what the buy page polls.
  const order = dispatch.orderId ? await deps.loadOrder(dispatch.orderId) : null;

  logAction(
    input.userId,
    "order",
    JSON.stringify({
      orderId: dispatch.providerOrderRef,
      server: providerPartner.PARTNER_SERVER_ID,
      service: input.serviceName || input.layanan,
      country: input.countryName || countryIso,
      price,
    }),
  );

  return NextResponse.json({
    success: true,
    data: {
      order_id: dispatch.providerOrderRef,
      number: order?.number ?? "",
      id: order?.id ?? dispatch.orderId,
    },
  });
}

/**
 * Fetch the current OTP for a Pluto order, or `null` when none has arrived yet.
 *
 * The shared `checkSms` dispatcher deliberately refuses `partner`: every other
 * provider is polled by a NUMERIC activation id, while a Partner order is
 * addressed by an opaque UUID (`providerOrderRef`). This helper is the partner
 * equivalent, shaped so the pollers can treat it like any other provider.
 *
 * Returns `null` — never throws — on a transport failure or an unavailable
 * supplier, so one bad cycle just retries on the next tick instead of tearing
 * down a stream that is watching several orders.
 */
export async function fetchPartnerOtp(
  providerOrderRef: string | null | undefined,
  deps: { getStatus?: typeof providerPartner.getOrderStatus } = {},
): Promise<string | null> {
  if (!providerOrderRef) return null;
  const getStatus = deps.getStatus ?? providerPartner.getOrderStatus;
  try {
    const status = await getStatus(providerOrderRef);
    return status.otp ?? null;
  } catch {
    return null;
  }
}

/**
 * Close a Pluto order's listening window and release the supplier's number.
 *
 * Optional by design: the Partner platform sweeps expired windows itself, so
 * skipping this only wastes supply for the rest of the window. Calling it returns
 * the number to sale immediately, which is why "selesai" in the UI maps here.
 *
 * Never throws: the buyer already has their code, so a failure to release must
 * not surface as a failed action. Returns whether the hold was released.
 */
export async function completePartnerHold(
  providerOrderRef: string | null | undefined,
  actorRef: string,
  deps: { complete?: typeof providerPartner.completePartnerOrder } = {},
): Promise<boolean> {
  if (!providerOrderRef) return false;
  const complete = deps.complete ?? providerPartner.completePartnerOrder;
  try {
    await complete({
      partnerOrderId: providerOrderRef,
      actorRef,
      // Idempotent on the Partner side; a fresh key per attempt is safe because
      // an already-released hold is reported as success without changing anything.
      idempotencyKey: randomUUID(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Release a Pluto order that ran out of time, choosing the correct terminal path.
 *
 * The shared `cancelOrder` dispatcher throws for `partner` on purpose, and the two
 * expiries mean different things on the Partner side:
 *
 *  - **No OTP ever arrived** — the order timed out. `POST /orders/{id}/timeout` is
 *    the deterministic terminal transition for that, and it refunds nothing here
 *    because Main owns the buyer's balance (the caller refunds separately).
 *  - **An OTP did arrive and the listening window closed** — the order SUCCEEDED;
 *    timing it out would be an illegal transition. Only the hold needs releasing,
 *    which is what completion does.
 *
 * Never throws: the Partner platform sweeps both cases on its own schedule, so a
 * failure here costs idle supply, not correctness.
 */
export async function releaseExpiredPartnerOrder(
  input: {
    providerOrderRef: string | null | undefined;
    /** True once a code was delivered, i.e. the order already succeeded. */
    hasCode: boolean;
    observedAtIso?: string;
    reason?: string;
  },
  deps: {
    timeoutOrder?: typeof providerPartner.timeoutPartnerOrder;
    complete?: typeof providerPartner.completePartnerOrder;
  } = {},
): Promise<boolean> {
  if (!input.providerOrderRef) return false;

  if (input.hasCode) {
    return completePartnerHold(input.providerOrderRef, "main:window-expired", {
      complete: deps.complete,
    });
  }

  const timeoutOrder = deps.timeoutOrder ?? providerPartner.timeoutPartnerOrder;
  try {
    await timeoutOrder({
      partnerOrderId: input.providerOrderRef,
      observedAt: input.observedAtIso ?? new Date().toISOString(),
      reason: input.reason ?? "MAIN_TIMEOUT",
      idempotencyKey: randomUUID(),
    });
    return true;
  } catch {
    return false;
  }
}
