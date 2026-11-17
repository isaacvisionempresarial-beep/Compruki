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
  actorName: string;
};

export async function listAgentRunsForExport(limit = 500): Promise<AgentRunExportRow[]> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const rows = await selectRunRows(
      supabase,
      tenantId,
      "id, agent_id, status, summary, cost_estimate_cop, created_at, created_by, actor_name",
      Math.min(1000, Math.max(1, limit)),
    );
    if (!rows) return [];

    return rows.map((row) => ({
      id: String(row.id),
      agentId: String(row.agent_id),
      status: String(row.status),
      summary: typeof row.summary === "string" ? row.summary : "",
      costEstimateCop: Math.max(0, Number(row.cost_estimate_cop) || 0),
      createdAt: String(row.created_at),
      createdBy: row.created_by ? String(row.created_by) : "",
      actorName: typeof row.actor_name === "string" ? row.actor_name.trim() : "",
    }));
  } catch {
    return [];
  }
}

export function agentRunsToCsv(rows: AgentRunExportRow[]): string {
  const header = ["id", "agent_id", "status", "cost_estimate_cop", "created_at", "created_by", "actor_name", "summary"];
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
        csvCell(row.actorName),
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
  actorName?: string | null;
}): Promise<{ error: string | null; id: string | null }> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const actorName = input.actorName?.trim().slice(0, 120) || null;
    const row = {
      tenant_id: tenantId,
      agent_id: input.agentId,
      status: input.status,
      summary: input.summary.slice(0, 2000),
      cost_estimate_cop: Math.max(0, Math.floor(input.costEstimateCop ?? 0)),
      created_by: input.createdBy ?? null,
      ...(actorName ? { actor_name: actorName } : {}),
    };

    let { data, error } = await supabase.from("agent_runs").insert(row).select("id").single();
    if (error && actorName && isMissingActorColumn(error.message)) {
      const withoutActor = {
        tenant_id: row.tenant_id,
        agent_id: row.agent_id,
        status: row.status,
        summary: row.summary,
        cost_estimate_cop: row.cost_estimate_cop,
        created_by: row.created_by,
      };
      ({ data, error } = await supabase.from("agent_runs").insert(withoutActor).select("id").single());
    }

    if (error || !data) {
      const message = error?.message ?? "No se pudo registrar la corrida.";
      return {
        error:
          message.includes("schema cache") || message.includes("does not exist")
            ? "Falta la tabla agent_runs. Ejecuta supabase/migrations/004_agents.sql."
            : message,
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

type RunRow = {
  id: string;
  agent_id: string;
  status: string;
  summary: string | null;
  cost_estimate_cop: number | null;
  created_at: string;
  created_by: string | null;
  actor_name?: string | null;
};

async function selectRunRows(
  supabase: ReturnType<typeof createAdminSupabase>,
  tenantId: string,
  columns: string,
  limit: number,
): Promise<RunRow[] | null> {
  const first = await supabase
    .from("agent_runs")
    .select(columns)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!first.error) return (first.data ?? []) as unknown as RunRow[];
  if (!isMissingActorColumn(first.error.message)) return null;

  const fallback = await supabase
    .from("agent_runs")
    .select("id, agent_id, status, summary, cost_estimate_cop, created_at, created_by")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (fallback.error) return null;
  return (fallback.data ?? []) as unknown as RunRow[];
}

function isMissingActorColumn(message: string) {
  return message.includes("actor_name");
}
