import { createAdminSupabase } from "@/lib/supabase/admin";
import { getPilotTenantId } from "@/server/tenant";

export type AgentRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "awaiting_approval";

export type AgentRunExportRow = {
  id: string;
  agentId: string;
  status: string;
  summary: string;
  costEstimateCop: number;
  createdAt: string;
  createdBy: string;
};

export async function listAgentRunsForExport(limit = 500): Promise<AgentRunExportRow[]> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("agent_runs")
      .select("id, agent_id, status, summary, cost_estimate_cop, created_at, created_by")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(Math.min(1000, Math.max(1, limit)));

    if (error || !data) return [];

    return data.map((row) => ({
      id: String(row.id),
      agentId: String(row.agent_id),
      status: String(row.status),
      summary: typeof row.summary === "string" ? row.summary : "",
      costEstimateCop: Math.max(0, Number(row.cost_estimate_cop) || 0),
      createdAt: String(row.created_at),
      createdBy: row.created_by ? String(row.created_by) : "",
    }));
  } catch {
    return [];
  }
}

export function agentRunsToCsv(rows: AgentRunExportRow[]): string {
  const header = ["id", "agent_id", "status", "cost_estimate_cop", "created_at", "created_by", "summary"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.id),
        csvCell(row.agentId),
        csvCell(row.status),
        csvCell(String(row.costEstimateCop)),
        csvCell(row.createdAt),
        csvCell(row.createdBy),
        csvCell(row.summary),
      ].join(","),
    );
  }
  // BOM para que Excel (es-CO) abra UTF-8 sin romper tildes.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function csvCell(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

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
