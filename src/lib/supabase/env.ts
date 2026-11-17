/** Variables públicas del proyecto Supabase (cliente y servidor). */
export function supabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local");
  return value;
}

/** Clave anon / publishable (sb_publishable_… o JWT eyJ…). */
export function supabaseAnonKey() {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!value) throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  return value;
}

/** Solo servidor. Nunca exponer al navegador. */
export function supabaseServiceRoleKey() {
  const value =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim();
  if (!value) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local");
  return value;
}
