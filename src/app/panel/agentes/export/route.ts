import { agentRunsToCsv, listAgentRunsForExport } from "@/server/agent-runs";
import { getPanelAccess } from "@/server/panel-auth";

export const dynamic = "force-dynamic";

/** Auditoría CSV de corridas del tenant. Requiere sesión de panel. */
export async function GET() {
  if (!(await getPanelAccess())) {
    return new Response("No autorizado", { status: 401 });
  }

  const rows = await listAgentRunsForExport(500);
  const csv = agentRunsToCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compruki-agent-runs-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
