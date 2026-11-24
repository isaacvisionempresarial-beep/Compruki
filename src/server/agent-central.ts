import { formatCop } from "@/lib/format";
import { orderFocusHref } from "@/lib/store-order";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildTemplateDrafts, listPendingContentDrafts } from "@/server/agent-content";
import { searchLocalCatalog } from "@/server/agent-explorer";
import { calculateMargin, comparePriceScenarios } from "@/server/agent-tools";
import { previewContentDraftsAgainstCatalog, type CatalogFieldDiff } from "@/server/catalog-store";
import { listOrders } from "@/server/order-store";
import { listOpenProductQuestions } from "@/server/product-questions";
import { getPilotTenantId } from "@/server/tenant";

export type RoutedAgent = "AG-01" | "AG-02" | "AG-03" | "AG-04";

export type PendingApproval = {
  id: string;
  kind: "pedido" | "agente" | "borrador" | "pregunta";
  label: string;
  detail: string;
  href?: string;
  actionable?: boolean;
  /** Contenido a revisar antes de aprobar (borradores). */
  preview?: {
    title: string;
    body: string;
    cta: string;
    applyTarget: string;
    diffs: CatalogFieldDiff[];
    catalogError: string | null;
    fallbackTitle: string;
  };
  /** Pregunta de ficha (AG-05) pendiente de respuesta humana. */
  questionPreview?: {
    question: string;
    autoReply: string;
    sku: string;
  };
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

function authorLine(name: string | null) {
  return `Guardó ${name?.trim() || "el panel"}.`;
}

const AGENT_LABEL: Record<RoutedAgent, string> = {
  "AG-01": "Central",
  "AG-02": "Explorador",
  "AG-03": "Creador",
  "AG-04": "Analista",
};

/** AG-01 · list_pending_approvals (pedidos + borradores + corridas + preguntas de ficha). */
export async function listPendingApprovals(): Promise<PendingApproval[]> {
  const [orders, agentItems, draftItems, questionItems] = await Promise.all([
    listOrders(),
    listAwaitingAgentApprovals(),
    listPendingDraftApprovals(),
    listPendingQuestionApprovals(),
  ]);

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
      actionable: false,
    }));

  return [...pendingOrders, ...draftItems, ...agentItems, ...questionItems];
}

async function listPendingQuestionApprovals(): Promise<PendingApproval[]> {
  const questions = await listOpenProductQuestions(8);
  return questions.map((item) => ({
    id: item.id,
    kind: "pregunta" as const,
    label: item.productSku,
    detail: `Pregunta de ficha · ${item.question.slice(0, 140)}`,
    href: `/panel/catalogo/${encodeURIComponent(item.productSku)}#preguntas-abiertas`,
    actionable: true,
    questionPreview: {
      question: item.question,
      autoReply: item.autoReply,
      sku: item.productSku,
    },
  }));
}

async function listPendingDraftApprovals(): Promise<PendingApproval[]> {
  const drafts = await listPendingContentDrafts(8);
  const comparisons = await previewContentDraftsAgainstCatalog(
    drafts.map((draft) => ({
      sku: draft.productSku,
      channel: draft.channel,
      title: draft.title,
      body: draft.body,
      cta: draft.cta,
    })),
  );

  return drafts.map((draft, index) => {
    const comparison = comparisons[index] ?? {
      error: `No encontré ${draft.productSku} en el catálogo local.`,
      diffs: [],
      applyTarget: "",
      fallbackTitle: "",
    };
    const changed = comparison.diffs.filter((diff) => diff.changed).length;
    return {
      id: draft.id,
      kind: "borrador" as const,
      label: `${draft.productSku} · ${draft.channel}`,
      detail: comparison.error
        ? `${authorLine(draft.authorName)} ${comparison.error}`
        : `${authorLine(draft.authorName)} Al aprobar se escribe en ${comparison.applyTarget}${
            changed > 0 ? ` · ${changed} campo(s) cambian` : " · sin cambios detectados"
          }.`,
      href: `/panel/agentes?sku=${encodeURIComponent(draft.productSku)}`,
      actionable: true,
      preview: {
        title: draft.title || "(sin título)",
        body: draft.body || "(sin cuerpo)",
        cta: draft.cta || "",
          applyTarget: comparison.applyTarget,
          diffs: comparison.diffs,
          catalogError: comparison.error,
          fallbackTitle: comparison.fallbackTitle,
        },
    };
  });
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
      actionable: true,
    }));
  } catch {
    return [];
  }
}

function piece(count: number, one: string, many: string) {
  if (count === 0) return "";
  return `${count} ${count === 1 ? one : many}`;
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
        : `Explorador: ${piece(explorerCount, "producto", "productos")} en shortlist local (no es Dropi en vivo, no cambia el catálogo).`,
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
        marginNote = `${row.sku}: margen estimado ${formatCop(row.margin)} sobre el precio de la ficha ${formatCop(row.price)}. No es dinero cobrado.`;
        summary.push(`Analista: ${marginNote}`);
        if (scenario) {
          const down = scenario.scenarios[0];
          const up = scenario.scenarios[2];
          if (down && up) {
            summary.push(
              `Escenarios ±10 %: ${formatCop(down.margin)} / ${formatCop(up.margin)} (lectura: no guarda el precio ni es utilidad realizada).`,
            );
          }
        }
      } else {
        summary.push(`Analista: no hay SKU ${sku} en el catálogo local.`);
      }
    } else {
      const margins = await calculateMargin();
      const positive = margins.filter((row) => row.margin > 0).length;
      summary.push(
        `Analista: ${margins.length} productos; ${positive} con margen estimado positivo de la ficha. No es dinero cobrado.`,
      );
    }
  }

  if (uniqueAgents.includes("AG-03")) {
    const targetSku = sku || (await searchLocalCatalog(intent, "")).results[0]?.sku || "";
    if (targetSku) {
      const packed = await buildTemplateDrafts(targetSku);
      draftChannels = packed?.drafts.map((draft) => draft.channel) ?? [];
      summary.push(
        draftChannels.length > 0
          ? `Creador: plantillas de ${targetSku} (${draftChannels.join(", ")}). No se guardaron ni se publicaron. El precio no cambió.`
          : `Creador: no se pudieron armar borradores para ${targetSku}.`,
      );
      suggestedLinks.push({
        label: `Plantillas ${targetSku}`,
        href: `/panel/agentes?sku=${encodeURIComponent(targetSku)}`,
      });
    } else {
      summary.push("Creador: indica un SKU para generar borradores plantilla.");
    }
  }

  const pending = await listPendingApprovals();
  if (pending.length > 0) {
    const pedidos = pending.filter((item) => item.kind === "pedido").length;
    const borradores = pending.filter((item) => item.kind === "borrador").length;
    const corridas = pending.filter((item) => item.kind === "agente").length;
    const preguntas = pending.filter((item) => item.kind === "pregunta").length;
    const parts = [
      piece(pedidos, "pedido", "pedidos"),
      piece(borradores, "borrador", "borradores"),
      piece(corridas, "corrida", "corridas"),
      piece(preguntas, "pregunta", "preguntas"),
    ].filter(Boolean);
    summary.push(`Pendientes humanos: ${parts.join(", ")}.`);
  } else {
    summary.push("Pendientes humanos: no hay pedidos, borradores, corridas ni preguntas en espera.");
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
