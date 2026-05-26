const WAITING_STATUSES = ["menunggu", "waiting", "pending", "processing"];

/**
 * Cek apakah string adalah OTP valid (pure digits 4-8 karakter).
 * Reject placeholder text seperti "Menunggu", "pending", "waiting", dll.
 */
export function isRealOtp(otp: unknown): otp is string {
  if (typeof otp !== "string") return false;
  const trimmed = otp.trim();
  if (!trimmed) return false;
  if (WAITING_STATUSES.includes(trimmed.toLowerCase())) return false;
  return /^\d{4,8}$/.test(trimmed);
}

/**
 * Extract OTP digits dari text panjang (mis. full SMS body).
 * Cari urutan 4-8 digit pertama. Reject kalau cuma waiting keyword.
 */
function extractDigitsFromText(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (WAITING_STATUSES.includes(trimmed.toLowerCase())) return null;
  const match = trimmed.match(/\b(\d{4,8})\b/);
  return match ? match[1] : null;
}

export function extractOtp(data: Record<string, unknown>): string | null {
  // Pure-digit candidates (provider sudah parse OTP)
  const directCandidates = [
    data?.otp,
    data?.sms,
    data?.code,
    (data?.data as Record<string, unknown>)?.otp,
    (data?.data as Record<string, unknown>)?.sms,
    (data?.data as Record<string, unknown>)?.code,
  ];

  for (const val of directCandidates) {
    if (isRealOtp(val)) return val;
  }

  // Fallback: SMS panjang yang butuh diextract
  const fullSmsCandidates = [
    data?.full_sms,
    (data?.data as Record<string, unknown>)?.full_sms,
  ];

  for (const val of fullSmsCandidates) {
    const digits = extractDigitsFromText(val);
    if (digits) return digits;
  }

  return null;
}
