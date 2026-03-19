/**
 * BAYAR.GG Payment Gateway API Client
 * Docs: https://www.bayar.gg/api-docs
 *
 * Method: GoPay Merchant QRIS (gopay_qris)
 * Fee: 0.5%
 * Auth: X-API-Key header
 */

const BAYARGG_BASE_URL = process.env.BAYARGG_BASE_URL || "https://www.bayar.gg/api";
const BAYARGG_API_KEY = process.env.BAYARGG_API_KEY || "";
const BAYARGG_QRIS_STRING = process.env.BAYARGG_QRIS_STRING || "";

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

export interface BayarGGCreatePaymentResponse {
  success: boolean;
  data: {
    invoice_id: string;
    amount: number;
    unique_code: number;
    final_amount: number;
    payment_url: string;
    expires_at: string;
    status: "pending" | "paid" | "expired" | "cancelled";
    redirect_url?: string;
    payment_method: string;
    qris_converter?: {
      enabled: boolean;
      converted_qris: string;
      qr_image_url: string;
    };
  };
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
  return bayarRequest<BayarGGCreatePaymentResponse>("/create-payment.php", {
    method: "POST",
    body: JSON.stringify({
      ...params,
      payment_method: "gopay_qris",
    }),
  });
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

  const res = await fetch(url, {
    headers: {
      "X-API-Key": BAYARGG_API_KEY,
      "Content-Type": "application/json",
    },
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
}

/**
 * Generate reference description untuk deposit
 */
export function generateDescription(userId: string, amount: number): string {
  return `Deposit KirimKode Rp ${amount.toLocaleString("id-ID")} - ${userId.substring(0, 8)}`;
}

/**
 * Hitung fee 0.5%
 */
export function calculateFee(amount: number): { fee: number; total: number } {
  const fee = Math.ceil(amount * 0.005); // 0.5%
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
