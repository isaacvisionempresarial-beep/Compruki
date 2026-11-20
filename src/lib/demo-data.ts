import { formatDay } from "@/lib/format";

export const REFERENCE_DATE = "2026-11-02";
export const REFERENCE_LABEL = "2 de noviembre de 2026";

export type OrderStatus =
  | "pendiente_confirmacion"
  | "confirmado"
  | "en_preparacion"
  | "en_transporte"
  | "entregado"
  | "devuelto"
  | "incidencia"
  | "cancelado";

export type DemoOrder = {
  id: string;
  number: string;
  customer: string;
  city: string;
  placedAt: string;
  status: OrderStatus;
  collected: boolean;
  product: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  shipping: number;
  commissions: number;
  attention: string | null;
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente_confirmacion: "Pendiente de confirmación",
  confirmado: "Confirmado",
  en_preparacion: "En preparación",
  en_transporte: "En transporte",
  entregado: "Entregado",
  devuelto: "Devuelto",
  incidencia: "Incidencia",
  cancelado: "Cancelado",
};

export const STATUS_SEQUENCE: OrderStatus[] = [
  "pendiente_confirmacion",
  "confirmado",
  "en_preparacion",
  "en_transporte",
  "entregado",
  "devuelto",
  "incidencia",
  "cancelado",
];

const CONFIRMED: OrderStatus[] = ["confirmado", "en_preparacion", "en_transporte", "entregado"];

export type Period = "hoy" | "7d" | "30d";

export const PERIODS: { id: Period; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
];

/** Pedidos ficticios de muestra. Vacío: las pruebas salen de pedidos reales de la tienda. */
export const ORDERS: DemoOrder[] = [];

export function saleTotal(order: DemoOrder) {
  return order.unitPrice * order.quantity;
}

export function productCost(order: DemoOrder) {
  return order.unitCost * order.quantity;
}

export function estimatedMargin(order: DemoOrder) {
  return saleTotal(order) - productCost(order) - order.shipping - order.commissions;
}

export function daysBeforeReference(iso: string) {
  const reference = Date.parse(`${REFERENCE_DATE}T00:00:00-05:00`);
  const current = Date.parse(`${iso}T00:00:00-05:00`);
  return Math.round((reference - current) / 86_400_000);
}

export function relativeDay(iso: string) {
  const days = daysBeforeReference(iso);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

export function ordersInPeriod(period: Period) {
  const maxDays = period === "hoy" ? 0 : period === "7d" ? 6 : 29;
  return ORDERS.filter((order) => {
    const days = daysBeforeReference(order.placedAt);
    return days >= 0 && days <= maxDays;
  }).sort((a, b) => b.placedAt.localeCompare(a.placedAt) || b.number.localeCompare(a.number));
}

function sumSales(orders: DemoOrder[]) {
  return orders.reduce((sum, order) => sum + saleTotal(order), 0);
}

export function summarize(orders: DemoOrder[]) {
  const active = orders.filter((order) => order.status !== "cancelado");
  const confirmed = active.filter((order) => CONFIRMED.includes(order.status));
  const delivered = active.filter((order) => order.status === "entregado");
  const collected = delivered.filter((order) => order.collected);

  return {
    registered: { count: active.length, amount: sumSales(active) },
    confirmed: { count: confirmed.length, amount: sumSales(confirmed) },
    delivered: { count: delivered.length, amount: sumSales(delivered) },
    collected: { count: collected.length, amount: sumSales(collected) },
    estimatedMargin: confirmed.reduce((sum, order) => sum + estimatedMargin(order), 0),
    realized: collected.reduce((sum, order) => sum + estimatedMargin(order), 0),
    attention: active.filter((order) => order.attention),
  };
}

export function countByStatus(orders: DemoOrder[]) {
  return STATUS_SEQUENCE.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    count: orders.filter((order) => order.status === status).length,
  }));
}

export function salesNote(order: DemoOrder) {
  if (order.status === "cancelado") {
    return "Está cancelado, así que no suma en las ventas del período.";
  }
  if (order.status === "incidencia") {
    return "Tiene una incidencia. Sigue registrado, pero no suma como venta confirmada hasta resolverla.";
  }
  if (order.status === "pendiente_confirmacion") {
    return "Sigue registrado. Entra a ventas confirmadas cuando lo confirmes.";
  }
  if (order.status === "entregado" && order.collected) {
    return "Entregado y marcado como cobrado. La utilidad realizada no es el margen estimado si el flete o el recaudo real son distintos. No es dinero cobrado en el sitio.";
  }
  if (order.status === "entregado") {
    return "Entregado, con recaudo pendiente. Suma como entrega, no como venta cobrada.";
  }
  return "Confirmado. Suma en ventas confirmadas. La utilidad realizada espera la entrega y el cobro.";
}

export function orderWhen(order: DemoOrder) {
  return `${relativeDay(order.placedAt)} · ${formatDay(order.placedAt)}`;
}
