import { NextResponse } from "next/server";

/**
 * Standardized API V1 Response Helpers
 * Semua endpoint v1 WAJIB pakai helpers ini untuk konsistensi.
 */

interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
  };
  timestamp: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

interface ApiPaginatedResponse<T = unknown> {
  success: true;
  data: T;
  pagination: PaginationMeta;
  timestamp: string;
}

/** Success response: { success: true, data: ..., timestamp } */
export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true as const,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/** Success response with message only (no data) */
export function apiMessage(message: string, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      message,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/** Error response: { success: false, error: { message, code? }, timestamp } */
export function apiError(
  message: string,
  status = 400,
  code?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false as const,
      error: {
        message,
        ...(code && { code }),
      },
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/** Paginated response: { success: true, data: [...], pagination: {...}, timestamp } */
export function apiPaginated<T>(
  data: T[],
  pagination: PaginationMeta,
  status = 200
): NextResponse<ApiPaginatedResponse<T[]>> {
  return NextResponse.json(
    {
      success: true as const,
      data,
      pagination,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/** Parse pagination query params with safe defaults */
export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
