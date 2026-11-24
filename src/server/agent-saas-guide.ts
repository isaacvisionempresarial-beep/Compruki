import { listProducts } from "@/server/catalog-store";
import { getAgentGatewayStatus } from "@/server/agent-gateway";
import { listPendingApprovals } from "@/server/agent-central";
import { listOrders } from "@/server/order-store";
import { openAIKeyConfigured } from "@/server/openai-client";

export type SaasGuideSource = "plantilla" | "openai";

export type OnboardingProgress = {
  tenantLabel: string;
  publishedProducts: number;
  availableProducts: number;
  openOrders: number;
  pendingApprovals: number;
  openaiConnected: boolean;
  openaiKeyPresent: boolean;
  dropiConnected: false;
  planLabel: string;
  planLimits: string[];
};

export type SaasGuide = {
  progress: OnboardingProgress;
  scoreLabel: string;
  steps: string[];
  nextFocus: string;
  supportNote: string;
  via: SaasGuideSource;
  costEstimateCop: number;
};

let guideCache: SaasGuide | null = null;

export function rememberSaasGuide(guide: SaasGuide) {
  guideCache = guide;
}

export function getSaasGuidePreview(): SaasGuide | null {
  return guideCache;
}

/** Solo tests. */
export function clearSaasGuideCache() {
  guideCache = null;
}

function scrub(text: string) {
  return text
    .replace(/\bDropi\b/gi, "sincronización")
    .replace(/\bOpenAI\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** AG-10 · get_onboarding_progress + get_plan_limits (piloto). */
export async function getOnboardingProgress(tenantLabel = "Tienda piloto"): Promise<OnboardingProgress> {
  const [products, orders, status, pending] = await Promise.all([
    listProducts(),
    listOrders(),
    getAgentGatewayStatus(),
    listPendingApprovals(),
  ]);

  return {
    tenantLabel,
    publishedProducts: products.filter((product) => product.published).length,
    availableProducts: products.filter((product) => product.published && product.available).length,
    openOrders: orders.filter((order) => !["entregado", "cancelado", "devuelto"].includes(order.status)).length,
    pendingApprovals: pending.length,
    openaiConnected: status.openaiConnected,
    openaiKeyPresent: openAIKeyConfigured(),
    dropiConnected: false,
    planLabel: "Piloto local (sin cobro de suscripción)",
    planLimits: [
      "Una tienda activa por sesión.",
      "Checkout y pedidos no dependen de agentes ni de sincronización externa.",
      "Los agentes proponen borradores; un humano aprueba o envía.",
      "No hay compra automática de anuncios ni tickets reales todavía.",
    ],
  };
}

function scoreLabel(progress: OnboardingProgress) {
  let done = 0;
  if (progress.publishedProducts > 0) done += 1;
  if (progress.availableProducts > 0) done += 1;
  if (progress.openOrders >= 0) done += 1; // siempre cuenta: flujo de pedidos listo
  if (progress.pendingApprovals === 0) done += 1;
  if (progress.openaiKeyPresent) done += 1;
  return `${done} de 5 señales listas`;
}

/** Plantilla local sin modelo. */
export function buildSaasGuideTemplate(progress: OnboardingProgress): SaasGuide {
  const steps: string[] = [];
  if (progress.publishedProducts === 0) {
    steps.push("Publica al menos una ficha en Catálogo para que la tienda muestre productos.");
  } else {
    steps.push(
      `Ya hay ${progress.publishedProducts} ficha(s) publicada(s)` +
        (progress.availableProducts > 0
          ? ` · ${progress.availableProducts} disponibles.`
          : ". Revisa disponibilidad si quieres vender ya."),
    );
  }
  steps.push(
    progress.openOrders > 0
      ? `Hay ${progress.openOrders} pedido(s) abiertos: revísalos en Pedidos. Verlos no cobra.`
      : "El flujo de pedidos está listo. Un pedido de prueba confirma captura y seguimiento.",
  );
  if (progress.pendingApprovals > 0) {
    steps.push(
      `Hay ${progress.pendingApprovals} pendiente(s) humano(s) en Centro de agentes. Aprobar o rechazar no cobra en la tienda.`,
    );
  } else {
    steps.push("No hay pendientes humanos abiertos. Los borradores de agentes siguen esperando tu revisión cuando salgan.");
  }
  if (!progress.openaiKeyPresent) {
    steps.push("Sin clave de modelo: los agentes usan plantilla/cifras locales. Configurarla es opcional para el piloto.");
  } else if (!progress.openaiConnected) {
    steps.push("Hay clave de modelo pero la prueba no confirmó. Los agentes caerán a plantilla hasta que responda.");
  } else {
    steps.push("La prueba de modelo respondió. Los borradores pueden usar OpenAI con costo estimado en corridas.");
  }
  steps.push(
    "Sincronización externa sigue desconectada a propósito. Pedidos y checkout no dependen de ella.",
  );

  const nextFocus =
    progress.publishedProducts === 0
      ? "Empieza por publicar una ficha en Catálogo."
      : progress.pendingApprovals > 0
        ? "Atiende los pendientes humanos en Centro de agentes."
        : "Revisa Pedidos o genera un borrador de agente; nada de eso cobra solo.";

  return {
    progress,
    scoreLabel: scoreLabel(progress),
    steps,
    nextFocus,
    supportNote: [
      `Tienda: ${progress.tenantLabel}. Plan: ${progress.planLabel}.`,
      `Publicados ${progress.publishedProducts}, disponibles ${progress.availableProducts}, pedidos abiertos ${progress.openOrders}, pendientes ${progress.pendingApprovals}.`,
      "Necesito ayuda con la configuración del piloto. Nadie cobra en la tienda web.",
    ].join(" "),
    via: "plantilla",
    costEstimateCop: 0,
  };
}

/** Interpreta JSON de guía AG-10. */
export function parseOpenAISaasGuide(
  raw: string,
  progress: OnboardingProgress,
): { steps: string[]; nextFocus: string; supportNote: string } | null {
  try {
    const data = JSON.parse(raw) as {
      steps?: unknown;
      nextFocus?: unknown;
      supportNote?: unknown;
    };
    const steps = Array.isArray(data.steps)
      ? data.steps
          .map((item) => (typeof item === "string" ? scrub(item).slice(0, 220) : ""))
          .filter(Boolean)
          .slice(0, 6)
      : [];
    const nextFocus = typeof data.nextFocus === "string" ? scrub(data.nextFocus).slice(0, 200) : "";
    const supportNote = typeof data.supportNote === "string" ? scrub(data.supportNote).slice(0, 400) : "";
    if (steps.length < 2 || nextFocus.length < 12) return null;
    return {
      steps,
      nextFocus,
      supportNote:
        supportNote.length >= 20
          ? supportNote
          : `Tienda ${progress.tenantLabel}: necesito ayuda con la configuración del piloto. Nadie cobra en la tienda web.`,
    };
  } catch {
    return null;
  }
}

/**
 * AG-10 lite · guía de alta / configuración.
 * No crea tickets reales ni cambia la tienda.
 */
export async function generateSaasGuide(tenantLabel = "Tienda piloto"): Promise<SaasGuide> {
  const progress = await getOnboardingProgress(tenantLabel);
  const template = buildSaasGuideTemplate(progress);

  if (!openAIKeyConfigured()) {
    rememberSaasGuide(template);
    return template;
  }

  try {
    const { chatJsonCompletion } = await import("@/server/openai-client");
    const system = [
      "Eres AG-10 Asistente SaaS de COMPRUKI (panel dueño, Colombia).",
      "Devuelve SOLO JSON: {steps:string[], nextFocus:string, supportNote:string}.",
      "steps: 3 a 6 pasos concretos según el progreso. nextFocus: una sola prioridad (≤200).",
      "supportNote: texto corto para pegar en un correo de soporte (≤400). No abras ticket solo.",
      "Usa solo las cifras del usuario. Español colombiano. No menciones Dropi ni OpenAI por nombre.",
      "Deja claro que generar la guía no cobra ni cambia pedidos.",
    ].join(" ");

    const completion = await chatJsonCompletion({
      system,
      user: JSON.stringify(progress),
      maxTokens: 700,
    });

    if (!completion.ok) {
      rememberSaasGuide(template);
      return template;
    }

    const parsed = parseOpenAISaasGuide(completion.text, progress);
    if (!parsed) {
      rememberSaasGuide(template);
      return template;
    }

    const guide: SaasGuide = {
      progress,
      scoreLabel: scoreLabel(progress),
      steps: parsed.steps,
      nextFocus: parsed.nextFocus,
      supportNote: parsed.supportNote,
      via: "openai",
      costEstimateCop: completion.costEstimateCop,
    };
    rememberSaasGuide(guide);
    return guide;
  } catch {
    rememberSaasGuide(template);
    return template;
  }
}
