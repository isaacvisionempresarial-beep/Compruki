import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const modo = request.nextUrl.searchParams.get("modo");

  if (pathname.startsWith("/panel") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  // Con sesión, /ingresar va al panel… salvo cambio de clave, sin membresía o cuenta de otra tienda.
  const error = request.nextUrl.searchParams.get("error");
  if (pathname === "/ingresar" && user && modo !== "nueva-clave" && error !== "sin-acceso" && error !== "otra-tienda") {
    const url = request.nextUrl.clone();
    url.pathname = "/panel";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/panel", "/panel/:path*", "/ingresar"],
};
