import { createAdminSupabase } from "@/lib/supabase/admin";
import { formatCop } from "@/lib/format";
import { getPilotTenantId } from "@/server/tenant";

export type AgentPolicyDenial = {
  ok: false;
  code: "disabled" | "over_budget";
  reason: string;
};

export type AgentPolicyOk = {
  ok: true;
  enabled: boolean;
  monthlyBudgetCop: number;
  monthSpendCop: number;
};

export type AgentPolicy = AgentPolicyOk | AgentPolicyDenial;

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Política por tenant: activación y tope mensual. Sin fila = permitido (piloto local). */
export async function evaluateAgentPolicy(agentId: string): Promise<AgentPolicy> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();

    const [{ data: config, error: configError }, { data: runs, error: runsError }] = await Promise.all([
      supabase
        .from("agent_configs")
        .select("enabled, monthly_budget_cop")
        .eq("tenant_id", tenantId)
        .eq("agent_id", agentId)
        .maybeSingle(),
      supabase
        .from("agent_runs")
        .select("cost_estimate_cop")
        .eq("tenant_id", tenantId)
        .eq("agent_id", agentId)
        .gte("created_at", monthStartIso()),
    ]);

    const missingSchema = (message: string) =>
      message.includes("schema cache") || message.includes("does not exist");

    // Piloto local sin migraciones: permitir. Cualquier otro error de DB: fail-closed.
    if (configError) {
      if (missingSchema(configError.message)) {
        return { ok: true, enabled: true, monthlyBudgetCop: 0, monthSpendCop: 0 };
      }
      return {
        ok: false,
        code: "disabled",
        reason: `${agentId} no pudo verificar la política. Intenta de nuevo en unos minutos.`,
      };
    }

    if (runsError && !missingSchema(runsError.message)) {
      return {
        ok: false,
        code: "disabled",
        reason: `${agentId} no pudo verificar el gasto del mes. Intenta de nuevo en unos minutos.`,
      };
    }

    const monthSpendCop = (runs ?? []).reduce(
      (sum, row) => sum + Math.max(0, Number(row.cost_estimate_cop) || 0),
      0,
    );

    if (!config) {
      return { ok: true, enabled: true, monthlyBudgetCop: 0, monthSpendCop };
    }

    const enabled = config.enabled === true;
    const monthlyBudgetCop = Math.max(0, Number(config.monthly_budget_cop) || 0);

    if (!enabled) {
      return {
        ok: false,
        code: "disabled",
        reason: `${agentId} está apagado. Actívalo en Presupuesto y activación (P0-IA).`,
      };
    }

    if (monthlyBudgetCop > 0 && monthSpendCop >= monthlyBudgetCop) {
      return {
        ok: false,
        code: "over_budget",
        reason: `${agentId} superó el tope del mes (${formatCop(monthSpendCop)} / ${formatCop(monthlyBudgetCop)}). Sube el presupuesto o espera al próximo mes.`,
      };
    }

    return { ok: true, enabled, monthlyBudgetCop, monthSpendCop };
  } catch {
    return {
      ok: false,
      code: "disabled",
      reason: `${agentId} no pudo verificar la política. Intenta de nuevo en unos minutos.`,
    };
  }
}

export function agentDeniedRedirect(agentId: string, reason: string, extra: Record<string, string | undefined> = {}) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(extra)) {
    const trimmed = value?.trim();
    if (trimmed) sp.set(key, trimmed);
  }
  sp.set("agente", agentId);
  sp.set("agenteError", reason.slice(0, 280));
  return `/panel/agentes?${sp.toString()}`;
}
