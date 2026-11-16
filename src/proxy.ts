import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_VALUE } from "@/lib/session";

export function proxy(request: NextRequest) {
  const signedIn = request.cookies.get(SESSION_COOKIE)?.value === SESSION_VALUE;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/panel") && !signedIn) {
    return NextResponse.redirect(new URL("/ingresar", request.url));
  }

  if (pathname === "/ingresar" && signedIn) {
    return NextResponse.redirect(new URL("/panel", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/panel", "/panel/:path*", "/ingresar"],
};
