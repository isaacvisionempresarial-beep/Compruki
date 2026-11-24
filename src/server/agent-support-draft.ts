import { STATUS_LABEL } from "@/lib/demo-data";
import { formatCop } from "@/lib/format";
import type { StoreOrder } from "@/lib/store-order";
import { listOrders } from "@/server/order-store";

export type SupportDraftSource = "plantilla" | "openai";

export type SupportResolutionDraft = {
  orderNumber: string;
  bullets: string[];
  customerNote: string;
  via: SupportDraftSource;
  costEstimateCop: number;
};

const draftCache = new Map<string, SupportResolutionDraft>();

export function rememberSupportDraft(draft: SupportResolutionDraft) {
  draftCache.set(draft.orderNumber.toUpperCase(), draft);
}

export function getSupportDraftPreview(orderNumber: string): SupportResolutionDraft | null {
  return draftCache.get(orderNumber.trim().toUpperCase()) ?? null;
}

/** Solo tests. */
export function clearSupportDraftCache() {
  draftCache.clear();
}

function scrub(text: string) {
  return text
    .replace(/\bDropi\b/gi, "")
    .replace(/\bOpenAI\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plantilla local para el dueño. */
export function buildSupportDraftTemplate(order: StoreOrder): SupportResolutionDraft {
  const status = STATUS_LABEL[order.status] ?? order.status;
  const reason = order.customerReason?.trim() || "Sin motivo anotado.";
  const bullets = [
    `${order.number} está en «${status}». Revisar motivo: ${reason.slice(0, 120)}`,
    `Total guardado ${formatCop(order.total)}. Resolver o devolver no cobra en el sitio.`,
    order.providerRef?.trim()
      ? "Hay número de sincronización anotado: contrastar con el proveedor a mano."
      : "Sin número de sincronización: anótalo si aplica antes de cerrar el caso.",
  ];
  if (order.status === "incidencia" && !order.customerReason?.trim()) {
    bullets.push("Falta el motivo de la incidencia antes de resolverla.");
  }
  const first = order.customerName.trim().split(/\s+/)[0] ?? "";
  const hello = first.length >= 2 ? `Hola ${first}.` : "Hola.";
  const customerNote =
    order.status === "incidencia"
      ? `${hello} Estamos revisando tu pedido ${order.number}. Te avisamos cuando quede resuelto. Nadie cobra en la tienda web.`
      : order.status === "devuelto"
        ? `${hello} Tu pedido ${order.number} quedó marcado como devolución. Si necesitas algo más, escríbenos.`
        : `${hello} Sobre tu pedido ${order.number}: estamos revisando el caso. El total guardado no cambia desde este mensaje.`;

  return {
    orderNumber: order.number,
    bullets,
    customerNote: customerNote.slice(0, 400),
    via: "plantilla",
    costEstimateCop: 0,
  };
}

/** Interpreta JSON de borrador AG-09. */
export function parseOpenAISupportDraft(raw: string): { bullets: string[]; customerNote: string } | null {
  try {
    const data = JSON.parse(raw) as { bullets?: unknown; customerNote?: unknown };
    const bullets = Array.isArray(data.bullets)
      ? data.bullets
          .map((item) => (typeof item === "string" ? scrub(item).slice(0, 220) : ""))
          .filter(Boolean)
          .slice(0, 4)
      : [];
    const customerNote =
      typeof data.customerNote === "string" ? scrub(data.customerNote).slice(0, 400) : "";
    if (bullets.length === 0 && customerNote.length < 12) return null;
    return {
      bullets: bullets.length > 0 ? bullets : ["Revisar el caso con los datos del pedido antes de cerrarlo."],
      customerNote:
        customerNote.length >= 12
          ? customerNote
          : "Estamos revisando tu pedido. Te avisamos cuando quede resuelto. Nadie cobra en la tienda web.",
    };
  } catch {
    return null;
  }
}

/**
 * AG-09 lite · borrador de resolución / aviso.
 * No resuelve la incidencia ni cambia el pedido.
 */
export async function generateSupportDraft(orderNumber: string): Promise<SupportResolutionDraft | null> {
  const needle = orderNumber.trim();
  if (!needle) return null;
  const order = (await listOrders()).find((item) => item.number === needle || item.number === decodeURIComponent(needle));
  if (!order) return null;

  const template = buildSupportDraftTemplate(order);
  const { openAIKeyConfigured } = await import("@/server/openai-client");
  if (!openAIKeyConfigured()) {
    rememberSupportDraft(template);
    return template;
  }

  try {
    const { chatJsonCompletion } = await import("@/server/openai-client");
    const firstName = order.customerName.trim().split(/\s+/)[0] ?? "";
    const system = [
      "Eres AG-09 Posventa de COMPRUKI (panel dueño, Colombia).",
      "Devuelve SOLO JSON: {bullets:string[], customerNote:string}.",
      "bullets: 2 a 4 pasos internos para el dueño (no inventes reembolsos ni plazos).",
      "customerNote: mensaje corto al cliente (≤400 chars). Español colombiano claro.",
      "Usa solo el estado y el motivo del pedido. No menciones Dropi ni OpenAI.",
      "Esto es un borrador: un humano decide; no resuelve ni envía solo.",
    ].join(" ");

    const completion = await chatJsonCompletion({
      system,
      user: JSON.stringify({
        number: order.number,
        status: order.status,
        statusLabel: STATUS_LABEL[order.status],
        reason: order.customerReason?.trim().slice(0, 200) || null,
        totalLabel: formatCop(order.total),
        hasProviderRef: Boolean(order.providerRef?.trim()),
        collected: order.collected,
        firstName: firstName.length >= 2 ? firstName : null,
        city: order.city,
      }),
      maxTokens: 420,
    });

    if (!completion.ok) {
      rememberSupportDraft(template);
      return template;
    }

    const parsed = parseOpenAISupportDraft(completion.text);
    if (!parsed) {
      rememberSupportDraft(template);
      return template;
    }

    const draft: SupportResolutionDraft = {
      orderNumber: order.number,
      bullets: parsed.bullets,
      customerNote: parsed.customerNote,
      via: "openai",
      costEstimateCop: completion.costEstimateCop,
    };
    rememberSupportDraft(draft);
    return draft;
  } catch {
    rememberSupportDraft(template);
    return template;
  }
}
