const CHECKER_API_URL = process.env.CHECKER_API_URL || "https://unified-checker-api-production.up.railway.app";
const CHECKER_API_KEY = process.env.CHECKER_API_KEY || "";

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

export async function checkWhatsApp(number: string): Promise<WaCheckResult | null> {
  if (!CHECKER_API_KEY) return null;
  try {
    const res = await fetch(`${CHECKER_API_URL}/api/wa/check/${encodeURIComponent(number)}`, {
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
    const res = await fetch(`${CHECKER_API_URL}/api/tg/check/${encodeURIComponent(number)}`, {
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
