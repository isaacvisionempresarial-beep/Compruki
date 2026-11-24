import { STATUS_LABEL } from "@/lib/demo-data";
import { formatCop } from "@/lib/format";
import type { StoreOrder } from "@/lib/store-order";
import { listOrders } from "@/server/order-store";

export type OrderReadingSource = "cifras" | "openai";

export type OrderReading = {
  orderNumber: string;
  bullets: string[];
  via: OrderReadingSource;
  costEstimateCop: number;
};

const readingCache = new Map<string, OrderReading>();

export function rememberOrderReading(reading: OrderReading) {
  readingCache.set(reading.orderNumber.toUpperCase(), reading);
}

export function getOrderReadingPreview(orderNumber: string): OrderReading | null {
  return readingCache.get(orderNumber.trim().toUpperCase()) ?? null;
}

/** Solo tests. */
export function clearOrderReadingCache() {
  readingCache.clear();
}

function scrub(text: string) {
  return text
    .replace(/\bDropi\b/gi, "")
    .replace(/\bOpenAI\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lineSummary(order: StoreOrder) {
  return order.lines.map((line) => ({
    sku: line.sku,
    title: line.title,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    variant: line.variant ?? null,
    hasCost: typeof line.unitCost === "number",
  }));
}

/** Lectura determinista del pedido. Sin OpenAI. */
export function buildOrderCifrasReading(order: StoreOrder): OrderReading {
  const status = STATUS_LABEL[order.status] ?? order.status;
  const bullets = [
    `${order.number}: estado ${status}${order.collected ? " · cobro marcado" : ""}. Lectura: no cambia el pedido ni cobra.`,
    `Total guardado ${formatCop(order.total)} · ${order.lines.length} línea${order.lines.length === 1 ? "" : "s"} · ${order.city}${
      order.department ? ` (${order.department})` : ""
    }.`,
  ];
  if (order.providerRef?.trim()) {
    bullets.push(`Hay número de sincronización anotado. Anotarlo no crea el pedido en el proveedor.`);
  } else if (order.status !== "pendiente_confirmacion" && order.status !== "cancelado") {
    bullets.push(`Sin número de sincronización anotado. La sync manual no cambia el total guardado.`);
  }
  const missingCost = order.lines.filter((line) => typeof line.unitCost !== "number").length;
  if (missingCost > 0) {
    bullets.push(`${missingCost} línea${missingCost === 1 ? "" : "s"} sin costo de ficha. El margen estimado no es utilidad realizada.`);
  }
  return {
    orderNumber: order.number,
    bullets,
    via: "cifras",
    costEstimateCop: 0,
  };
}

/** Interpreta JSON de lectura AG-06. */
export function parseOpenAIOrderReading(raw: string): string[] | null {
  try {
    const data = JSON.parse(raw) as { bullets?: unknown };
    if (!Array.isArray(data.bullets)) return null;
    const bullets = data.bullets
      .map((item) => (typeof item === "string" ? scrub(item).slice(0, 220) : ""))
      .filter(Boolean)
      .slice(0, 4);
    return bullets.length >= 1 ? bullets : null;
  } catch {
    return null;
  }
}

/**
 * AG-06 lite · lectura del pedido: OpenAI si responde; si no, cifras locales.
 * No cambia estado, sync ni totales.
 */
export async function generateOrderReading(orderNumber: string): Promise<OrderReading | null> {
  const needle = orderNumber.trim();
  if (!needle) return null;
  const order = (await listOrders()).find((item) => item.number === needle || item.number === decodeURIComponent(needle));
  if (!order) return null;

  const cifras = buildOrderCifrasReading(order);
  const { openAIKeyConfigured } = await import("@/server/openai-client");
  if (!openAIKeyConfigured()) {
    rememberOrderReading(cifras);
    return cifras;
  }

  try {
    const { chatJsonCompletion } = await import("@/server/openai-client");
    const system = [
      "Eres AG-06 Gestor de Pedidos de COMPRUKI (panel dueño, Colombia).",
      "Devuelve SOLO JSON: {bullets: string[]} con 2 a 4 frases cortas.",
      "Usa únicamente los datos del pedido. No inventes sync, pagos ni fechas de entrega.",
      "Recuerda: es lectura; no cambia el pedido ni cobra. El total guardado no es dinero cobrado.",
      "No menciones Dropi, OpenAI ni proveedores. Español colombiano claro.",
      "No repitas teléfono, documento ni dirección completa.",
    ].join(" ");

    const completion = await chatJsonCompletion({
      system,
      user: JSON.stringify({
        number: order.number,
        status: order.status,
        statusLabel: STATUS_LABEL[order.status],
        collected: order.collected,
        total: order.total,
        city: order.city,
        department: order.department ?? null,
        hasProviderRef: Boolean(order.providerRef?.trim()),
        hasCustomerReason: Boolean(order.customerReason?.trim()),
        lineCount: order.lines.length,
        lines: lineSummary(order),
        payment: "contra_entrega",
      }),
      maxTokens: 380,
    });

    if (!completion.ok) {
      rememberOrderReading(cifras);
      return cifras;
    }

    const bullets = parseOpenAIOrderReading(completion.text);
    if (!bullets) {
      rememberOrderReading(cifras);
      return cifras;
    }

    const reading: OrderReading = {
      orderNumber: order.number,
      bullets,
      via: "openai",
      costEstimateCop: completion.costEstimateCop,
    };
    rememberOrderReading(reading);
    return reading;
  } catch {
    rememberOrderReading(cifras);
    return cifras;
  }
}
