import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/panel") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  // Checkout exige sesión; el destino final (panel vs comprador) lo resuelve /tienda/cuenta.
  if (pathname.startsWith("/tienda/pagar") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/tienda/cuenta";
    url.search = `?next=${encodeURIComponent("/tienda/pagar")}`;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/panel", "/panel/:path*", "/ingresar", "/tienda/pagar", "/tienda/pagar/:path*"],
};
