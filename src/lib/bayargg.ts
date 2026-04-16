/**
 * BAYAR.GG Payment Gateway API Client
 * Docs: https://www.bayar.gg/api-docs
 *
 * Method: GoPay Merchant QRIS (gopay_qris)
 * Fee: 0.5%
 * Auth: X-API-Key header
 */

const BAYARGG_BASE_URL = process.env.BAYARGG_BASE_URL || "https://v2.bayar.gg/api";
const BAYARGG_API_KEY = process.env.BAYARGG_API_KEY || "";
const BAYARGG_QRIS_STRING = process.env.BAYARGG_QRIS_STRING || "";
const BAYARGG_WEBHOOK_SECRET = process.env.BAYARGG_WEBHOOK_SECRET || "";

// ==================== TYPES ====================

export interface BayarGGCreatePaymentParams {
  amount: number;
  description: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  callback_url?: string;
  redirect_url?: string;
  use_qris_converter?: boolean;
}

export interface BayarGGPaymentData {
  invoice_id: string;
  amount: number;
  unique_code: number;
  final_amount: number;
  payment_method: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  expires_at: string;
}

export interface BayarGGCreatePaymentResponse {
  success: boolean;
  payment: BayarGGPaymentData;
  payment_url: string;
  qris_converter?: boolean;
  message?: string;
}

export interface BayarGGCheckPaymentResponse {
  success: boolean;
  invoice_id: string;
  status: "pending" | "paid" | "expired" | "cancelled" | "unknown";
  amount: number;
  unique_code: number;
  final_amount: number;
  paid_at: string | null;
  expires_at: string;
}

// ==================== API CLIENT ====================

async function bayarRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BAYARGG_BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "X-API-Key": BAYARGG_API_KEY,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok || data.success === false) {
    console.error(`[BAYAR.GG] API Error:`, JSON.stringify(data));
    throw new Error(data.message || data.error || `BAYAR.GG API error: ${res.status} - ${JSON.stringify(data)}`);
  }

  return data as T;
}

// ==================== FUNCTIONS ====================

/**
 * Buat pembayaran baru via GoPay Merchant QRIS
 */
export async function createPayment(
  params: BayarGGCreatePaymentParams
): Promise<BayarGGCreatePaymentResponse> {
  const raw = await bayarRequest<Record<string, unknown>>("/create-payment.php", {
    method: "POST",
    body: JSON.stringify({
      ...params,
      payment_method: "qris",
    }),
  });

  // Normalize: v2 pakai "payment", v1 pakai "data"
  const payment = (raw.payment || raw.data || raw) as BayarGGPaymentData;
  const paymentUrl = (raw.payment_url || raw.pay_url || (payment as unknown as Record<string, unknown>).payment_url || "") as string;

  return {
    success: raw.success as boolean,
    payment,
    payment_url: paymentUrl,
    qris_converter: raw.qris_converter as boolean | undefined,
    message: raw.message as string | undefined,
  };
}

/**
 * Cek status pembayaran
 *
 * PENTING: Fungsi ini TIDAK pakai bayarRequest() karena bayarRequest() throw
 * error saat success === false. Untuk check-payment, kita butuh response
 * apapun (termasuk "success: false") supaya caller bisa cek status.
 * Ini mencegah bug di mana deposit tetap pending karena handler tidak pernah
 * sampai ke logika parsing status "paid".
 */
export async function checkPayment(
  invoiceId: string
): Promise<BayarGGCheckPaymentResponse> {
  const url = `${BAYARGG_BASE_URL}/check-payment?invoice=${encodeURIComponent(invoiceId)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-API-Key": BAYARGG_API_KEY,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000), // 15 detik timeout
    });

    const raw = await res.json();

    // Normalize: response bisa { success, status, ... } (flat) atau { data: { status, ... } } (nested)
    const data = raw.data || raw;

    return {
      success: raw.success ?? true,
      invoice_id: data.invoice_id || invoiceId,
      status: data.status || "unknown",
      amount: data.amount || 0,
      unique_code: data.unique_code || 0,
      final_amount: data.final_amount || data.amount || 0,
      paid_at: data.paid_at || null,
      expires_at: data.expires_at || "",
    };
  } catch (e) {
    console.error(`[BAYAR.GG] checkPayment failed for ${invoiceId}:`, e);
    return {
      success: false,
      invoice_id: invoiceId,
      status: "unknown",
      amount: 0,
      unique_code: 0,
      final_amount: 0,
      paid_at: null,
      expires_at: "",
    };
  }
}

/**
 * Generate reference description untuk deposit
 */
export function generateDescription(userId: string, amount: number): string {
  return `Deposit KirimKode Rp ${amount.toLocaleString("id-ID")} - ${userId.substring(0, 8)}`;
}

/**
 * Hitung fee 2%
 */
export function calculateFee(amount: number): { fee: number; total: number } {
  const fee = Math.ceil(amount * 0.02); // 2%
  return { fee, total: amount + fee };
}

// ==================== QRIS CONVERTER ====================

export interface QrisConvertResponse {
  success: boolean;
  data: {
    original_qris: string;
    converted_qris: string;
    nominal: number;
    merchant_name: string;
    merchant_city: string;
    qr_image_url: string;
  };
}

/**
 * Verifikasi webhook signature dari BAYAR.GG v2
 * Signature = HMAC-SHA256(invoice_id|status|final_amount|timestamp, webhook_secret)
 */
export async function verifyWebhookSignature(
  invoiceId: string,
  status: string,
  finalAmount: number,
  timestamp: string,
  signature: string
): Promise<boolean> {
  if (!BAYARGG_WEBHOOK_SECRET || !signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(BAYARGG_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const data = `${invoiceId}|${status}|${finalAmount}|${timestamp}`;
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const expectedSignature = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (expectedSignature.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Convert QRIS string + nominal → QR image URL dengan nominal tertanam
 */
export async function convertQris(nominal: number): Promise<QrisConvertResponse> {
  if (!BAYARGG_QRIS_STRING) {
    throw new Error("BAYARGG_QRIS_STRING not configured");
  }
  return bayarRequest<QrisConvertResponse>("/qris-convert.php", {
    method: "POST",
    body: JSON.stringify({
      qris: BAYARGG_QRIS_STRING,
      nominal,
    }),
  });
}

/**
 * Convert custom QRIS string + nominal → QR image URL
 */
export async function convertCustomQris(qrisString: string, nominal: number): Promise<QrisConvertResponse> {
  if (!qrisString) {
    throw new Error("QRIS string not provided");
  }
  return bayarRequest<QrisConvertResponse>("/qris-convert.php", {
    method: "POST",
    body: JSON.stringify({
      qris: qrisString,
      nominal,
    }),
  });
}
