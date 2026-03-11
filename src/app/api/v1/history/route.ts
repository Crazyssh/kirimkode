import { NextResponse } from "next/server";

/**
 * DEPRECATED: Use GET /api/v1/orders instead.
 * This endpoint will be removed in a future version.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: {
        message: "This endpoint is deprecated. Use GET /api/v1/orders instead.",
        code: "DEPRECATED",
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: 301,
      headers: {
        Location: "/api/v1/orders",
        "X-Deprecated": "Use GET /api/v1/orders instead",
      },
    }
  );
}
