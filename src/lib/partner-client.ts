/**
 * Internal API v1 client — Main Platform -> Partner Platform (Pluto).
 *
 * Task 9.6 (design sections 4 & 5). This is the ONLY way Main talks to the
 * Partner Platform Internal API. It signs every request with HMAC-SHA256 using
 * a Main-owned service credential and enforces the client timeouts, stable
 * error mapping, and same-idempotency-key retry behaviour mandated by the
 * design.
 *
 * Canonical string (MUST match the Partner verifier exactly, see
 * `kirimkode-partner/src/domain/task-9-1/internal-api-signing.ts`):
 *
 *   METHOD \n path(+query) \n unixSeconds \n nonce \n sha256hex(body) \n idempotencyKey
 *
 * joined by "\n" in that fixed order. A request without an idempotency key
 * (a read) signs an empty final field. The body hash is the lower-case hex
 * SHA-256 of the raw request body; an empty body hashes to the well-known
 * SHA-256 of the empty string.
 *
 * Cross-boundary references are opaque: Main never reads the Partner DB and
 * only exchanges pseudonymous refs. This client transmits no buyer PII and no
 * secret values in logs.
 */

import { createHash, createHmac, randomBytes } from "crypto";

// --- Header names (lower-case is fine; fetch normalizes) ---
const HEADERS = {
  clientId: "X-KK-Client-Id",
  keyId: "X-KK-Key-Id",
  timestamp: "X-KK-Timestamp",
  nonce: "X-KK-Nonce",
  signature: "X-KK-Signature",
  idempotencyKey: "Idempotency-Key",
} as const;

// --- Client timeouts (design section 4) ---
export const QUERY_TIMEOUT_MS = 3000; // GET / read
export const MUTATION_TIMEOUT_MS = 8000; // POST / mutation

// SHA-256 of the empty string (RFC-known constant), used for empty bodies.
const EMPTY_BODY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** Stable, non-leaking error codes surfaced to Main callers/saga. */
export type PartnerErrorCode =
  | "PARTNER_UNAVAILABLE" // network/timeout/5xx — retryable
  | "PARTNER_RATE_LIMITED" // 429 — retryable
  | "PARTNER_AUTH_FAILED" // 401 — misconfigured credential
  | "PARTNER_POLICY_DENIED" // 403
  | "PARTNER_NOT_FOUND" // 404
  | "PARTNER_CONFLICT" // 409 (incl. idempotency conflict)
  | "PARTNER_INVALID_TRANSITION" // 422
  | "PARTNER_BAD_REQUEST" // 400
  | "PARTNER_CONFIG_MISSING" // client not configured
  | "PARTNER_ERROR"; // anything else

/**
 * Error thrown for any non-2xx or transport failure. Carries only a stable
 * code, HTTP status, retryable flag, and the Partner requestId (for tracing).
 * The `message` is a safe generic string — never a raw upstream body.
 */
export class PartnerApiError extends Error {
  readonly code: PartnerErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly requestId: string | null;

  constructor(
    code: PartnerErrorCode,
    status: number,
    retryable: boolean,
    requestId: string | null = null,
  ) {
    super(code);
    this.name = "PartnerApiError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.requestId = requestId;
  }
}

interface PartnerClientConfig {
  baseUrl: string;
  clientId: string;
  keyId: string;
  secret: string;
}

/**
 * Read config lazily so importing this module never throws at build time.
 * Returns null when the client is not configured (Pluto simply stays
 * unavailable rather than crashing Main).
 */
function readConfig(): PartnerClientConfig | null {
  const baseUrl = (
    process.env.PARTNER_INTERNAL_API_URL ||
    "https://partner-api.kirimkode.com/api/internal/v1"
  ).replace(/\/$/, "");
  const clientId = process.env.PARTNER_INTERNAL_API_HMAC_CLIENT_ID || "";
  const keyId = process.env.PARTNER_INTERNAL_API_HMAC_KEY_ID || "";
  const secret = process.env.PARTNER_INTERNAL_API_HMAC_SECRET || "";

  if (!clientId || !keyId || !secret) return null;
  return { baseUrl, clientId, keyId, secret };
}

/** True when the partner client has enough config to make signed requests. */
export function isPartnerClientConfigured(): boolean {
  return readConfig() !== null;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function buildCanonicalString(
  method: string,
  signedPath: string,
  timestampSeconds: number,
  nonce: string,
  bodySha256Hex: string,
  idempotencyKey: string,
): string {
  return [
    method.toUpperCase(),
    signedPath,
    String(timestampSeconds),
    nonce,
    bodySha256Hex.toLowerCase(),
    idempotencyKey,
  ].join("\n");
}

/** Map an HTTP status (and optional upstream stable code) to a client error. */
function mapError(
  status: number,
  requestId: string | null,
  upstreamCode: string | null,
  upstreamRetryable: boolean | null,
): PartnerApiError {
  // Prefer the Partner's own stable code when it is one we recognise; the
  // Partner envelope codes are designed to be safe to surface.
  switch (status) {
    case 400:
      return new PartnerApiError("PARTNER_BAD_REQUEST", status, false, requestId);
    case 401:
      return new PartnerApiError("PARTNER_AUTH_FAILED", status, false, requestId);
    case 403:
      return new PartnerApiError("PARTNER_POLICY_DENIED", status, false, requestId);
    case 404:
      return new PartnerApiError("PARTNER_NOT_FOUND", status, false, requestId);
    case 409:
      return new PartnerApiError("PARTNER_CONFLICT", status, false, requestId);
    case 422:
      return new PartnerApiError("PARTNER_INVALID_TRANSITION", status, false, requestId);
    case 429:
      return new PartnerApiError("PARTNER_RATE_LIMITED", status, true, requestId);
    default:
      if (status >= 500) {
        return new PartnerApiError("PARTNER_UNAVAILABLE", status, true, requestId);
      }
      // Unknown non-2xx: honour upstream retryable hint if present.
      return new PartnerApiError(
        "PARTNER_ERROR",
        status,
        upstreamRetryable ?? false,
        requestId,
      );
  }
}

export interface InternalApiRequest {
  method: "GET" | "POST";
  /** Endpoint relative to the base path, e.g. "/inventory" or "/orders/reserve". */
  endpoint: string;
  /** Query params for reads (appended to the URL and included in the signature). */
  query?: Record<string, string | number | undefined>;
  /** JSON body for mutations. Serialized deterministically for signing. */
  body?: unknown;
  /** Required for mutations; retries reuse the exact same key. */
  idempotencyKey?: string;
}

/** Success envelope from the Partner Internal API. */
interface SuccessEnvelope<T> {
  data: T;
  requestId?: string;
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; retryable?: boolean };
  requestId?: string;
}

/**
 * Perform one signed attempt. Throws {@link PartnerApiError} on transport
 * failure, timeout, or non-2xx. Fresh nonce/timestamp/signature per call; the
 * caller-supplied idempotency key is held constant across retries.
 */
async function attempt<T>(
  config: PartnerClientConfig,
  req: InternalApiRequest,
): Promise<{ data: T; requestId: string | null }> {
  const url = new URL(config.baseUrl + req.endpoint);
  if (req.query) {
    for (const [k, v] of Object.entries(req.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const signedPath = url.pathname + url.search;
  const bodyStr = req.body === undefined ? "" : JSON.stringify(req.body);
  const bodyHash = bodyStr === "" ? EMPTY_BODY_SHA256 : sha256Hex(bodyStr);
  const timestampSeconds = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(16).toString("hex"); // 128-bit hex nonce
  const idempotencyKey = req.idempotencyKey ?? "";

  const canonical = buildCanonicalString(
    req.method,
    signedPath,
    timestampSeconds,
    nonce,
    bodyHash,
    idempotencyKey,
  );
  const signature = createHmac("sha256", config.secret)
    .update(canonical, "utf8")
    .digest("hex");

  const headers: Record<string, string> = {
    Accept: "application/json",
    [HEADERS.clientId]: config.clientId,
    [HEADERS.keyId]: config.keyId,
    [HEADERS.timestamp]: String(timestampSeconds),
    [HEADERS.nonce]: nonce,
    [HEADERS.signature]: signature,
  };
  if (bodyStr !== "") headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers[HEADERS.idempotencyKey] = idempotencyKey;

  const timeoutMs = req.method === "GET" ? QUERY_TIMEOUT_MS : MUTATION_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: req.method,
      headers,
      body: bodyStr === "" ? undefined : bodyStr,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    // Network error or abort (timeout) — retryable, leaks nothing.
    throw new PartnerApiError("PARTNER_UNAVAILABLE", 0, true, null);
  } finally {
    clearTimeout(timer);
  }

  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  const requestId =
    (parsed as { requestId?: string } | null)?.requestId ?? null;

  if (!res.ok) {
    const errEnv = (parsed as ErrorEnvelope | null)?.error;
    throw mapError(
      res.status,
      requestId,
      errEnv?.code ?? null,
      typeof errEnv?.retryable === "boolean" ? errEnv.retryable : null,
    );
  }

  return {
    data: (parsed as SuccessEnvelope<T> | null)?.data as T,
    requestId,
  };
}

/**
 * Perform a signed Internal API request with a single retry on retryable
 * failures. Retries reuse the same idempotency key (a new nonce/timestamp is
 * generated per attempt, as required by replay protection), so the Partner
 * idempotency engine returns the first response instead of double-applying.
 */
export async function internalApiRequest<T>(
  req: InternalApiRequest,
): Promise<{ data: T; requestId: string | null }> {
  const config = readConfig();
  if (!config) {
    throw new PartnerApiError("PARTNER_CONFIG_MISSING", 0, false, null);
  }

  try {
    return await attempt<T>(config, req);
  } catch (err) {
    if (err instanceof PartnerApiError && err.retryable) {
      // Same idempotency key, fresh nonce/timestamp on the retry.
      return await attempt<T>(config, req);
    }
    throw err;
  }
}
