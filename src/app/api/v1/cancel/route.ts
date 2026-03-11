import { NextResponse } from "next/server";

/**
 * DEPRECATED: Use POST /api/v1/order/{id}/cancel instead.
 * This endpoint will be removed in a future version.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        message: "This endpoint is deprecated. Use POST /api/v1/order/{id}/cancel instead.",
        code: "DEPRECATED",
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: 301,
      headers: {
        "X-Deprecated": "Use POST /api/v1/order/{id}/cancel instead",
      },
    }
  );
}
