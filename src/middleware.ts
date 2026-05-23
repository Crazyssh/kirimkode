import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPaths = ["/dashboard", "/buy", "/deposit", "/history", "/api-docs", "/settings", "/admin"];
const authPaths = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS preflight untuk public API (/api/v1/*)
  if (pathname.startsWith("/api/v1/") && request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Check for session token (NextAuth JWT)
  const token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  const isLoggedIn = !!token;
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  const isAuthPage = authPaths.some((path) => pathname === path);

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/buy/:path*",
    "/deposit/:path*",
    "/history/:path*",
    "/api-docs/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/api/v1/:path*",
  ],
};


