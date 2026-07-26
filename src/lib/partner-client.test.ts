/**
 * Unit tests for the Internal API v1 client (task 9.6, design section 4).
 *
 * These assert the wire contract the Partner Platform verifier depends on:
 * header set, canonical string, HMAC-SHA256 signature, client timeouts,
 * stable error mapping, and same-idempotency-key retry.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash, createHmac } from "crypto";

import {
  internalApiRequest,
  isPartnerClientConfigured,
  PartnerApiError,
  QUERY_TIMEOUT_MS,
  MUTATION_TIMEOUT_MS,
} from "./partner-client";

const BASE = "https://partner-api.kirimkode.com/api/internal/v1";
const CLIENT_ID = "kirimkode-main";
const KEY_ID = "key-2026-01";
const SECRET = "internal-api-hmac-secret-value-01234567890";

const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function setEnv() {
  process.env.PARTNER_INTERNAL_API_URL = BASE;
  process.env.PARTNER_INTERNAL_API_HMAC_CLIENT_ID = CLIENT_ID;
  process.env.PARTNER_INTERNAL_API_HMAC_KEY_ID = KEY_ID;
  process.env.PARTNER_INTERNAL_API_HMAC_SECRET = SECRET;
}

function clearEnv() {
  delete process.env.PARTNER_INTERNAL_API_URL;
  delete process.env.PARTNER_INTERNAL_API_HMAC_CLIENT_ID;
  delete process.env.PARTNER_INTERNAL_API_HMAC_KEY_ID;
  delete process.env.PARTNER_INTERNAL_API_HMAC_SECRET;
}

/** Recompute the canonical string exactly as the Partner verifier does. */
function canonical(
  method: string,
  signedPath: string,
  ts: string,
  nonce: string,
  bodyHash: string,
  idempotencyKey: string,
): string {
  return [method.toUpperCase(), signedPath, ts, nonce, bodyHash, idempotencyKey].join("\n");
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("internalApiRequest — signing contract", () => {
  beforeEach(() => setEnv());
  afterEach(() => {
    vi.restoreAllMocks();
    clearEnv();
  });

  it("signs a GET with the canonical string the Partner verifier recomputes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { available: 1 }, requestId: "r1" }));
    vi.stubGlobal("fetch", fetchMock);

    const { data, requestId } = await internalApiRequest<{ available: number }>({
      method: "GET",
      endpoint: "/inventory",
      query: { service: "wa", country: "ID", operator: "any" },
    });

    expect(data).toEqual({ available: 1 });
    expect(requestId).toBe("r1");

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(calledUrl);
    const headers = init.headers as Record<string, string>;

    // No idempotency key / no body for a read.
    expect(headers["Idempotency-Key"]).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(headers["X-KK-Client-Id"]).toBe(CLIENT_ID);
    expect(headers["X-KK-Key-Id"]).toBe(KEY_ID);
    expect(headers["X-KK-Nonce"]).toMatch(/^[0-9a-f]{32}$/);

    const signedPath = url.pathname + url.search;
    const expectedCanonical = canonical(
      "GET",
      signedPath,
      headers["X-KK-Timestamp"],
      headers["X-KK-Nonce"],
      EMPTY_SHA256,
      "",
    );
    const expectedSig = createHmac("sha256", SECRET)
      .update(expectedCanonical, "utf8")
      .digest("hex");

    expect(headers["X-KK-Signature"]).toBe(expectedSig);
  });

  it("signs a POST over the body hash and carries the idempotency key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { partnerOrderId: "uuid-1" }, requestId: "r2" }));
    vi.stubGlobal("fetch", fetchMock);

    const body = { buyerOrderRef: "b-1", quoteVersion: "q1" };
    await internalApiRequest({
      method: "POST",
      endpoint: "/orders/reserve",
      idempotencyKey: "reserve-key-1",
      body,
    });

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(calledUrl);
    const headers = init.headers as Record<string, string>;

    expect(headers["Idempotency-Key"]).toBe("reserve-key-1");
    expect(headers["Content-Type"]).toBe("application/json");

    const sentBody = init.body as string;
    const bodyHash = createHash("sha256").update(sentBody, "utf8").digest("hex");
    const expectedCanonical = canonical(
      "POST",
      url.pathname + url.search,
      headers["X-KK-Timestamp"],
      headers["X-KK-Nonce"],
      bodyHash,
      "reserve-key-1",
    );
    const expectedSig = createHmac("sha256", SECRET)
      .update(expectedCanonical, "utf8")
      .digest("hex");

    expect(headers["X-KK-Signature"]).toBe(expectedSig);
  });

  it("exposes the design-mandated client timeouts", () => {
    expect(QUERY_TIMEOUT_MS).toBe(3000);
    expect(MUTATION_TIMEOUT_MS).toBe(8000);
  });
});

describe("internalApiRequest — retry and error mapping", () => {
  beforeEach(() => setEnv());
  afterEach(() => {
    vi.restoreAllMocks();
    clearEnv();
  });

  it("retries a retryable failure once, reusing the same idempotency key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: { code: "DEP", retryable: true }, requestId: "r3" }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { ok: true }, requestId: "r4" }));
    vi.stubGlobal("fetch", fetchMock);

    const { data } = await internalApiRequest<{ ok: boolean }>({
      method: "POST",
      endpoint: "/orders/reserve",
      idempotencyKey: "same-key",
      body: { a: 1 },
    });

    expect(data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstHeaders = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    const secondHeaders = (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<string, string>;

    // Same idempotency key across attempts, fresh nonce per attempt.
    expect(firstHeaders["Idempotency-Key"]).toBe("same-key");
    expect(secondHeaders["Idempotency-Key"]).toBe("same-key");
    expect(secondHeaders["X-KK-Nonce"]).not.toBe(firstHeaders["X-KK-Nonce"]);
  });

  it("maps a 401 to a non-retryable PARTNER_AUTH_FAILED without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: "AUTH" }, requestId: "r5" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      internalApiRequest({ method: "GET", endpoint: "/inventory" }),
    ).rejects.toMatchObject({ code: "PARTNER_AUTH_FAILED", retryable: false, status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a network error to a retryable PARTNER_UNAVAILABLE and retries once", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("boom"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      internalApiRequest({ method: "GET", endpoint: "/inventory" }),
    ).rejects.toMatchObject({ code: "PARTNER_UNAVAILABLE", retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("client configuration guard", () => {
  afterEach(() => clearEnv());

  it("reports not configured and throws PARTNER_CONFIG_MISSING when creds are absent", async () => {
    clearEnv();
    expect(isPartnerClientConfigured()).toBe(false);
    await expect(
      internalApiRequest({ method: "GET", endpoint: "/inventory" }),
    ).rejects.toBeInstanceOf(PartnerApiError);
    await expect(
      internalApiRequest({ method: "GET", endpoint: "/inventory" }),
    ).rejects.toMatchObject({ code: "PARTNER_CONFIG_MISSING" });
  });
});
