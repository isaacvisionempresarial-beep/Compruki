import { STATUS_LABEL } from "@/lib/demo-data";
import { formatCop } from "@/lib/format";
import { customerMessage, type StoreOrder } from "@/lib/store-order";
import { listOrders } from "@/server/order-store";

export type CustomerDraftSource = "plantilla" | "openai";

export type CustomerMessageDraft = {
  orderNumber: string;
  text: string;
  via: CustomerDraftSource;
  costEstimateCop: number;
};

const draftCache = new Map<string, CustomerMessageDraft>();

export function rememberCustomerDraft(draft: CustomerMessageDraft) {
  draftCache.set(draft.orderNumber.toUpperCase(), draft);
}

export function getCustomerDraftPreview(orderNumber: string): CustomerMessageDraft | null {
  return draftCache.get(orderNumber.trim().toUpperCase()) ?? null;
}

/** Solo tests. */
export function clearCustomerDraftCache() {
  draftCache.clear();
}

function scrub(text: string) {
  return text
    .replace(/\bDropi\b/gi, "")
    .replace(/\bOpenAI\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plantilla local (mismo tono que el mensaje de ficha). */
export function buildCustomerMessageTemplate(order: StoreOrder): CustomerMessageDraft {
  return {
    orderNumber: order.number,
    text: customerMessage(order).slice(0, 500),
    via: "plantilla",
    costEstimateCop: 0,
  };
}

/** Interpreta JSON de borrador AG-07. */
export function parseOpenAICustomerDraft(raw: string): string | null {
  try {
    const data = JSON.parse(raw) as { message?: unknown };
    const message = typeof data.message === "string" ? scrub(data.message).slice(0, 500) : "";
    return message.length >= 12 ? message : null;
  } catch {
    return null;
  }
}

/**
 * AG-07 lite · borrador de mensaje al cliente.
 * No envía WhatsApp ni cambia el pedido.
 */
export async function generateCustomerMessageDraft(orderNumber: string): Promise<CustomerMessageDraft | null> {
  const needle = orderNumber.trim();
  if (!needle) return null;
  const order = (await listOrders()).find((item) => item.number === needle || item.number === decodeURIComponent(needle));
  if (!order) return null;

  const template = buildCustomerMessageTemplate(order);
  const { openAIKeyConfigured } = await import("@/server/openai-client");
  if (!openAIKeyConfigured()) {
    rememberCustomerDraft(template);
    return template;
  }

  try {
    const { chatJsonCompletion } = await import("@/server/openai-client");
    const firstName = order.customerName.trim().split(/\s+/)[0] ?? "";
    const system = [
      "Eres AG-07 Gestor de Clientes de COMPRUKI (panel dueño, Colombia).",
      "Devuelve SOLO JSON: {message:string}.",
      "message: texto corto para WhatsApp o SMS (≤500 chars), tono claro y respetuoso.",
      "Usa solo el estado del pedido y el total guardado. No inventes fechas de entrega ni pagos cobrados.",
      "Pagas al recibir. Nadie cobra en la tienda web. No menciones Dropi ni OpenAI.",
      "Esto es un borrador: un humano lo copia; no se envía solo.",
    ].join(" ");

    const completion = await chatJsonCompletion({
      system,
      user: JSON.stringify({
        firstName: firstName.length >= 2 ? firstName : null,
        number: order.number,
        status: order.status,
        statusLabel: STATUS_LABEL[order.status],
        collected: order.collected,
        totalLabel: formatCop(order.total),
        city: order.city,
        template: template.text,
        hasCustomerReason: Boolean(order.customerReason?.trim()),
      }),
      maxTokens: 280,
    });

    if (!completion.ok) {
      rememberCustomerDraft(template);
      return template;
    }

    const message = parseOpenAICustomerDraft(completion.text);
    if (!message) {
      rememberCustomerDraft(template);
      return template;
    }

    const draft: CustomerMessageDraft = {
      orderNumber: order.number,
      text: message,
      via: "openai",
      costEstimateCop: completion.costEstimateCop,
    };
    rememberCustomerDraft(draft);
    return draft;
  } catch {
    rememberCustomerDraft(template);
    return template;
  }
}
