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
  status: "pending" | "paid" | "expired" | "cancelled";
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
 */
export async function checkPayment(
  invoiceId: string
): Promise<BayarGGCheckPaymentResponse> {
  return bayarRequest<BayarGGCheckPaymentResponse>(
    `/check-payment?invoice=${encodeURIComponent(invoiceId)}`
  );
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
