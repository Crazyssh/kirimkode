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

  // Verify JWT token menggunakan getToken (decode + verify signature)
  // Dengan fallback ke cookie check kalau getToken gagal
  let isLoggedIn = false;
  try {
    const token = await getToken({ req: request });
    isLoggedIn = !!token;
  } catch {
    // Fallback: cek cookie existence kalau getToken error
    // (misalnya AUTH_SECRET bermasalah atau token format salah)
    const sessionCookie =
      request.cookies.get("authjs.session-token")?.value ||
      request.cookies.get("__Secure-authjs.session-token")?.value;
    isLoggedIn = !!sessionCookie;
  }

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

