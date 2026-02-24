import { NextRequest, NextResponse } from "next/server";

const rateMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, maxRequests = 60, windowMs = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}

/**
 * Helper: ambil identifier dari request (IP atau fallback)
 */
export function getRequestIdentifier(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

/**
 * Helper: cek rate limit dan return 429 response kalau exceeded.
 * Return null kalau masih allowed.
 */
export function checkRouteRateLimit(
  req: NextRequest,
  route: string,
  maxRequests = 10,
  windowMs = 60000,
): NextResponse | null {
  const ip = getRequestIdentifier(req);
  const { allowed } = rateLimit(`${route}:${ip}`, maxRequests, windowMs);
  if (!allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi nanti." },
      { status: 429 },
    );
  }
  return null;
}

// Clean up old entries periodically
if (typeof globalThis !== "undefined") {
  const cleanupKey = "__rateLimit_cleanup";
  if (!(globalThis as Record<string, unknown>)[cleanupKey]) {
    (globalThis as Record<string, unknown>)[cleanupKey] = true;
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of rateMap.entries()) {
        if (now > entry.resetAt) rateMap.delete(key);
      }
    }, 60000);
  }
}
