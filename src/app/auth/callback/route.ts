import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicSiteOrigin } from "@/lib/site-url";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import { ensureCustomerProfile, userHasPanelMembership } from "@/server/customer-auth";

function safeNext(raw: string | null) {
  const value = (raw ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return "/tienda";
  return value;
}

/** Intercambia el código OAuth / recovery y enruta panel vs comprador. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = publicSiteOrigin(request);
  const code = searchParams.get("code");
  const nextParam = safeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/tienda/cuenta?error=enlace`);
  }

  let response = NextResponse.redirect(`${origin}${nextParam}`);

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.redirect(`${origin}${nextParam}`);
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    const fail =
      nextParam.startsWith("/ingresar") || nextParam.includes("nueva-clave")
        ? `${origin}/ingresar?error=enlace`
        : `${origin}/tienda/cuenta?error=enlace`;
    return NextResponse.redirect(fail);
  }

  if (await userHasPanelMembership(data.user.id)) {
    if (nextParam.includes("nueva-clave") || nextParam.startsWith("/ingresar")) {
      return NextResponse.redirect(`${origin}/ingresar?modo=nueva-clave`);
    }
    if (!nextParam.startsWith("/panel")) {
      return NextResponse.redirect(`${origin}/panel`);
    }
    return response;
  }

  try {
    await ensureCustomerProfile(data.user);
  } catch {
    /* perfil se reintenta al entrar a cuenta */
  }

  if (nextParam.startsWith("/panel") || nextParam.startsWith("/ingresar")) {
    return NextResponse.redirect(`${origin}/tienda/cuenta`);
  }

  return response;
}
