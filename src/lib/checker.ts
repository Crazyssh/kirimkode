const CHECKER_API_URL = process.env.CHECKER_API_URL || "https://unified-checker-api-production.up.railway.app";
const CHECKER_API_KEY = process.env.CHECKER_API_KEY || "";

/** Strip +, spasi, dan karakter non-digit dari nomor */
function cleanNumber(num: string): string {
  return num.replace(/[^0-9]/g, "");
}

export interface WaCheckResult {
  exists: boolean;
  profilePic?: string | null;
  jid?: string | null;
}

export interface TgCheckResult {
  exists: boolean;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profilePic?: string | null;
}

export interface TgCheckFullResult {
  exists: boolean;
  deleted?: boolean;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  userId?: string | null;
  registeredAt?: string | null;
  profilePic?: string | null;
  lastSeen?: string | null;
  lastSeenLabel?: string | null;
  lastSeenTime?: string | null;
}

export async function checkWhatsApp(number: string): Promise<WaCheckResult | null> {
  if (!CHECKER_API_KEY) return null;
  try {
    const res = await fetch(`${CHECKER_API_URL}/api/wa/check/${cleanNumber(number)}`, {
      headers: { "X-API-Key": CHECKER_API_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function checkTelegramFull(number: string): Promise<TgCheckFullResult | null> {
  if (!CHECKER_API_KEY) return null;
  try {
    const res = await fetch(`${CHECKER_API_URL}/api/tg/check/${cleanNumber(number)}/full`, {
      headers: { "X-API-Key": CHECKER_API_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function checkTelegram(number: string): Promise<TgCheckResult | null> {
  if (!CHECKER_API_KEY) return null;
  try {
    const res = await fetch(`${CHECKER_API_URL}/api/tg/check/${cleanNumber(number)}`, {
      headers: { "X-API-Key": CHECKER_API_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;
    return json.data ?? null;
  } catch {
    return null;
  }
}
