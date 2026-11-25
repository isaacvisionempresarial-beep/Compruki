"use server";

import { redirect } from "next/navigation";
import { AUTH_BURST_ERROR, AUTH_EMAIL_RULE, AUTH_IP_RULE } from "@/lib/public-limits";
import { createServerSupabase } from "@/lib/supabase/server";
import { clientAddress, takePublicAttempt } from "@/server/public-guard";

export type SignInState = { error: string | null };

async function authAttemptAllowed(email: string) {
  const address = await clientAddress();
  if (!takePublicAttempt("auth-ip", address, AUTH_IP_RULE)) return false;
  if (email && !takePublicAttempt("auth-email", email, AUTH_EMAIL_RULE)) return false;
  return true;
}

export async function signIn(_state: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Escribe el correo y la contraseña." };
  }

  if (!(await authAttemptAllowed(email))) {
    return { error: AUTH_BURST_ERROR };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { error: "El correo aún no está confirmado en Supabase Auth." };
    }
    return {
      error:
        "Correo o contraseña incorrectos. Si acabas de crear el usuario, usa la contraseña exacta de Supabase (o cámbiala aquí).",
    };
  }

  redirect("/panel");
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/ingresar");
}

export type RecoverState = { error: string | null; sent: boolean };

/** Envía correo de recuperación si el usuario existe en Supabase Auth. */
export async function requestPasswordReset(_state: RecoverState, formData: FormData): Promise<RecoverState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    return { error: "Escribe el correo de tu comercio.", sent: false };
  }

  if (!(await authAttemptAllowed(email))) {
    return { error: AUTH_BURST_ERROR, sent: false };
  }

  const supabase = await createServerSupabase();
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3010";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/ingresar?modo=nueva-clave")}`,
  });

  if (error) {
    return { error: "No se pudo enviar el correo. Revisa el correo o la configuración de Auth.", sent: false };
  }

  return { error: null, sent: true };
}

export type UpdatePasswordState = { error: string | null; ok: boolean };

/**
 * Cambia la contraseña:
 * - Con sesión de recuperación (enlace del correo): solo nueva clave.
 * - Sin esa sesión: correo + contraseña actual + nueva.
 */
export async function updatePassword(_state: UpdatePasswordState, formData: FormData): Promise<UpdatePasswordState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "La nueva contraseña debe tener al menos 8 caracteres.", ok: false };
  }
  if (password !== confirm) {
    return { error: "La confirmación no coincide con la nueva contraseña.", ok: false };
  }

  const supabase = await createServerSupabase();
  const { data: existing } = await supabase.auth.getUser();

  if (!existing.user) {
    if (!email || !currentPassword) {
      return { error: "Escribe el correo y la contraseña actual, o usa el enlace del correo de recuperación.", ok: false };
    }
    const { error: signError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (signError) {
      return { error: "Correo o contraseña actual incorrectos.", ok: false };
    }
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "No se pudo guardar la nueva contraseña. Intenta de nuevo o pide otro enlace.", ok: false };
  }

  redirect("/panel");
}
