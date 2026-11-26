import { createAdminSupabase } from "@/lib/supabase/admin";
import { probeCustomerProfilesTable } from "@/server/customer-auth";
import { probeFollowupsTable } from "@/server/followups";
import { openAIKeyConfigured, probeOpenAI } from "@/server/openai-client";
import { probeProductQuestionsTable } from "@/server/product-questions";
import { probeWhatsAppTables } from "@/server/whatsapp/connection";
import { metaWaConfigured } from "@/server/whatsapp/env";

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
  /** Perfiles de comprador (017); no bloquea ok. */
  customerProfiles: boolean;
  /** Tablas WhatsApp Meta (018); no bloquea ok. */
  whatsappTables: boolean;
  /** Credenciales META_WA_* presentes; no bloquea ok. */
  whatsappMetaEnv: boolean;
  /** Clave presente; el probe vivo va en openaiConnected. No bloquea ok. */
  openaiKey: boolean;
};

export type HealthSnapshot = {
  ok: boolean;
  dropiConnected: false;
  openaiConnected: boolean;
  checks: HealthChecks;
};

/** Snapshot completo para el panel. GET /api/health público solo expone ok. */
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
    customerProfiles: false,
    whatsappTables: false,
    whatsappMetaEnv: metaWaConfigured(),
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
    const [productQuestions, followupTasks, customerProfiles, whatsappTables] = await Promise.all([
      probeProductQuestionsTable(),
      probeFollowupsTable(),
      probeCustomerProfilesTable(),
      probeWhatsAppTables(),
    ]);
    checks.productQuestions = productQuestions;
    checks.followupTasks = followupTasks;
    checks.customerProfiles = customerProfiles;
    checks.whatsappTables = whatsappTables;
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
