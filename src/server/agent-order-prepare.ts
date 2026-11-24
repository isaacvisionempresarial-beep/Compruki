import { STATUS_LABEL } from "@/lib/demo-data";
import { formatCop } from "@/lib/format";
import {
  dropiHandoffText,
  needsDepartment,
  needsSize,
  prepareDropiError,
  readyToPrepare,
  type SizeGuide,
  type StoreOrder,
} from "@/lib/store-order";
import { listOrders } from "@/server/order-store";

export type OrderPrepareSource = "plantilla" | "openai";

export type OrderPreparePack = {
  orderNumber: string;
  ready: boolean;
  blockers: string[];
  checklist: string[];
  handoffText: string;
  via: OrderPrepareSource;
  costEstimateCop: number;
};

const prepareCache = new Map<string, OrderPreparePack>();

export function rememberOrderPrepare(pack: OrderPreparePack) {
  prepareCache.set(pack.orderNumber.toUpperCase(), pack);
}

export function getOrderPreparePreview(orderNumber: string): OrderPreparePack | null {
  return prepareCache.get(orderNumber.trim().toUpperCase()) ?? null;
}

/** Solo tests. */
export function clearOrderPrepareCache() {
  prepareCache.clear();
}

function scrub(text: string) {
  return text
    .replace(/\bDropi\b/gi, "sincronización")
    .replace(/\bOpenAI\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function localBlockers(order: StoreOrder, sizeGuides: SizeGuide[] = []): string[] {
  const blockers: string[] = [];
  const dropiErr = prepareDropiError(order);
  if (dropiErr) blockers.push(scrub(dropiErr));
  if (needsDepartment(order)) blockers.push("Falta el departamento en la entrega.");
  if (needsSize(order, sizeGuides)) blockers.push("Falta talla o tamaño en alguna línea.");
  if (order.lines.length === 0) blockers.push("El pedido no tiene líneas de producto.");
  if (["cancelado", "devuelto"].includes(order.status)) {
    blockers.push(`Estado «${STATUS_LABEL[order.status] ?? order.status}»: no se prepara envío.`);
  }
  return blockers;
}

function localChecklist(order: StoreOrder, blockers: string[]): string[] {
  const status = STATUS_LABEL[order.status] ?? order.status;
  const items = [
    `${order.number} · estado «${status}» · total guardado ${formatCop(order.total)}.`,
    order.providerRef?.trim()
      ? "Número de sincronización anotado: listo para copiar el paquete a mano."
      : "Sin número de sincronización: anótalo en Sync antes de preparar si aplica.",
    `Entrega: ${order.customerName} · ${order.city}${order.department ? ` · ${order.department}` : ""}.`,
    `${order.lines.length} línea${order.lines.length === 1 ? "" : "s"} · pago contra entrega.`,
  ];
  if (readyToPrepare(order) && blockers.length === 0) {
    items.push("Listo para pasar a preparación a mano. Generar este paquete no cambia el estado ni crea el pedido en el proveedor.");
  } else if (blockers.length > 0) {
    items.push("Hay bloqueos: resuélvelos antes de marcar preparación.");
  } else {
    items.push("Revisa el estado y la entrega; este paquete es solo borrador interno.");
  }
  return items;
}

/** Plantilla local sin modelo. */
export function buildOrderPrepareTemplate(order: StoreOrder, sizeGuides: SizeGuide[] = []): OrderPreparePack {
  const blockers = localBlockers(order, sizeGuides);
  return {
    orderNumber: order.number,
    ready: blockers.length === 0 && (readyToPrepare(order) || order.status === "confirmado"),
    blockers,
    checklist: localChecklist(order, blockers),
    handoffText: dropiHandoffText(order),
    via: "plantilla",
    costEstimateCop: 0,
  };
}

/** Interpreta JSON de preparación AG-06. */
export function parseOpenAIOrderPrepare(
  raw: string,
): { checklist: string[]; blockers: string[] } | null {
  try {
    const data = JSON.parse(raw) as { checklist?: unknown; blockers?: unknown };
    const checklist = Array.isArray(data.checklist)
      ? data.checklist
          .map((item) => (typeof item === "string" ? scrub(item).slice(0, 220) : ""))
          .filter(Boolean)
          .slice(0, 5)
      : [];
    const blockers = Array.isArray(data.blockers)
      ? data.blockers
          .map((item) => (typeof item === "string" ? scrub(item).slice(0, 180) : ""))
          .filter(Boolean)
          .slice(0, 4)
      : [];
    if (checklist.length < 2) return null;
    return { checklist, blockers };
  } catch {
    return null;
  }
}

/**
 * AG-06 · preparar paquete de envío / sync (borrador).
 * No cambia el estado del pedido ni envía al proveedor.
 */
export async function generateOrderPrepare(orderNumber: string): Promise<OrderPreparePack | null> {
  const needle = orderNumber.trim();
  if (!needle) return null;
  const order = (await listOrders()).find((item) => item.number === needle || item.number === decodeURIComponent(needle));
  if (!order) return null;

  const { listSizeGuides } = await import("@/server/catalog-store");
  const sizeGuides = await listSizeGuides();
  const template = buildOrderPrepareTemplate(order, sizeGuides);

  const { openAIKeyConfigured } = await import("@/server/openai-client");
  if (!openAIKeyConfigured()) {
    rememberOrderPrepare(template);
    return template;
  }

  try {
    const { chatJsonCompletion } = await import("@/server/openai-client");
    const system = [
      "Eres AG-06 Gestor de Pedidos de COMPRUKI (panel dueño, Colombia).",
      "Devuelve SOLO JSON: {checklist:string[], blockers:string[]}.",
      "checklist: 2 a 5 pasos internos para preparar el envío/sync a mano.",
      "blockers: 0 a 4 bloqueos reales según los datos; vacío si no hay.",
      "No inventes números de guía ni digas que enviaste al proveedor.",
      "Español colombiano. No menciones Dropi ni OpenAI por nombre.",
      "Generar el paquete no cambia el estado ni crea el pedido afuera.",
    ].join(" ");

    const completion = await chatJsonCompletion({
      system,
      user: JSON.stringify({
        number: order.number,
        status: order.status,
        statusLabel: STATUS_LABEL[order.status],
        totalLabel: formatCop(order.total),
        hasProviderRef: Boolean(order.providerRef?.trim()),
        city: order.city,
        department: order.department ?? null,
        lineCount: order.lines.length,
        localBlockers: template.blockers,
        readyToPrepare: readyToPrepare(order),
      }),
      maxTokens: 550,
    });

    if (!completion.ok) {
      rememberOrderPrepare(template);
      return template;
    }

    const parsed = parseOpenAIOrderPrepare(completion.text);
    if (!parsed) {
      rememberOrderPrepare(template);
      return template;
    }

    const pack: OrderPreparePack = {
      orderNumber: order.number,
      ready: (parsed.blockers.length === 0 ? template.blockers : parsed.blockers).length === 0,
      blockers: parsed.blockers.length > 0 ? parsed.blockers : template.blockers,
      checklist: parsed.checklist,
      handoffText: template.handoffText,
      via: "openai",
      costEstimateCop: completion.costEstimateCop,
    };
    rememberOrderPrepare(pack);
    return pack;
  } catch {
    rememberOrderPrepare(template);
    return template;
  }
}
