/**
 * BAYAR.GG Payment Gateway API Client
 * Docs: https://www.bayar.gg/api-docs
 *
 * Method: QRIS BAYAR GG (qris_bayar_gg) — QRIS dinamis dengan mID merchant kita
 * Fee: 2.1% (dari nominal user)
 * Auth: X-API-Key header
 */

const BAYARGG_BASE_URL = process.env.BAYARGG_BASE_URL || "https://www.bayar.gg/api";
const BAYARGG_API_KEY = process.env.BAYARGG_API_KEY || "";
const BAYARGG_QRIS_STRING = process.env.BAYARGG_QRIS_STRING || "";
const BAYARGG_WEBHOOK_SECRET = process.env.BAYARGG_WEBHOOK_SECRET || "";

// Checkout URL yang dikirim ke BAYAR.GG (wajib, HTTPS). Default ke checkout
// bawaan BAYAR.GG. Bisa override via env kalau pakai custom checkout URL.
const BAYARGG_CHECKOUT_URL =
  process.env.BAYARGG_CHECKOUT_URL || "https://www.bayar.gg/pay";

// Method preferensi: qris_bayar_gg (per-merchant mID, tanpa kode unik) →
// fallback ke "qris" (QRIS Admin) kalau provider belum approve grant.
// Bisa override via env BAYARGG_PAYMENT_METHOD.
const BAYARGG_PAYMENT_METHOD =
  process.env.BAYARGG_PAYMENT_METHOD || "qris_bayar_gg";

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
  payment_method?: string; // override default (mis. "qris_livin")
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
  payment_qris_string?: string; // qris_string dari response (dynamic, untuk Livin/BRI/GoPay)
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
 * Buat pembayaran baru via QRIS BAYAR GG (per-merchant) atau fallback ke QRIS Admin.
 *
 * Endpoint: POST /api/create-payment.php (per docs).
 * Method: lihat BAYARGG_PAYMENT_METHOD env (default "qris_bayar_gg").
 */
export async function createPayment(
  params: BayarGGCreatePaymentParams
): Promise<BayarGGCreatePaymentResponse> {
  const { payment_method, ...rest } = params;
  const raw = await bayarRequest<Record<string, unknown>>("/create-payment.php", {
    method: "POST",
    body: JSON.stringify({
      ...rest,
      payment_method: payment_method || BAYARGG_PAYMENT_METHOD,
      payment_url: BAYARGG_CHECKOUT_URL, // wajib per docs BAYAR.GG (HTTPS checkout URL)
    }),
  });

  // Normalize: docs return "data", legacy v2 return "payment". Handle keduanya.
  const payment = (raw.data || raw.payment || raw) as BayarGGPaymentData;
  const paymentUrl = (raw.payment_url || raw.pay_url || (payment as unknown as Record<string, unknown>).payment_url || "") as string;
  // qris_string dynamic dari response (Livin/BRI/GoPay merchant)
  const dataObj = (raw.data || raw) as Record<string, unknown>;
  const qrisString = (dataObj.qris_string || (payment as unknown as Record<string, unknown>).qris_string || "") as string;

  return {
    success: raw.success as boolean,
    payment,
    payment_url: paymentUrl,
    payment_qris_string: qrisString || undefined,
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
  const url = `${BAYARGG_BASE_URL}/check-payment.php?invoice=${encodeURIComponent(invoiceId)}`;

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
 * Hitung fee 2.1% (BAYAR.GG QRIS BAYAR GG / QRIS Admin)
 */
export function calculateFee(amount: number): { fee: number; total: number } {
  const fee = Math.ceil(amount * 0.021); // 2.1%
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

/**
 * Normalize qris_convert response — endpoint terbaru return flat object,
 * lama return { data: {...} }. Caller tetap akses .data untuk backward compat.
 */
function normalizeQrisConvertResponse(raw: Record<string, unknown>): QrisConvertResponse {
  if (raw.data && typeof raw.data === "object") {
    return raw as unknown as QrisConvertResponse;
  }
  return {
    success: raw.success as boolean,
    data: {
      original_qris: (raw.original_qris as string) || "",
      converted_qris: (raw.qris as string) || (raw.converted_qris as string) || "",
      nominal: (raw.amount as number) || (raw.nominal as number) || 0,
      merchant_name: (raw.merchant_name as string) || "",
      merchant_city: (raw.merchant_city as string) || "",
      qr_image_url: (raw.qr_image_url as string) || "",
    },
  };
}

void normalizeQrisConvertResponse;
