const WAITING_STATUSES = ["menunggu", "waiting", "pending", "processing"];

export function isRealOtp(otp: unknown): otp is string {
  if (typeof otp !== "string" || !otp.trim()) return false;
  return !WAITING_STATUSES.includes(otp.trim().toLowerCase());
}

export function extractOtp(data: Record<string, unknown>): string | null {
  // Try multiple possible response formats from JasaOTP:
  // { otp: "123456" }
  // { data: { otp: "123456" } }
  // { sms: "123456" }
  // { data: { sms: "123456" } }
  // { data: { full_sms: "Your code is 123456" } }
  const candidates = [
    data?.otp,
    data?.sms,
    data?.code,
    (data?.data as Record<string, unknown>)?.otp,
    (data?.data as Record<string, unknown>)?.sms,
    (data?.data as Record<string, unknown>)?.code,
    (data?.data as Record<string, unknown>)?.full_sms,
  ];

  for (const val of candidates) {
    if (isRealOtp(val)) return val;
  }

  return null;
}
