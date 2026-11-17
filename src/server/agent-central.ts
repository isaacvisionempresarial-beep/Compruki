import { formatCop } from "@/lib/format";
import { orderFocusHref } from "@/lib/store-order";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildTemplateDrafts } from "@/server/agent-content";
import { searchLocalCatalog } from "@/server/agent-explorer";
import { calculateMargin, comparePriceScenarios } from "@/server/agent-tools";
import { listOrders } from "@/server/order-store";
import { getPilotTenantId } from "@/server/tenant";

export type RoutedAgent = "AG-01" | "AG-02" | "AG-03" | "AG-04";

export type PendingApproval = {
  id: string;
  kind: "pedido" | "agente";
  label: string;
  detail: string;
  href?: string;
};

export type CentralRouteResult = {
  intent: string;
  openaiUsed: false;
  agents: RoutedAgent[];
  summary: string[];
  pending: PendingApproval[];
  explorerCount: number;
  marginNote: string | null;
  draftChannels: string[];
  suggestedLinks: Array<{ label: string; href: string }>;
};

const AGENT_LABEL: Record<RoutedAgent, string> = {
  "AG-01": "Central",
  "AG-02": "Explorador",
  "AG-03": "Creador",
  "AG-04": "Analista",
};

/** AG-01 · list_pending_approvals (pedidos + corridas awaiting_approval). */
export async function listPendingApprovals(): Promise<PendingApproval[]> {
  const [orders, agentItems] = await Promise.all([listOrders(), listAwaitingAgentApprovals()]);

  const pendingOrders = orders
    .filter((order) => order.status === "pendiente_confirmacion" || order.status === "incidencia")
    .slice(0, 8)
    .map((order) => ({
      id: order.id,
      kind: "pedido" as const,
      label: order.number,
      detail:
        order.status === "incidencia"
          ? `${order.customerName} · incidencia`
          : `${order.customerName} · pendiente de confirmación`,
      href: orderFocusHref(order.number),
    }));

  return [...pendingOrders, ...agentItems];
}

async function listAwaitingAgentApprovals(): Promise<PendingApproval[]> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("agent_runs")
      .select("id, agent_id, summary, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "awaiting_approval")
      .order("created_at", { ascending: false })
      .limit(8);

    if (error || !data) return [];

    return data.map((row) => ({
      id: String(row.id),
      kind: "agente" as const,
      label: String(row.agent_id),
      detail: typeof row.summary === "string" && row.summary ? row.summary : "Corrida en espera de aprobación humana",
      href: "/panel/agentes#corridas",
    }));
  } catch {
    return [];
  }
}

/**
 * AG-01 · route_task — orquestación determinista sin LLM.
 * Detecta intención por palabras clave y arma un paquete con tools locales.
 */
export async function routeTask(rawIntent: string): Promise<CentralRouteResult> {
  const intent = rawIntent.trim();
  const lower = intent.toLocaleLowerCase("es");
  const skuMatch = intent.toUpperCase().match(/\b[A-Z0-9]+(?:-[A-Z0-9]+)+\b/);
  const sku = skuMatch?.[0] ?? "";

  const wantsExplore =
    !intent ||
    /\b(busca|buscar|explora|producto|cat[aá]logo|shortlist|categor[ií]a)\b/i.test(lower) ||
    Boolean(sku);
  const wantsMargin =
    /\b(margen|rentab|precio|escenario|analista|costo|ganancia)\b/i.test(lower) || Boolean(sku);
  const wantsContent =
    /\b(contenido|borrador|anuncio|copy|whatsapp|ficha|creador|texto)\b/i.test(lower) || Boolean(sku);

  const agents: RoutedAgent[] = ["AG-01"];
  if (wantsExplore) agents.push("AG-02");
  if (wantsMargin) agents.push("AG-04");
  if (wantsContent) agents.push("AG-03");

  const uniqueAgents = [...new Set(agents)];
  const summary: string[] = [
    "OpenAI no está conectado: este recorrido es solo con reglas y datos locales.",
    `Agentes llamados: ${uniqueAgents.map((id) => AGENT_LABEL[id]).join(", ")}.`,
  ];

  let explorerCount = 0;
  let marginNote: string | null = null;
  let draftChannels: string[] = [];
  const suggestedLinks: Array<{ label: string; href: string }> = [
    { label: "Centro de agentes", href: "/panel/agentes" },
  ];

  if (uniqueAgents.includes("AG-02")) {
    const query = sku || intent;
    const explorer = await searchLocalCatalog(query, "");
    explorerCount = explorer.results.length;
    summary.push(
      explorerCount === 0
        ? "Explorador: sin coincidencias en el catálogo local."
        : `Explorador: ${explorerCount} producto(s) en shortlist local (no es Dropi en vivo).`,
    );
    const params = new URLSearchParams();
    if (sku) params.set("q", sku);
    else if (intent) params.set("q", intent);
    suggestedLinks.push({ label: "Ver shortlist", href: `/panel/agentes?${params.toString()}` });
  }

  if (uniqueAgents.includes("AG-04")) {
    if (sku) {
      const [margins, scenarios] = await Promise.all([calculateMargin(sku), comparePriceScenarios(sku)]);
      const row = margins[0];
      const scenario = scenarios[0];
      if (row) {
        marginNote = `${row.sku}: margen estimado ${formatCop(row.margin)} sobre ${formatCop(row.price)}.`;
        summary.push(`Analista: ${marginNote}`);
        if (scenario) {
          const down = scenario.scenarios[0];
          const up = scenario.scenarios[2];
          if (down && up) {
            summary.push(
              `Escenarios ±10 %: ${formatCop(down.margin)} / ${formatCop(up.margin)} (estimado, no utilidad realizada).`,
            );
          }
        }
      } else {
        summary.push(`Analista: no hay SKU ${sku} en el catálogo local.`);
      }
    } else {
      const margins = await calculateMargin();
      const positive = margins.filter((row) => row.margin > 0).length;
      summary.push(`Analista: ${margins.length} productos; ${positive} con margen estimado positivo.`);
    }
  }

  if (uniqueAgents.includes("AG-03")) {
    const targetSku = sku || (await searchLocalCatalog(intent, "")).results[0]?.sku || "";
    if (targetSku) {
      const packed = await buildTemplateDrafts(targetSku);
      draftChannels = packed?.drafts.map((draft) => draft.channel) ?? [];
      summary.push(
        draftChannels.length > 0
          ? `Creador: borradores plantilla listos para ${targetSku} (${draftChannels.join(", ")}).`
          : `Creador: no se pudieron armar borradores para ${targetSku}.`,
      );
      suggestedLinks.push({
        label: `Borradores ${targetSku}`,
        href: `/panel/agentes?sku=${encodeURIComponent(targetSku)}`,
      });
    } else {
      summary.push("Creador: indica un SKU para generar borradores plantilla.");
    }
  }

  const pending = await listPendingApprovals();
  if (pending.length > 0) {
    summary.push(`Pendientes humanos: ${pending.length} pedido(s) por confirmar o en incidencia.`);
  } else {
    summary.push("Pendientes humanos: no hay pedidos en cola de confirmación/incidencia.");
  }

  return {
    intent: intent || "(resumen general)",
    openaiUsed: false,
    agents: uniqueAgents,
    summary,
    pending,
    explorerCount,
    marginNote,
    draftChannels,
    suggestedLinks,
  };
}
