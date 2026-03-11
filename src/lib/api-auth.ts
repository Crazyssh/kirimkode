import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-response";

export interface ApiUser {
  id: string;
  balance: number;
  role: string;
}

export async function authenticateApiKey(req: NextRequest): Promise<ApiUser | null> {
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
  const { allowed } = rateLimit(`api:${userId}`, maxRequests);
  if (!allowed) {
    return apiError("Rate limit exceeded. Try again later.", 429, "RATE_LIMITED");
  }
  return null;
}

/**
 * Wrapper yang handle auth + rate limit otomatis.
 * Usage:
 *   export const GET = withApiAuth(async (req, user) => { ... });
 *   export const POST = withApiAuth(async (req, user) => { ... });
 */
type ApiHandler = (req: NextRequest, user: ApiUser) => Promise<NextResponse>;

type RouteParams = { params: Promise<Record<string, string>> };
type ApiHandlerWithParams = (
  req: NextRequest,
  user: ApiUser,
  params: Record<string, string>
) => Promise<NextResponse>;

export function withApiAuth(handler: ApiHandler, maxRequests = 60) {
  return async (req: NextRequest) => {
    const user = await authenticateApiKey(req);
    if (!user) {
      return apiError("Invalid API key", 401, "UNAUTHORIZED");
    }

    const rateLimited = checkRateLimit(user.id, maxRequests);
    if (rateLimited) return rateLimited;

    return handler(req, user);
  };
}

/**
 * Wrapper untuk route dengan dynamic params (e.g. /order/[id]/status)
 * Usage:
 *   export const GET = withApiAuthParams(async (req, user, params) => {
 *     const { id } = params;
 *     ...
 *   });
 */
export function withApiAuthParams(handler: ApiHandlerWithParams, maxRequests = 60) {
  return async (req: NextRequest, context: RouteParams) => {
    const user = await authenticateApiKey(req);
    if (!user) {
      return apiError("Invalid API key", 401, "UNAUTHORIZED");
    }

    const rateLimited = checkRateLimit(user.id, maxRequests);
    if (rateLimited) return rateLimited;

    const params = await context.params;
    return handler(req, user, params);
  };
}
