import { STATUS_LABEL } from "@/lib/demo-data";
import type { StoreOrder } from "@/lib/store-order";
import { needsBuyerNoteReview, needsCustomerNotice, needsIncidenceReason } from "@/lib/store-order";
import { listOrders } from "@/server/order-store";

export type FollowupPrioritySource = "plantilla" | "openai";

export type FollowupSuggestion = {
  orderNumber: string;
  customerName: string;
  phone: string;
  reason: string;
};

export type FollowupPriority = {
  suggestions: FollowupSuggestion[];
  via: FollowupPrioritySource;
  costEstimateCop: number;
};

let priorityCache: FollowupPriority | null = null;

export function rememberFollowupPriority(pack: FollowupPriority) {
  priorityCache = pack;
}

export function getFollowupPriorityPreview(): FollowupPriority | null {
  return priorityCache;
}

/** Solo tests. */
export function clearFollowupPriorityCache() {
  priorityCache = null;
}

function scrub(text: string) {
  return text
    .replace(/\bDropi\b/gi, "")
    .replace(/\bOpenAI\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function candidates(orders: StoreOrder[]): FollowupSuggestion[] {
  const out: FollowupSuggestion[] = [];
  for (const order of orders) {
    if (["cancelado", "devuelto"].includes(order.status)) continue;
    let reason = "";
    if (needsBuyerNoteReview(order)) {
      reason = "El comprador dejó un aviso sin leer en el pedido.";
    } else if (order.status === "incidencia") {
      reason = needsIncidenceReason(order)
        ? "Incidencia sin motivo anotado: conviene contactar."
        : "Incidencia abierta: avisar avance al cliente.";
    } else if (needsCustomerNotice(order)) {
      reason = "Falta marcar el aviso al cliente tras un cambio.";
    } else if (order.status === "pendiente_confirmacion") {
      reason = "Pendiente de confirmación: verificar datos o interés.";
    } else if (order.status === "entregado" && !order.customerNotifiedAt) {
      reason = "Entregado: seguimiento breve de satisfacción (opcional).";
    }
    if (!reason) continue;
    out.push({
      orderNumber: order.number,
      customerName: order.customerName.trim() || "Sin nombre",
      phone: order.phone,
      reason,
    });
  }
  return out.slice(0, 8);
}

/** Plantilla local sin modelo. */
export function buildFollowupPriorityTemplate(orders: StoreOrder[]): FollowupPriority {
  return {
    suggestions: candidates(orders),
    via: "plantilla",
    costEstimateCop: 0,
  };
}

export function parseOpenAIFollowupPriority(
  raw: string,
  orders: StoreOrder[],
): FollowupSuggestion[] | null {
  try {
    const data = JSON.parse(raw) as { suggestions?: unknown };
    if (!Array.isArray(data.suggestions)) return null;
    const byNumber = new Map(orders.map((order) => [order.number.toUpperCase(), order]));
    const out: FollowupSuggestion[] = [];
    for (const item of data.suggestions) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const number = String(row.orderNumber ?? "").trim().toUpperCase();
      const reason = scrub(String(row.reason ?? "")).slice(0, 180);
      const order = byNumber.get(number);
      if (!order || reason.length < 8) continue;
      out.push({
        orderNumber: order.number,
        customerName: order.customerName.trim() || "Sin nombre",
        phone: order.phone,
        reason,
      });
    }
    return out.length > 0 ? out.slice(0, 8) : null;
  } catch {
    return null;
  }
}

/**
 * AG-07 · priorizar seguimientos (solo sugerencias).
 * No crea tareas ni envía mensajes.
 */
export async function generateFollowupPriority(): Promise<FollowupPriority> {
  const orders = await listOrders();
  const template = buildFollowupPriorityTemplate(orders);

  const { openAIKeyConfigured } = await import("@/server/openai-client");
  if (!openAIKeyConfigured()) {
    rememberFollowupPriority(template);
    return template;
  }

  try {
    const { chatJsonCompletion } = await import("@/server/openai-client");
    const sample = orders
      .filter((order) => !["cancelado"].includes(order.status))
      .slice(0, 24)
      .map((order) => ({
        number: order.number,
        status: order.status,
        statusLabel: STATUS_LABEL[order.status],
        name: order.customerName.trim().slice(0, 40),
        needsNotice: needsCustomerNotice(order),
        buyerNotePending: needsBuyerNoteReview(order),
        incidence: order.status === "incidencia",
      }));

    const system = [
      "Eres AG-07 Gestor de Clientes de COMPRUKI (panel dueño, Colombia).",
      "Devuelve SOLO JSON: {suggestions:[{orderNumber,reason}]}.",
      "Máximo 8. Solo pedidos que merecen seguimiento humano pronto.",
      "reason ≤180 chars. Español colombiano. No menciones Dropi ni OpenAI.",
      "No inventes pedidos. No digas que enviaste WhatsApp.",
    ].join(" ");

    const completion = await chatJsonCompletion({
      system,
      user: JSON.stringify({ orders: sample }),
      maxTokens: 700,
    });

    if (!completion.ok) {
      rememberFollowupPriority(template);
      return template;
    }

    const parsed = parseOpenAIFollowupPriority(completion.text, orders);
    if (!parsed) {
      rememberFollowupPriority(template);
      return template;
    }

    const pack: FollowupPriority = {
      suggestions: parsed,
      via: "openai",
      costEstimateCop: completion.costEstimateCop,
    };
    rememberFollowupPriority(pack);
    return pack;
  } catch {
    rememberFollowupPriority(template);
    return template;
  }
}
