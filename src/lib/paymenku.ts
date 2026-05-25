/**
 * Paymenku Payment Gateway API Client
 * Docs: https://paymenku.com (API Documentation)
 *
 * Endpoints:
 * - POST /transaction/create  → Buat transaksi baru
 * - GET  /check-status/{id}   → Cek status transaksi
 * - GET  /payment-channels    → List payment channels
 *
 * Webhook: POST callback ke URL yang diset di dashboard merchant
 */

const PAYMENKU_BASE_URL =
  process.env.PAYMENKU_BASE_URL || "https://paymenku.com/api/v1";
const PAYMENKU_API_KEY = process.env.PAYMENKU_API_KEY || "";
const PAYMENKU_WEBHOOK_SECRET = process.env.PAYMENKU_WEBHOOK_SECRET || "";

export type PaymenkuStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded";

// ==================== TYPES ====================

export interface CreateTransactionParams {
  reference_id: string;
  amount: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  channel_code: string;
  return_url: string;
}

export interface PaymentInfo {
  transaction_id: string;
  transaction_status: string;
  // Virtual Account
  bank?: string;
  va_number?: string;
  // E-Wallet
  checkout_url?: string;
  // QRIS
  qr_url?: string;
  payment_page?: string;
  // Common
  expiration_date: string;
}

export interface TransactionResponse {
  status: "success" | "error";
  data: {
    trx_id: string;
    reference_id: string;
    amount: string;
    status: PaymenkuStatus;
    pay_url: string;
    payment_info: PaymentInfo;
  };
  message?: string;
}

export interface CheckStatusResponse {
  status: "success" | "error";
  data: {
    trx_id: string;
    reference_id: string;
    amount: string;
    total_fee: string;
    amount_received: string;
    status: PaymenkuStatus;
    is_sandbox: boolean;
    customer_name: string;
    customer_email: string;
    payment_channel: {
      code: string;
      name: string;
      type: string;
    };
    pay_url: string;
    paid_at: string | null;
    created_at: string;
    updated_at: string;
  };
}

export interface ChannelFee {
  flat: number;
  percent: number;
  display: string;
}

export interface PaymentChannel {
  code: string;
  name: string;
  type: string;
  type_label: string;
  icon: string | null;
  description: string | null;
  fee: ChannelFee;
}

export interface PaymentChannelsResponse {
  status: "success" | "error";
  data: {
    va: PaymentChannel[];
    ewallet: PaymentChannel[];
    qris: PaymentChannel[];
  };
}

export interface WebhookPayload {
  event: "payment.status_updated";
  trx_id: string;
  reference_id: string;
  status: PaymenkuStatus;
  amount: string;
  total_fee: string;
  amount_received: string;
  payment_channel: string;
  customer_name: string;
  customer_email: string;
  paid_at: string | null;
  created_at: string;
  is_sandbox?: boolean;
}

// ==================== API CLIENT ====================

class PaymenkuError extends Error {
  status: number;
  payload?: unknown;
  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "PaymenkuError";
    this.status = status;
    this.payload = payload;
  }
}

async function paymentRequest<T>(
  endpoint: string,
  options: RequestInit & { body?: unknown } = {}
): Promise<T> {
  const url = `${PAYMENKU_BASE_URL}${endpoint}`;
  const method = (options.method || "GET").toUpperCase();

  // Paymenku expects form-urlencoded body untuk POST (bukan JSON).
  // Kalau pakai JSON, server return validation.required untuk semua field.
  let bodyPayload: string | undefined;
  let contentType: string | undefined;

  if (method !== "GET" && options.body !== undefined) {
    let parsed: Record<string, unknown> | null = null;
    if (typeof options.body === "string") {
      try {
        parsed = JSON.parse(options.body);
      } catch {
        parsed = null;
      }
    } else if (typeof options.body === "object" && options.body !== null) {
      parsed = options.body as unknown as Record<string, unknown>;
    }

    if (parsed && typeof parsed === "object") {
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(parsed)) {
        if (v === undefined || v === null) continue;
        form.append(k, String(v));
      }
      bodyPayload = form.toString();
      contentType = "application/x-www-form-urlencoded";
    } else {
      bodyPayload = String(options.body);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${PAYMENKU_API_KEY}`,
    Accept: "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (contentType) headers["Content-Type"] = contentType;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      method,
      headers,
      body: bodyPayload,
    });
  } catch (e) {
    throw new PaymenkuError(
      `Paymenku tidak bisa dihubungi: ${(e as Error).message}`,
      0
    );
  }

  // Baca raw text dulu — Paymenku kadang return HTML (500 page) saat ada bug
  // di sisi mereka (mis. SQL error). Kalau langsung res.json() bakal lempar
  // "Unexpected token '<'" yang menyesatkan user.
  const rawText = await res.text();
  let data: unknown = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      // Bukan JSON — kemungkinan HTML error page
      data = null;
    }
  }

  if (!res.ok) {
    const obj =
      (data as { message?: string; error?: string; errors?: unknown } | null) ||
      null;
    let message =
      obj?.message ||
      obj?.error ||
      `Layanan Paymenku sedang bermasalah (HTTP ${res.status}). Coba lagi nanti atau gunakan channel pembayaran lain.`;
    // Tambahkan detail validation error kalau ada
    if (obj?.errors && typeof obj.errors === "object") {
      const firstField = Object.keys(obj.errors as Record<string, unknown>)[0];
      const firstMsg = (obj.errors as Record<string, string[]>)[firstField]?.[0];
      if (firstField && firstMsg) {
        message += ` (${firstField}: ${firstMsg})`;
      }
    }
    throw new PaymenkuError(message, res.status, data);
  }

  if (data === null) {
    throw new PaymenkuError(
      "Paymenku mengembalikan response tidak valid. Coba lagi atau gunakan channel pembayaran lain.",
      res.status
    );
  }

  return data as T;
}

// ==================== FUNCTIONS ====================

/**
 * Buat transaksi pembayaran baru.
 *
 * Channel codes per docs lowercase: qris, bca_va, bni_va, dana, ovo, dst.
 * Idempotency-Key opsional — bila network retry, request yang sama tidak
 * akan dobel charge di sisi Paymenku.
 */
export async function createTransaction(
  params: CreateTransactionParams,
  opts: { idempotencyKey?: string } = {}
): Promise<TransactionResponse> {
  const headers: Record<string, string> = {};
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  return paymentRequest<TransactionResponse>("/transaction/create", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
}

/**
 * Cek status transaksi
 * @param orderId - bisa TRX-xxx (trx_id) atau reference_id
 */
export async function checkTransactionStatus(
  orderId: string
): Promise<CheckStatusResponse> {
  return paymentRequest<CheckStatusResponse>(`/check-status/${orderId}`);
}

/**
 * Ambil daftar payment channels yang tersedia
 */
export async function getPaymentChannels(): Promise<PaymentChannelsResponse> {
  return paymentRequest<PaymentChannelsResponse>("/payment-channels");
}

/**
 * Generate reference ID unik untuk deposit
 */
export function generateReferenceId(userId: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `DEP-${userId}-${timestamp}-${random}`;
}

/**
 * Hitung total amount termasuk fee
 */
export function calculateTotalWithFee(
  amount: number,
  channel: PaymentChannel
): { total: number; fee: number } {
  const flatFee = channel.fee.flat;
  const percentFee = (amount * channel.fee.percent) / 100;
  const fee = Math.ceil(flatFee + percentFee);
  return { total: amount + fee, fee };
}

/**
 * Verifikasi signature webhook dari Paymenku.
 * Formula (per docs): HMAC-SHA256(timestamp + "." + raw_body, webhook_secret)
 * Header: X-PaymenKu-Signature, X-PaymenKu-Timestamp
 *
 * PENTING: rawBody harus body request mentah (string), bukan hasil JSON.parse +
 * JSON.stringify, karena re-encoding bisa mengubah byte order/whitespace.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  timestamp: string,
  signature: string
): Promise<boolean> {
  if (!PAYMENKU_WEBHOOK_SECRET || !signature || !timestamp) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(PAYMENKU_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const data = `${timestamp}.${rawBody}`;
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const provided = signature.toLowerCase();
  if (expected.length !== provided.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Cek apakah webhook secret dikonfigurasi.
 * Berguna untuk fallback ke callback-verification ketika belum diset.
 */
export function isWebhookSecretConfigured(): boolean {
  return PAYMENKU_WEBHOOK_SECRET.length > 0;
}
