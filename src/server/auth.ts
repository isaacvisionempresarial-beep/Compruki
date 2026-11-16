"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo-account";
import { SESSION_COOKIE, SESSION_VALUE } from "@/lib/session";

export type SignInState = { error: string | null };

// Puerta local del prototipo. Las pantallas se quedan; la sesión pasa a Supabase Auth.
export async function signIn(_state: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Escribe el correo y la contraseña." };
  }

  if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    return { error: "Correo o contraseña incorrectos." };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/panel");
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/ingresar");
}
