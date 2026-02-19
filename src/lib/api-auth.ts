import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export async function authenticateApiKey(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return null;

  const user = await db.user.findFirst({
    where: { apiKey, status: "active" },
    select: { id: true, balance: true, role: true },
  });

  return user;
}

// Rate limit check - returns error response if limited, null if OK
export function checkRateLimit(userId: string, maxRequests = 60): NextResponse | null {
  const { allowed, remaining } = rateLimit(`api:${userId}`, maxRequests);
  if (!allowed) {
    return NextResponse.json(
      { status: "error", message: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
    );
  }
  return null;
}
