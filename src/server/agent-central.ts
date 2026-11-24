import { formatCop } from "@/lib/format";
import { orderDetailSectionHref } from "@/lib/store-order";
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

export type CentralRouteVia = "openai" | "reglas";

export type CentralRouteResult = {
  intent: string;
  openaiUsed: boolean;
  via: CentralRouteVia;
  costEstimateCop: number;
  agents: RoutedAgent[];
  summary: string[];
  pending: PendingApproval[];
  explorerCount: number;
  marginNote: string | null;
  draftChannels: string[];
  suggestedLinks: Array<{ label: string; href: string }>;
};

type RoutePlan = {
  wantsExplore: boolean;
  wantsMargin: boolean;
  wantsContent: boolean;
  sku: string;
  focus: string;
  via: CentralRouteVia;
  costEstimateCop: number;
};

const routePreviewByIntent = new Map<string, CentralRouteResult>();

/** Evita volver a llamar al modelo al recargar `?intent=` tras Enrutar. */
export function rememberCentralRoute(result: CentralRouteResult) {
  const key = result.intent.trim().toLocaleLowerCase("es");
  if (!key || key === "(resumen general)") return;
  routePreviewByIntent.set(key, result);
}

export function getRememberedCentralRoute(rawIntent: string): CentralRouteResult | null {
  const key = rawIntent.trim().toLocaleLowerCase("es");
  if (!key) return null;
  return routePreviewByIntent.get(key) ?? null;
}

/** Solo tests. */
export function clearCentralRoutePreviewCache() {
  routePreviewByIntent.clear();
}

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
      href:
        order.status === "incidencia"
          ? orderDetailSectionHref(order.number, "pedido-avisos")
          : orderDetailSectionHref(order.number, "pedido-herramientas"),
      actionable: false,
    }));

  return [...pendingOrders, ...draftItems, ...agentItems, ...questionItems];
}

async function listPendingQuestionApprovals(): Promise<PendingApproval[]> {
  const questions = await listOpenProductQuestions(20);
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

function extractSku(intent: string) {
  return intent.toUpperCase().match(/\b[A-Z0-9]+(?:-[A-Z0-9]+)+\b/)?.[0] ?? "";
}

/** Plan por palabras clave. Sin OpenAI. */
export function planRouteFromRules(rawIntent: string): RoutePlan {
  const intent = rawIntent.trim();
  const lower = intent.toLocaleLowerCase("es");
  const sku = extractSku(intent);
  return {
    wantsExplore:
      !intent ||
      /\b(busca|buscar|explora|producto|cat[aá]logo|shortlist|categor[ií]a)\b/i.test(lower) ||
      Boolean(sku),
    wantsMargin:
      /\b(margen|rentab|precio|escenario|analista|costo|ganancia)\b/i.test(lower) || Boolean(sku),
    wantsContent:
      /\b(contenido|borrador|anuncio|copy|whatsapp|ficha|creador|texto)\b/i.test(lower) || Boolean(sku),
    sku,
    focus: "",
    via: "reglas",
    costEstimateCop: 0,
  };
}

/** Interpreta JSON de OpenAI para el plan de enrutado. */
export function parseOpenAIRoutePlan(raw: string, fallbackSku: string): Omit<RoutePlan, "via" | "costEstimateCop"> | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const skuRaw = typeof data.sku === "string" ? data.sku.trim().toUpperCase() : "";
    const sku = extractSku(skuRaw) || (skuRaw.match(/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/) ? skuRaw : "") || fallbackSku;
    const focus = scrubRouteFocus(typeof data.focus === "string" ? data.focus : "").slice(0, 160);
    return {
      wantsExplore: Boolean(data.explore),
      wantsMargin: Boolean(data.margin),
      wantsContent: Boolean(data.content),
      sku,
      focus,
    };
  } catch {
    return null;
  }
}

function scrubRouteFocus(text: string) {
  return text
    .replace(/\bDropi\b/gi, "")
    .replace(/\bOpenAI\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveRoutePlan(rawIntent: string): Promise<RoutePlan> {
  const rules = planRouteFromRules(rawIntent);
  const { openAIKeyConfigured } = await import("@/server/openai-client");
  if (!openAIKeyConfigured()) return rules;

  try {
    const { chatJsonCompletion } = await import("@/server/openai-client");
    const system = [
      "Eres COMPRUKI Central (panel dueño, Colombia).",
      "Devuelve SOLO JSON: {explore:boolean, margin:boolean, content:boolean, sku:string, focus:string}.",
      "explore=buscar catálogo local; margin=rentabilidad/precios; content=borradores ficha/anuncio/whatsapp.",
      "sku solo si aparece un código tipo ABC-DEF-01; si no, \"\".",
      "focus: una frase corta en español colombiano sobre lo que pidió el dueño. Sin Dropi ni OpenAI.",
      "Si la consulta es vaga, activa explore. Puedes activar varias banderas.",
    ].join(" ");
    const completion = await chatJsonCompletion({
      system,
      user: JSON.stringify({ intent: rawIntent.trim() || "(resumen general)" }),
      maxTokens: 220,
    });
    if (!completion.ok) return rules;
    const parsed = parseOpenAIRoutePlan(completion.text, rules.sku);
    if (!parsed) return rules;
    // Si el modelo apaga todo, al menos exploramos con reglas.
    if (!parsed.wantsExplore && !parsed.wantsMargin && !parsed.wantsContent) {
      return { ...rules, via: "openai", costEstimateCop: completion.costEstimateCop, focus: parsed.focus };
    }
    return { ...parsed, via: "openai", costEstimateCop: completion.costEstimateCop };
  } catch {
    return rules;
  }
}

/**
 * AG-01 · route_task — OpenAI interpreta la intención si responde; si no, reglas.
 * Las tools (Explorador / Analista / Creador plantilla) siguen siendo locales.
 */
export async function routeTask(rawIntent: string): Promise<CentralRouteResult> {
  const intent = rawIntent.trim();
  const remembered = getRememberedCentralRoute(intent);
  if (remembered) return remembered;

  const plan = await resolveRoutePlan(intent);
  const sku = plan.sku;

  const agents: RoutedAgent[] = ["AG-01"];
  if (plan.wantsExplore) agents.push("AG-02");
  if (plan.wantsMargin) agents.push("AG-04");
  if (plan.wantsContent) agents.push("AG-03");

  const uniqueAgents = [...new Set(agents)];
  const summary: string[] = [
    plan.via === "openai"
      ? "OpenAI interpretó la intención; datos y tools son locales (sin Dropi en vivo)."
      : "Recorrido con reglas y datos locales (OpenAI no respondió o no hay clave).",
    `Agentes llamados: ${uniqueAgents.map((id) => AGENT_LABEL[id]).join(", ")}.`,
  ];
  if (plan.focus) summary.push(`Lectura Central: ${plan.focus}`);

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

  const result: CentralRouteResult = {
    intent: intent || "(resumen general)",
    openaiUsed: plan.via === "openai",
    via: plan.via,
    costEstimateCop: plan.costEstimateCop,
    agents: uniqueAgents,
    summary,
    pending,
    explorerCount,
    marginNote,
    draftChannels,
    suggestedLinks,
  };
  rememberCentralRoute(result);
  return result;
}
