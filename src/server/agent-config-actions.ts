"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { AGENT_ROLES } from "@/lib/agents/roles";
import { assertPanelAccess } from "@/server/panel-auth";
import { getPilotTenantId } from "@/server/tenant";

const editableIds = new Set(AGENT_ROLES.filter((role) => role.priority === "P0-IA").map((role) => role.id));

export type SaveAgentConfigState = { error: string | null; message: string | null };

export async function saveAgentConfigAction(
  _state: SaveAgentConfigState,
  formData: FormData,
): Promise<SaveAgentConfigState> {
  const access = await assertPanelAccess();
  if (!access) return { error: "Tu sesión no permite guardar la configuración.", message: null };

  const agentId = String(formData.get("agentId") ?? "").trim().toUpperCase();
  if (!editableIds.has(agentId)) {
    return { error: "Solo se puede editar presupuesto de roles P0-IA en este piloto.", message: null };
  }

  const enabled = formData.get("enabled") === "on" || formData.get("enabled") === "true";
  const rawBudget = String(formData.get("monthlyBudgetCop") ?? "0").replace(/\D/g, "");
  const monthlyBudgetCop = Math.min(50_000_000, Math.max(0, Number(rawBudget) || 0));
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500);

  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { error } = await supabase.from("agent_configs").upsert(
      {
        tenant_id: tenantId,
        agent_id: agentId,
        enabled,
        monthly_budget_cop: monthlyBudgetCop,
        notes: notes || (enabled ? "Piloto local. OpenAI no está conectado." : "Apagado. OpenAI no está conectado."),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,agent_id" },
    );

    if (error) {
      return {
        error:
          error.message.includes("schema cache") || error.message.includes("does not exist")
            ? "Falta la tabla agent_configs. Ejecuta supabase/migrations/004_agents.sql."
            : error.message,
        message: null,
      };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar la configuración.",
      message: null,
    };
  }

  revalidatePath("/panel/agentes");
  return {
    error: null,
    message: `${agentId} guardado · ${enabled ? "activo" : "apagado"} · tope ${monthlyBudgetCop.toLocaleString("es-CO")} COP/mes.`,
  };
}
