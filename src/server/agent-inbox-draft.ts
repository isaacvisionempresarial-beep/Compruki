import { openAIKeyConfigured } from "@/server/openai-client";
import type { PhoneOrderChip } from "@/lib/crm-contacts";
import type { InboxMessage } from "@/server/whatsapp-inbox";

export type InboxReplyDraft = {
  text: string;
  via: "plantilla" | "openai";
};

function scrub(text: string) {
  return text
    .replace(/\bDropi\b/gi, "")
    .replace(/\bOpenAI\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstNameFrom(contactName: string) {
  const first = contactName.trim().split(/\s+/).filter(Boolean)[0] || "";
  if (!first || /^\d+$/.test(first) || /^57\d+$/.test(first)) return "";
  return first;
}

/** Borrador local sin OpenAI (siempre disponible). */
export function buildInboxReplyTemplate(input: {
  contactName: string;
  messages: InboxMessage[];
  orders: PhoneOrderChip[];
}): InboxReplyDraft {
  const hello = firstNameFrom(input.contactName);
  const greet = hello ? `Hola ${hello}.` : "Hola.";
  const lastInbound = [...input.messages].reverse().find((msg) => msg.direction === "inbound");
  const order = input.orders[0];
  let text: string;
  if (order) {
    text = `${greet} Sobre tu pedido ${order.number} (${order.statusLabel}, ${order.totalLabel}): ¿en qué te ayudo?`;
  } else if (lastInbound?.body?.trim()) {
    const snippet = lastInbound.body.trim().slice(0, 80);
    text = `${greet} Gracias por escribirnos. Recibí tu mensaje («${snippet}»). ¿Me confirmas ciudad y qué necesitas?`;
  } else {
    text = `${greet} Gracias por escribirnos a Compruki. ¿En qué te ayudamos?`;
  }
  return { text: scrub(text).slice(0, 500), via: "plantilla" };
}

/**
 * Borrador de respuesta WhatsApp para el Inbox.
 * No envía nada; un humano revisa y envía.
 */
export async function generateInboxReplyDraft(input: {
  contactName: string;
  messages: InboxMessage[];
  orders: PhoneOrderChip[];
}): Promise<InboxReplyDraft> {
  const template = buildInboxReplyTemplate(input);
  if (!openAIKeyConfigured()) return template;

  try {
    const { chatJsonCompletion } = await import("@/server/openai-client");
    const recent = input.messages
      .slice(-8)
      .map((msg) => ({
        dir: msg.direction === "inbound" ? "cliente" : "tienda",
        type: msg.messageType,
        text: msg.body.slice(0, 180),
      }));
    const completion = await chatJsonCompletion({
      system: [
        "Eres asistente de atención WhatsApp de COMPRUKI (Colombia).",
        "Devuelve SOLO JSON: {message:string}.",
        "message: respuesta corta ≤400 chars, tono claro y respetuoso, español de Colombia.",
        "No inventes guías, fechas de entrega, pagos cobrados ni descuentos.",
        "Pago contra entrega. Nadie cobra en la tienda web.",
        "No menciones Dropi, OpenAI ni que eres una IA.",
        "Esto es un borrador: un humano lo revisa y envía.",
      ].join(" "),
      user: JSON.stringify({
        firstName: firstNameFrom(input.contactName) || null,
        orders: input.orders.slice(0, 3),
        recent,
        template: template.text,
      }),
      maxTokens: 400,
    });
    if (!completion.ok) return template;
    const data = JSON.parse(completion.text) as { message?: unknown };
    const message =
      typeof data.message === "string" ? scrub(data.message).slice(0, 500) : "";
    if (message.length < 12) return template;
    return { text: message, via: "openai" };
  } catch {
    return template;
  }
}
