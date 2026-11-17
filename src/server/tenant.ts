import { createAdminSupabase } from "@/lib/supabase/admin";

const PILOT_SLUG = "tienda-piloto";

let cachedTenantId: string | null = null;

/** Tenant piloto. Cache en proceso; el service role omite RLS. */
export async function getPilotTenantId(): Promise<string> {
  if (cachedTenantId) return cachedTenantId;

  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from("tenants").select("id").eq("slug", PILOT_SLUG).maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer el tenant piloto: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error(
      `No existe el tenant «${PILOT_SLUG}». Ejecuta supabase/migrations/001_tenants.sql en el SQL Editor.`,
    );
  }

  cachedTenantId = data.id as string;
  return cachedTenantId;
}
