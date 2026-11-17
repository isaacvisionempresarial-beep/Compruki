import { createAdminSupabase } from "@/lib/supabase/admin";
import { getPilotTenantId } from "@/server/tenant";

export type AgentRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "awaiting_approval";

export async function recordAgentRun(input: {
  agentId: string;
  status: AgentRunStatus;
  summary: string;
  costEstimateCop?: number;
  createdBy?: string | null;
}): Promise<{ error: string | null; id: string | null }> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("agent_runs")
      .insert({
        tenant_id: tenantId,
        agent_id: input.agentId,
        status: input.status,
        summary: input.summary.slice(0, 2000),
        cost_estimate_cop: Math.max(0, Math.floor(input.costEstimateCop ?? 0)),
        created_by: input.createdBy ?? null,
      })
      .select("id")
      .single();

    if (error) {
      return {
        error:
          error.message.includes("schema cache") || error.message.includes("does not exist")
            ? "Falta la tabla agent_runs. Ejecuta supabase/migrations/004_agents.sql."
            : error.message,
        id: null,
      };
    }

    return { error: null, id: String(data.id) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo registrar la corrida.",
      id: null,
    };
  }
}
