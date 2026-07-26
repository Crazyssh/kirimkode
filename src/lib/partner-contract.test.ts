/**
 * Consumer-driven contract test — CONSUMER side (task 17.1).
 *
 * This is one half of a two-sided, consumer-driven contract for Internal API
 * v1. The Main Platform (consumer, this repo) and the Partner Platform
 * (producer) must agree, byte-for-byte, on a single wire contract. To make that
 * agreement *provable*, both sides embed the SAME frozen fixture (`CONTRACT`
 * below) — identical header names, canonicalization algorithm, golden
 * signature/body-hash vectors, envelope shapes, error-code table, and operation
 * set. The peer test lives at
 * `kirimkode-partner/src/application/internal-api/internal-api-contract.producer.unit.test.ts`;
 * the two `CONTRACT` objects are copied literally so any drift on either side
 * fails against the shared golden values.
 *
 * This file asserts the CONSUMER honours the contract:
 *   - `partner-client` signs requests with the contract's canonicalization +
 *     header set (recomputed and checked against the shared golden vectors);
 *   - all seven operations (inventory/reserve/status/cancel/timeout/complete/
 *     reconciliation)
 *     produce contract-conformant signed requests;
 *   - it parses the success/error envelopes and maps the stable error codes
 *     (400/401/403/404/409 incl. idempotency conflict/422/429/503);
 *   - idempotency-conflict is non-retryable, transient failures/timeouts retry
 *     with the SAME idempotency key, and unknown/extra optional fields are
 *     tolerated (forward compatibility within /v1).
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash, createHmac } from "crypto";

import {
  internalApiRequest,
  PartnerApiError,
  QUERY_TIMEOUT_MS,
  MUTATION_TIMEOUT_MS,
} from "./partner-client";

/* ------------------------------------------------------------------------- *
 * THE SHARED CONTRACT (must be identical to the producer test's CONTRACT)
 * ------------------------------------------------------------------------- */

const CONTRACT = Object.freeze({
  headers: Object.freeze({
    clientId: "x-kk-client-id",
    keyId: "x-kk-key-id",
    timestamp: "x-kk-timestamp",
    nonce: "x-kk-nonce",
    signature: "x-kk-signature",
    idempotencyKey: "idempotency-key",
  }),

  emptyBodySha256:
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",

  clientId: "kirimkode-main",
  currentKeyId: "key-current-2026",
  currentSecret: "contract-hmac-secret-current-0123456789ab",
  previousKeyId: "key-previous-2025",
  previousSecret: "contract-hmac-secret-previous-0123456789cd",

  maxClockSkewSeconds: 300,
  nonceTtlSeconds: 600,

  operations: Object.freeze({
    inventory: Object.freeze({ method: "GET", path: "/api/internal/v1/inventory", idempotent: false }),
    reserve: Object.freeze({ method: "POST", path: "/api/internal/v1/orders/reserve", idempotent: true }),
    status: Object.freeze({ method: "GET", path: "/api/internal/v1/orders/order-uuid-1", idempotent: false }),
    cancel: Object.freeze({ method: "POST", path: "/api/internal/v1/orders/order-uuid-1/cancel", idempotent: true }),
    timeout: Object.freeze({ method: "POST", path: "/api/internal/v1/orders/order-uuid-1/timeout", idempotent: true }),
    // Closes a successful order's listening window and releases its number hold.
    // The order stays `success` and no money moves; only the hold ends.
    complete: Object.freeze({ method: "POST", path: "/api/internal/v1/orders/order-uuid-1/complete", idempotent: true }),
    reconciliation: Object.freeze({ method: "POST", path: "/api/internal/v1/reconciliation/orders", idempotent: true }),
  }),

  reserveVector: Object.freeze({
    method: "POST",
    path: "/api/internal/v1/orders/reserve",
    timestampSeconds: 1_700_000_000,
    nonce: "0123456789abcdef0123456789abcdef",
    idempotencyKey: "reserve-key-1",
    body:
      '{"buyerOrderRef":"buyer-ref-1","buyerAccountRef":"acct-ref-1","quoteVersion":1,"filter":{"service":"wa","country":"ID","operator":"any"}}',
    bodySha256:
      "8969406059ccf5e95b4c4950ed1eccd5d998f2646473fdb26058db5b98254995",
    signature:
      "9bebfec0d02c4b9b587eea8394ddab3541a0d5875d0c3536bfbd4d5acb59968f",
  }),

  inventoryVector: Object.freeze({
    method: "GET",
    path: "/api/internal/v1/inventory?service=wa&country=ID&operator=any",
    timestampSeconds: 1_700_000_000,
    nonce: "fedcba9876543210fedcba9876543210",
    idempotencyKey: "",
    signature:
      "dcafae92b7631ef7ce19b56e266b91656852ff7e5c096d08dfbfd2d28d1b45f4",
  }),

  errorTable: Object.freeze({
    validation: Object.freeze({ status: 400, code: "VALIDATION_ERROR", retryable: false }),
    authentication: Object.freeze({ status: 401, code: "AUTHENTICATION_FAILED", retryable: false }),
    forbidden: Object.freeze({ status: 403, code: "FORBIDDEN", retryable: false }),
    not_found: Object.freeze({ status: 404, code: "RESOURCE_NOT_FOUND", retryable: false }),
    idempotency_conflict: Object.freeze({ status: 409, code: "IDEMPOTENCY_CONFLICT", retryable: false }),
    out_of_stock: Object.freeze({ status: 409, code: "OUT_OF_STOCK", retryable: false }),
    terminal_state_conflict: Object.freeze({ status: 422, code: "TERMINAL_STATE_CONFLICT", retryable: false }),
    cancel_not_allowed: Object.freeze({ status: 422, code: "CANCEL_NOT_ALLOWED", retryable: false }),
    price_out_of_guardrail: Object.freeze({ status: 422, code: "PRICE_OUT_OF_GUARDRAIL", retryable: false }),
    rate_limited: Object.freeze({ status: 429, code: "RATE_LIMITED", retryable: true }),
    dependency_unavailable: Object.freeze({ status: 503, code: "DEPENDENCY_UNAVAILABLE", retryable: true }),
  }),

  /** Stable client-facing codes partner-client maps each HTTP status to. */
  clientErrorByStatus: Object.freeze({
    400: Object.freeze({ code: "PARTNER_BAD_REQUEST", retryable: false }),
    401: Object.freeze({ code: "PARTNER_AUTH_FAILED", retryable: false }),
    403: Object.freeze({ code: "PARTNER_POLICY_DENIED", retryable: false }),
    404: Object.freeze({ code: "PARTNER_NOT_FOUND", retryable: false }),
    409: Object.freeze({ code: "PARTNER_CONFLICT", retryable: false }),
    422: Object.freeze({ code: "PARTNER_INVALID_TRANSITION", retryable: false }),
    429: Object.freeze({ code: "PARTNER_RATE_LIMITED", retryable: true }),
    503: Object.freeze({ code: "PARTNER_UNAVAILABLE", retryable: true }),
  }),

  /** Client timeouts (design section 4). */
  queryTimeoutMs: 3000,
  mutationTimeoutMs: 8000,
});

/** Reference canonical algorithm — embedded verbatim on both sides. */
function contractCanonicalString(
  method: string,
  path: string,
  timestampSeconds: string,
  nonce: string,
  bodySha256Hex: string,
  idempotencyKey: string,
): string {
  return [
    method.toUpperCase(),
    path,
    timestampSeconds,
    nonce,
    bodySha256Hex.toLowerCase(),
    idempotencyKey,
  ].join("\n");
}

function contractSha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function contractSignature(canonical: string, secret: string): string {
  return createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

/* ------------------------------------------------------------------------- *
 * Test env: configure partner-client with the contract credential
 * ------------------------------------------------------------------------- */

const BASE = "https://partner-api.kirimkode.com/api/internal/v1";

function setEnv(): void {
  process.env.PARTNER_INTERNAL_API_URL = BASE;
  process.env.PARTNER_INTERNAL_API_HMAC_CLIENT_ID = CONTRACT.clientId;
  process.env.PARTNER_INTERNAL_API_HMAC_KEY_ID = CONTRACT.currentKeyId;
  process.env.PARTNER_INTERNAL_API_HMAC_SECRET = CONTRACT.currentSecret;
}

function clearEnv(): void {
  delete process.env.PARTNER_INTERNAL_API_URL;
  delete process.env.PARTNER_INTERNAL_API_HMAC_CLIENT_ID;
  delete process.env.PARTNER_INTERNAL_API_HMAC_KEY_ID;
  delete process.env.PARTNER_INTERNAL_API_HMAC_SECRET;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type CapturedRequest = { url: string; init: RequestInit; headers: Record<string, string> };

function captureFetch(status = 200, body: unknown = { data: {}, requestId: "req" }) {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(status, body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function readCall(fetchMock: ReturnType<typeof vi.fn>, index = 0): CapturedRequest {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
}

describe("Internal API v1 contract — CONSUMER", () => {
  beforeEach(() => setEnv());
  afterEach(() => {
    vi.restoreAllMocks();
    clearEnv();
  });

  describe("canonicalization is pinned to the shared golden vectors", () => {
    it("the reference algorithm reproduces the golden reserve signature", () => {
      const v = CONTRACT.reserveVector;
      expect(contractSha256Hex(v.body)).toBe(v.bodySha256);
      const canonical = contractCanonicalString(
        v.method,
        v.path,
        String(v.timestampSeconds),
        v.nonce,
        v.bodySha256,
        v.idempotencyKey,
      );
      expect(contractSignature(canonical, CONTRACT.currentSecret)).toBe(v.signature);
    });

    it("the reference algorithm reproduces the golden inventory (read) signature", () => {
      const v = CONTRACT.inventoryVector;
      const canonical = contractCanonicalString(
        v.method,
        v.path,
        String(v.timestampSeconds),
        v.nonce,
        CONTRACT.emptyBodySha256,
        v.idempotencyKey,
      );
      expect(contractSignature(canonical, CONTRACT.currentSecret)).toBe(v.signature);
    });
  });

  describe("partner-client signs per the contract canonicalization + headers", () => {
    it("signs a POST /orders/reserve over the body hash with the idempotency key", async () => {
      const fetchMock = captureFetch(200, { data: { partnerOrderId: "uuid-1" }, requestId: "r1" });

      await internalApiRequest({
        method: "POST",
        endpoint: "/orders/reserve",
        idempotencyKey: CONTRACT.reserveVector.idempotencyKey,
        body: {
          buyerOrderRef: "buyer-ref-1",
          buyerAccountRef: "acct-ref-1",
          quoteVersion: 1,
          filter: { service: "wa", country: "ID", operator: "any" },
        },
      });

      const { url, init, headers } = readCall(fetchMock);
      const signedPath = new URL(url).pathname + new URL(url).search;

      // Header set matches the contract (fetch preserves the given casing).
      expect(headers["X-KK-Client-Id"]).toBe(CONTRACT.clientId);
      expect(headers["X-KK-Key-Id"]).toBe(CONTRACT.currentKeyId);
      expect(headers["X-KK-Nonce"]).toMatch(/^[0-9a-f]{32}$/);
      expect(headers["Idempotency-Key"]).toBe(CONTRACT.reserveVector.idempotencyKey);
      expect(headers["Content-Type"]).toBe("application/json");

      // Recompute the signature via the contract reference algorithm and match.
      const sentBody = init.body as string;
      const bodyHash = contractSha256Hex(sentBody);
      const canonical = contractCanonicalString(
        "POST",
        signedPath,
        headers["X-KK-Timestamp"],
        headers["X-KK-Nonce"],
        bodyHash,
        CONTRACT.reserveVector.idempotencyKey,
      );
      expect(headers["X-KK-Signature"]).toBe(
        contractSignature(canonical, CONTRACT.currentSecret),
      );
    });

    it("signs a GET read with the empty-body hash and no idempotency key", async () => {
      const fetchMock = captureFetch(200, { data: { available: 1 }, requestId: "r2" });

      await internalApiRequest({
        method: "GET",
        endpoint: "/inventory",
        query: { service: "wa", country: "ID", operator: "any" },
      });

      const { url, init, headers } = readCall(fetchMock);
      const signedPath = new URL(url).pathname + new URL(url).search;

      expect(headers["Idempotency-Key"]).toBeUndefined();
      expect(init.body).toBeUndefined();

      const canonical = contractCanonicalString(
        "GET",
        signedPath,
        headers["X-KK-Timestamp"],
        headers["X-KK-Nonce"],
        CONTRACT.emptyBodySha256,
        "",
      );
      expect(headers["X-KK-Signature"]).toBe(
        contractSignature(canonical, CONTRACT.currentSecret),
      );
    });

    it("produces contract-conformant signed requests for every operation", async () => {
      for (const [name, op] of Object.entries(CONTRACT.operations)) {
        const fetchMock = captureFetch(200, { data: {}, requestId: `r-${name}` });

        // endpoint is relative to the /api/internal/v1 base path.
        const endpoint = op.path.replace("/api/internal/v1", "");
        await internalApiRequest({
          method: op.method as "GET" | "POST",
          endpoint,
          idempotencyKey: op.idempotent ? `${name}-key-1` : undefined,
          body: op.method === "POST" ? { op: name } : undefined,
        });

        const { url, init, headers } = readCall(fetchMock);
        const signedPath = new URL(url).pathname + new URL(url).search;
        const sentBody = (init.body as string | undefined) ?? "";
        const bodyHash = sentBody === "" ? CONTRACT.emptyBodySha256 : contractSha256Hex(sentBody);
        const idempotencyKey = op.idempotent ? `${name}-key-1` : "";

        const canonical = contractCanonicalString(
          op.method,
          signedPath,
          headers["X-KK-Timestamp"],
          headers["X-KK-Nonce"],
          bodyHash,
          idempotencyKey,
        );
        expect(headers["X-KK-Signature"], `operation ${name} signature`).toBe(
          contractSignature(canonical, CONTRACT.currentSecret),
        );
        if (op.idempotent) {
          expect(headers["Idempotency-Key"]).toBe(idempotencyKey);
        } else {
          expect(headers["Idempotency-Key"]).toBeUndefined();
        }
      }
    });

    it("exposes the contract's client timeouts", () => {
      expect(QUERY_TIMEOUT_MS).toBe(CONTRACT.queryTimeoutMs);
      expect(MUTATION_TIMEOUT_MS).toBe(CONTRACT.mutationTimeoutMs);
    });
  });

  describe("parses the contract envelopes and maps error codes", () => {
    it("returns { data, requestId } from a success envelope", async () => {
      captureFetch(200, { data: { available: 3, quoteVersion: "q1" }, requestId: "ok-1" });
      const { data, requestId } = await internalApiRequest<{ available: number }>({
        method: "GET",
        endpoint: "/inventory",
      });
      expect(data).toEqual({ available: 3, quoteVersion: "q1" });
      expect(requestId).toBe("ok-1");
    });

    it("maps each contract HTTP status to the pinned client error", async () => {
      for (const [statusStr, expected] of Object.entries(CONTRACT.clientErrorByStatus)) {
        const status = Number(statusStr);
        // Return a FRESH Response per call: retryable statuses (429/503) make
        // the client retry, and a Response body can only be read once.
        const fetchMock = vi
          .fn()
          .mockImplementation(async () =>
            jsonResponse(status, { error: { code: "X", message: "m", retryable: expected.retryable }, requestId: `e-${status}` }),
          );
        vi.stubGlobal("fetch", fetchMock);

        const err = await internalApiRequest({ method: "GET", endpoint: "/inventory" }).catch((e) => e);
        expect(err, `status ${status}`).toBeInstanceOf(PartnerApiError);
        expect(err.code, `status ${status} code`).toBe(expected.code);
        expect(err.status, `status ${status} status`).toBe(status);
        expect(err.retryable, `status ${status} retryable`).toBe(expected.retryable);
        expect(err.requestId, `status ${status} requestId`).toBe(`e-${status}`);
        vi.restoreAllMocks();
        setEnv();
      }
    });

    it("treats a 409 IDEMPOTENCY_CONFLICT as a non-retryable PARTNER_CONFLICT (no retry)", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(409, {
            error: { code: CONTRACT.errorTable.idempotency_conflict.code, message: "conflict", retryable: false },
            requestId: "conflict-1",
          }),
        );
      vi.stubGlobal("fetch", fetchMock);

      const err = await internalApiRequest({
        method: "POST",
        endpoint: "/orders/reserve",
        idempotencyKey: "reserve-key-1",
        body: { a: 1 },
      }).catch((e) => e);

      expect(err).toBeInstanceOf(PartnerApiError);
      expect(err.code).toBe("PARTNER_CONFLICT");
      expect(err.retryable).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1); // conflict is definitive, no retry
    });
  });

  describe("retry, timeout, and idempotency-key stability", () => {
    it("retries a 503 once, reusing the SAME idempotency key with a fresh nonce", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(503, { error: { code: "DEPENDENCY_UNAVAILABLE", retryable: true }, requestId: "d1" }),
        )
        .mockResolvedValueOnce(jsonResponse(200, { data: { ok: true }, requestId: "d2" }));
      vi.stubGlobal("fetch", fetchMock);

      const { data } = await internalApiRequest<{ ok: boolean }>({
        method: "POST",
        endpoint: "/orders/reserve",
        idempotencyKey: "reserve-key-1",
        body: { a: 1 },
      });

      expect(data).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const first = readCall(fetchMock, 0).headers;
      const second = readCall(fetchMock, 1).headers;
      expect(first["Idempotency-Key"]).toBe("reserve-key-1");
      expect(second["Idempotency-Key"]).toBe("reserve-key-1"); // same key across retries
      expect(second["X-KK-Nonce"]).not.toBe(first["X-KK-Nonce"]); // fresh nonce per attempt
    });

    it("maps a network/timeout failure to a retryable PARTNER_UNAVAILABLE and retries once", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("aborted"));
      vi.stubGlobal("fetch", fetchMock);

      const err = await internalApiRequest({ method: "GET", endpoint: "/inventory" }).catch((e) => e);
      expect(err).toBeInstanceOf(PartnerApiError);
      expect(err.code).toBe("PARTNER_UNAVAILABLE");
      expect(err.retryable).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("optional-field forward compatibility (within /v1)", () => {
    it("tolerates unknown extra fields in a success envelope's data", async () => {
      captureFetch(200, {
        data: {
          partnerOrderId: "uuid-9",
          status: "waiting_sms",
          // Fields the current consumer does not know about must be preserved,
          // not rejected (design section 4: new fields are optional in /v1).
          futureField: "ignore-me",
          nested: { anotherFuture: [1, 2, 3] },
        },
        requestId: "fwd-1",
      });

      const { data } = await internalApiRequest<Record<string, unknown>>({
        method: "POST",
        endpoint: "/orders/reserve",
        idempotencyKey: "reserve-key-1",
        body: { a: 1 },
      });

      expect(data.partnerOrderId).toBe("uuid-9");
      expect(data.status).toBe("waiting_sms");
      expect(data.futureField).toBe("ignore-me");
      expect(data.nested).toEqual({ anotherFuture: [1, 2, 3] });
    });

    it("tolerates unknown extra fields in an error envelope", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse(422, {
          error: {
            code: CONTRACT.errorTable.terminal_state_conflict.code,
            message: "terminal",
            retryable: false,
            futureDetail: { hint: "safe-to-ignore" },
          },
          requestId: "fwd-err-1",
          futureTopLevel: true,
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const err = await internalApiRequest({
        method: "POST",
        endpoint: "/orders/order-uuid-1/timeout",
        idempotencyKey: "timeout-key-1",
        body: { observedAt: "2026-01-01T00:00:00Z", reason: "expired" },
      }).catch((e) => e);

      expect(err).toBeInstanceOf(PartnerApiError);
      expect(err.code).toBe("PARTNER_INVALID_TRANSITION");
      expect(err.status).toBe(422);
      expect(err.requestId).toBe("fwd-err-1");
    });
  });
});
