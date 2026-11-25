"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AUTH_BURST_ERROR, AUTH_EMAIL_RULE, AUTH_IP_RULE } from "@/lib/public-limits";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  ensureCustomerProfile,
  getAuthUser,
  updateCustomerProfile,
  userHasPanelMembership,
} from "@/server/customer-auth";
import { clientAddress, takePublicAttempt } from "@/server/public-guard";

export type CustomerAuthState = { error: string | null; message: string | null };

async function authAllowed(email: string) {
  const address = await clientAddress();
  if (!(await takePublicAttempt("cust-auth-ip", address, AUTH_IP_RULE))) return false;
  if (email && !(await takePublicAttempt("cust-auth-email", email, AUTH_EMAIL_RULE))) return false;
  return true;
}

function safeNext(raw: string | null | undefined) {
  const value = (raw ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/panel") || value.startsWith("/ingresar")) {
    return "/tienda";
  }
  return value;
}

async function siteOrigin() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3010";
}

export async function customerSignUpAction(
  _state: CustomerAuthState,
  formData: FormData,
): Promise<CustomerAuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password) return { error: "Escribe el correo y la contraseña.", message: null };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres.", message: null };
  if (!(await authAllowed(email))) return { error: AUTH_BURST_ERROR, message: null };

  const supabase = await createServerSupabase();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name || undefined, compruki_role: "customer" },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { error: "No se pudo crear la cuenta. Revisa el correo o intenta con Google.", message: null };
  }

  if (data.user && data.session) {
    if (await userHasPanelMembership(data.user.id)) {
      redirect("/panel");
    }
    await ensureCustomerProfile(data.user);
    redirect(next);
  }

  return {
    error: null,
    message: "Revisa tu correo para confirmar la cuenta. Luego puedes entrar y continuar el pedido.",
  };
}

export async function customerSignInAction(
  _state: CustomerAuthState,
  formData: FormData,
): Promise<CustomerAuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password) return { error: "Escribe el correo y la contraseña.", message: null };
  if (!(await authAllowed(email))) return { error: AUTH_BURST_ERROR, message: null };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: "Correo o contraseña incorrectos.", message: null };
  }

  if (await userHasPanelMembership(data.user.id)) {
    redirect("/panel");
  }

  await ensureCustomerProfile(data.user);
  redirect(next);
}

export async function customerSignOutAction() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/tienda");
}

export async function customerGoogleSignInAction(formData: FormData) {
  const next = safeNext(String(formData.get("next") ?? ""));
  if (!(await authAllowed("google-oauth"))) {
    redirect(`/tienda/cuenta?error=limite&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createServerSupabase();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect(`/tienda/cuenta?error=google&next=${encodeURIComponent(next)}`);
  }
  redirect(data.url);
}

export async function customerRecoverAction(
  _state: CustomerAuthState,
  formData: FormData,
): Promise<CustomerAuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Escribe tu correo.", message: null };
  if (!(await authAllowed(email))) return { error: AUTH_BURST_ERROR, message: null };

  const supabase = await createServerSupabase();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/tienda/cuenta?modo=nueva-clave")}`,
  });
  if (error) {
    return { error: "No se pudo enviar el correo de recuperación.", message: null };
  }
  return { error: null, message: "Si el correo existe, te enviamos el enlace para cambiar la clave." };
}

export async function customerUpdatePasswordAction(
  _state: CustomerAuthState,
  formData: FormData,
): Promise<CustomerAuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "La nueva contraseña debe tener al menos 8 caracteres.", message: null };
  if (password !== confirm) return { error: "La confirmación no coincide.", message: null };

  const user = await getAuthUser();
  if (!user) return { error: "Abre el enlace del correo otra vez.", message: null };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "No se pudo guardar la nueva contraseña.", message: null };

  if (!(await userHasPanelMembership(user.id))) {
    await ensureCustomerProfile(user);
  }
  redirect("/tienda/cuenta");
}

export async function customerSaveProfileAction(
  _state: CustomerAuthState,
  formData: FormData,
): Promise<CustomerAuthState> {
  const user = await getAuthUser();
  if (!user || (await userHasPanelMembership(user.id))) {
    return { error: "Entra con tu cuenta de comprador.", message: null };
  }
  const displayName = String(formData.get("name") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const emailOrderUpdates = formData.get("emailOrderUpdates") === "on";
  const result = await updateCustomerProfile(user.id, { displayName, phone, emailOrderUpdates });
  if (result.error) return { error: "No se pudo guardar el perfil.", message: null };
  return { error: null, message: "Perfil guardado. No cambia pedidos ni cobra." };
}
