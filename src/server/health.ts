import { createAdminSupabase } from "@/lib/supabase/admin";
import { probeFollowupsTable } from "@/server/followups";
import { openAIKeyConfigured, probeOpenAI } from "@/server/openai-client";
import { probeProductQuestionsTable } from "@/server/product-questions";

export type HealthChecks = {
  siteUrl: boolean;
  supabaseUrl: boolean;
  supabaseAnon: boolean;
  serviceRole: boolean;
  tenantPilot: boolean;
  /** Tabla AG-05; no bloquea ok del deploy. */
  productQuestions: boolean;
  /** Tabla AG-07 CRM; no bloquea ok del deploy. */
  followupTasks: boolean;
  /** Clave presente; el probe vivo va en openaiConnected. No bloquea ok. */
  openaiKey: boolean;
};

export type HealthSnapshot = {
  ok: boolean;
  dropiConnected: false;
  openaiConnected: boolean;
  checks: HealthChecks;
};

/** Misma lógica que GET /api/health, reutilizable en el panel. */
export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const checks: HealthChecks = {
    siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()),
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    supabaseAnon: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
    ),
    serviceRole: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim(),
    ),
    tenantPilot: false,
    productQuestions: false,
    followupTasks: false,
    openaiKey: openAIKeyConfigured(),
  };

  if (checks.supabaseUrl && checks.serviceRole) {
    try {
      const supabase = createAdminSupabase();
      const { data, error } = await supabase.from("tenants").select("id").eq("slug", "tienda-piloto").maybeSingle();
      checks.tenantPilot = !error && Boolean(data?.id);
    } catch {
      checks.tenantPilot = false;
    }
    const [productQuestions, followupTasks] = await Promise.all([
      probeProductQuestionsTable(),
      probeFollowupsTable(),
    ]);
    checks.productQuestions = productQuestions;
    checks.followupTasks = followupTasks;
  }

  const openaiProbe = await probeOpenAI();
  const openaiConnected = openaiProbe.ok;

  const ok =
    checks.siteUrl && checks.supabaseUrl && checks.supabaseAnon && checks.serviceRole && checks.tenantPilot;

  return {
    ok,
    dropiConnected: false,
    openaiConnected,
    checks,
  };
}
