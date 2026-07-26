import { describe, it, expect } from "vitest";

import {
  completePartnerHold,
  fetchPartnerOtp,
  releaseExpiredPartnerOrder,
} from "./partner-order";

/**
 * Pluto's number-hold helpers, used by the pollers and by the "Selesai" action.
 *
 * These sit on the boundary between a live production route and a remote supplier,
 * so the property that matters most is that a supplier problem NEVER becomes a
 * user-visible failure or a lost number:
 *
 *  - polling must degrade to "no code yet" and retry next tick, not tear down a
 *    stream watching several orders;
 *  - releasing a hold is best-effort by design — the Partner platform sweeps
 *    expired windows itself, so a failure costs idle supply, not correctness;
 *  - an expired order must take the CORRECT terminal path: a success whose window
 *    closed is completed, while an order that never got a code is timed out.
 *    Timing out a success would be an illegal transition on the Partner side.
 */
const REF = "partner-order-uuid-1";

describe("fetchPartnerOtp", () => {
  it("returns the code once the supplier has one", async () => {
    const otp = await fetchPartnerOtp(REF, {
      getStatus: async () => ({
        partnerOrderId: REF,
        status: "success",
        otp: "718891",
        terminalReason: null,
      }),
    });
    expect(otp).toBe("718891");
  });

  it("returns null while no code has arrived", async () => {
    const otp = await fetchPartnerOtp(REF, {
      getStatus: async () => ({
        partnerOrderId: REF,
        status: "waiting_sms",
        otp: null,
        terminalReason: null,
      }),
    });
    expect(otp).toBeNull();
  });

  it("swallows a supplier outage so the poller simply retries", async () => {
    const otp = await fetchPartnerOtp(REF, {
      getStatus: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    // Not a throw: one bad cycle must not kill a stream watching other orders.
    expect(otp).toBeNull();
  });

  it("does not call the supplier without a provider reference", async () => {
    let calls = 0;
    const otp = await fetchPartnerOtp(null, {
      getStatus: async () => {
        calls += 1;
        throw new Error("should not be reached");
      },
    });
    expect(otp).toBeNull();
    expect(calls).toBe(0);
  });
});

describe("completePartnerHold", () => {
  it("releases the hold and reports success", async () => {
    let sent: Record<string, unknown> | null = null;
    const released = await completePartnerHold(REF, "main:user:u1", {
      complete: (async (input: Record<string, unknown>) => {
        sent = input;
        return {
          partnerOrderId: REF,
          status: "success",
          terminalReason: null,
          releaseDisposition: "available",
        };
      }) as never,
    });

    expect(released).toBe(true);
    expect(sent!.partnerOrderId).toBe(REF);
    expect(sent!.actorRef).toBe("main:user:u1");
    // An idempotency key is always sent: the Partner side replays a repeat call
    // rather than releasing twice.
    expect(typeof sent!.idempotencyKey).toBe("string");
    expect(String(sent!.idempotencyKey).length).toBeGreaterThan(0);
  });

  it("reports false instead of throwing when the supplier refuses", async () => {
    const released = await completePartnerHold(REF, "main:user:u1", {
      complete: (async () => {
        throw new Error("PARTNER_UNAVAILABLE");
      }) as never,
    });
    // The buyer already holds their code; failing to release is not their problem.
    expect(released).toBe(false);
  });
});

describe("releaseExpiredPartnerOrder", () => {
  it("completes an order that already delivered a code, never timing it out", async () => {
    let completed = 0;
    let timedOut = 0;
    const ok = await releaseExpiredPartnerOrder(
      { providerOrderRef: REF, hasCode: true },
      {
        complete: (async () => {
          completed += 1;
          return {
            partnerOrderId: REF,
            status: "success",
            terminalReason: null,
            releaseDisposition: "available",
          };
        }) as never,
        timeoutOrder: (async () => {
          timedOut += 1;
          throw new Error("illegal: a success cannot be timed out");
        }) as never,
      },
    );

    expect(ok).toBe(true);
    expect(completed).toBe(1);
    // Timing out an order that already succeeded is an illegal transition, so the
    // timeout path must never be taken here.
    expect(timedOut).toBe(0);
  });

  it("times out an order that never received a code", async () => {
    let completed = 0;
    let sent: Record<string, unknown> | null = null;
    const ok = await releaseExpiredPartnerOrder(
      {
        providerOrderRef: REF,
        hasCode: false,
        observedAtIso: "2026-07-26T12:00:00.000Z",
        reason: "MAIN_TIMEOUT",
      },
      {
        complete: (async () => {
          completed += 1;
          throw new Error("should not complete an order with no code");
        }) as never,
        timeoutOrder: (async (input: Record<string, unknown>) => {
          sent = input;
          return {
            partnerOrderId: REF,
            status: "timeout",
            terminalReason: "MAIN_TIMEOUT",
          };
        }) as never,
      },
    );

    expect(ok).toBe(true);
    expect(completed).toBe(0);
    expect(sent!.observedAt).toBe("2026-07-26T12:00:00.000Z");
    expect(sent!.reason).toBe("MAIN_TIMEOUT");
  });

  it("never throws when the supplier is unreachable", async () => {
    const ok = await releaseExpiredPartnerOrder(
      { providerOrderRef: REF, hasCode: false },
      {
        timeoutOrder: (async () => {
          throw new Error("ETIMEDOUT");
        }) as never,
      },
    );
    // The Partner platform sweeps expired orders on its own schedule, so the cron
    // must keep processing the rest of the batch.
    expect(ok).toBe(false);
  });

  it("does nothing without a provider reference", async () => {
    let calls = 0;
    const ok = await releaseExpiredPartnerOrder(
      { providerOrderRef: null, hasCode: true },
      {
        complete: (async () => {
          calls += 1;
          return {
            partnerOrderId: REF,
            status: "success",
            terminalReason: null,
          };
        }) as never,
      },
    );
    expect(ok).toBe(false);
    expect(calls).toBe(0);
  });
});
