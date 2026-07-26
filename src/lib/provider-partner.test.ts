/**
 * Unit tests for the Pluto provider adapter (task 9.6, design section 5).
 * Focus on the dispatcher-shape wrappers and registration metadata; the saga
 * operations are exercised through the client contract tests.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import * as providerPartner from "./provider-partner";

function clearEnv() {
  delete process.env.PARTNER_INTERNAL_API_URL;
  delete process.env.PARTNER_INTERNAL_API_HMAC_CLIENT_ID;
  delete process.env.PARTNER_INTERNAL_API_HMAC_KEY_ID;
  delete process.env.PARTNER_INTERNAL_API_HMAC_SECRET;
}

describe("provider-partner registration metadata", () => {
  it("registers the id and display name for Pluto", () => {
    expect(providerPartner.PARTNER_SERVER_ID).toBe("partner");
    expect(providerPartner.PARTNER_DISPLAY_NAME).toBe("Pluto (Private Beta)");
  });

  it("pins the fixed MVP catalog dimensions", () => {
    expect(providerPartner.PARTNER_CATALOG).toEqual({
      serviceCode: "wa",
      countryCode: "ID",
      operatorCode: "any",
      currency: "IDR",
    });
  });
});

describe("dispatcher-shape wrappers", () => {
  beforeEach(() => clearEnv());
  afterEach(() => {
    vi.restoreAllMocks();
    clearEnv();
  });

  it("returns a single Indonesia country and 'any' operator", async () => {
    const negara = await providerPartner.getNegara();
    expect(negara).toEqual({
      success: true,
      data: [{ id_negara: 6, nama_negara: "indonesia" }],
    });

    const op = await providerPartner.getOperator(62);
    expect(op).toEqual({ data: { "62": ["any"] } });
  });

  it("returns an empty catalog for getLayanan when the client is not configured", async () => {
    // No env -> not configured -> must not attempt a network call.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const layanan = await providerPartner.getLayanan(62);
    expect(layanan).toEqual({ "62": {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a zero balance (Main owns buyer balance, not Pluto)", async () => {
    expect(await providerPartner.getBalance()).toEqual({ balance: 0 });
  });
});

describe("reserveOrder producer contract shape (task 17.1 drift fix)", () => {
  beforeEach(() => {
    clearEnv();
    process.env.PARTNER_INTERNAL_API_URL =
      "https://partner-api.example.com/api/internal/v1";
    process.env.PARTNER_INTERNAL_API_HMAC_CLIENT_ID = "client-1";
    process.env.PARTNER_INTERNAL_API_HMAC_KEY_ID = "key-1";
    process.env.PARTNER_INTERNAL_API_HMAC_SECRET = "secret-secret-secret-secret-01";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    clearEnv();
  });

  function captureFetchBody() {
    const captured: { body?: string } = {};
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      captured.body = init.body as string;
      return new Response(
        JSON.stringify({
          data: {
            partnerOrderId: "po-1",
            number: "+6281234567890",
            status: "waiting_sms",
            snapshot: {},
            expiresAt: new Date().toISOString(),
          },
          requestId: "req-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    return { captured, fetchMock };
  }

  it("sends a NESTED filter and an INTEGER quoteVersion (matches the golden reserve vector)", async () => {
    const { captured } = captureFetchBody();

    await providerPartner.reserveOrder({
      buyerOrderRef: "buyer-ref-1",
      buyerAccountRef: "acct-ref-1",
      quoteVersion: "1", // display string coerced to integer
      idempotencyKey: "reserve-key-1",
      service: "wa",
      country: "ID",
      operator: "any",
    });

    // Byte-for-byte match with the producer's golden reserve vector body: the
    // field order (buyerOrderRef, buyerAccountRef, quoteVersion, filter) and the
    // integer quoteVersion must reproduce the same signed body hash.
    expect(captured.body).toBe(
      '{"buyerOrderRef":"buyer-ref-1","buyerAccountRef":"acct-ref-1","quoteVersion":1,"filter":{"service":"wa","country":"ID","operator":"any"}}',
    );

    const parsed = JSON.parse(captured.body as string);
    expect(parsed).toMatchObject({
      buyerOrderRef: "buyer-ref-1",
      buyerAccountRef: "acct-ref-1",
      quoteVersion: 1,
      filter: { service: "wa", country: "ID", operator: "any" },
    });
    expect(Number.isInteger(parsed.quoteVersion)).toBe(true);
    // The old FLAT shape (service/country/operator at the top level) is gone.
    expect(parsed.service).toBeUndefined();
    expect(parsed.country).toBeUndefined();
    expect(parsed.operator).toBeUndefined();
  });

  it("defaults the nested filter to the fixed MVP catalog", async () => {
    const { captured } = captureFetchBody();

    await providerPartner.reserveOrder({
      buyerOrderRef: "b",
      buyerAccountRef: "a",
      quoteVersion: 7,
      idempotencyKey: "k",
    });

    const parsed = JSON.parse(captured.body as string);
    expect(parsed.filter).toEqual({ service: "wa", country: "ID", operator: "any" });
    expect(parsed.quoteVersion).toBe(7);
  });
});

describe("completePartnerOrder (listening-window close)", () => {
  beforeEach(() => {
    clearEnv();
    process.env.PARTNER_INTERNAL_API_URL =
      "https://partner-api.example.com/api/internal/v1";
    process.env.PARTNER_INTERNAL_API_HMAC_CLIENT_ID = "client-1";
    process.env.PARTNER_INTERNAL_API_HMAC_KEY_ID = "key-1";
    process.env.PARTNER_INTERNAL_API_HMAC_SECRET = "secret-secret-secret-secret-01";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    clearEnv();
  });

  function captureCompleteCall() {
    const captured: { url?: string; body?: string; method?: string; idempotencyKey?: string } = {};
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      captured.url = url;
      captured.method = init.method;
      captured.body = init.body as string;
      captured.idempotencyKey = new Headers(init.headers).get("idempotency-key") ?? undefined;
      return new Response(
        JSON.stringify({
          data: {
            partnerOrderId: "po-1",
            status: "success",
            completedAt: "2026-07-26T10:00:00.000Z",
            releaseDisposition: "available",
          },
          requestId: "req-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    return { captured, fetchMock };
  }

  it("posts to the order's complete path with only actorRef, carrying the idempotency key", async () => {
    const { captured } = captureCompleteCall();

    const result = await providerPartner.completePartnerOrder({
      partnerOrderId: "po-1",
      actorRef: "buyer-app",
      idempotencyKey: "complete-key-1",
    });

    expect(captured.method).toBe("POST");
    expect(captured.url).toBe(
      "https://partner-api.example.com/api/internal/v1/orders/po-1/complete",
    );
    // The trigger is NOT sent: the producer fixes it to `buyer_complete`
    // server-side so no caller can impersonate the expiry sweep and close a
    // window that is still open.
    expect(JSON.parse(captured.body as string)).toEqual({ actorRef: "buyer-app" });
    expect(captured.idempotencyKey).toBe("complete-key-1");

    // The order stays successful; only the number hold ended.
    expect(result.status).toBe("success");
    expect(result.releaseDisposition).toBe("available");
  });

  it("percent-encodes the order id so a hostile ref cannot escape the path", async () => {
    const { captured } = captureCompleteCall();

    await providerPartner.completePartnerOrder({
      partnerOrderId: "po/../evil?x=1",
      actorRef: "buyer-app",
      idempotencyKey: "k",
    });

    expect(captured.url).toBe(
      "https://partner-api.example.com/api/internal/v1/orders/po%2F..%2Fevil%3Fx%3D1/complete",
    );
  });
});
