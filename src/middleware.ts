import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const protectedPaths = ["/dashboard", "/buy", "/deposit", "/history", "/api-docs", "/settings", "/admin"];
const authPaths = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  const isAuthPage = authPaths.some((path) => pathname === path);

  // Skip if not a protected or auth page
  if (!isProtected && !isAuthPage) {
    return NextResponse.next();
  }

  // Verify JWT token (bukan hanya cek cookie existence)
  // getToken() decode & verify JWT signature menggunakan AUTH_SECRET
  const token = await getToken({ req: request });
  const isLoggedIn = !!token;

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
  ],
};

