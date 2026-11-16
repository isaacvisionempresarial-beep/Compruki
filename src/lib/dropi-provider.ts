export const DROPI_CAPABILITIES = [
  { id: "searchProducts", label: "Buscar productos" },
  { id: "getProduct", label: "Ver un producto" },
  { id: "getAvailability", label: "Ver disponibilidad" },
  { id: "quoteShipping", label: "Cotizar un envío" },
  { id: "createOrder", label: "Crear una orden" },
  { id: "getOrder", label: "Ver una orden" },
  { id: "listOrders", label: "Listar órdenes" },
  { id: "getOrderStatuses", label: "Ver estados" },
] as const;

export type DropiCapabilityId = (typeof DROPI_CAPABILITIES)[number]["id"];

export type DropiBlock = {
  capability: DropiCapabilityId;
  ok: false;
  reason: "sin_autorizacion";
  detail: string;
};

export function blockedDropiAnswer(capability: DropiCapabilityId): DropiBlock {
  return {
    capability,
    ok: false,
    reason: "sin_autorizacion",
    detail:
      capability === "createOrder"
        ? "Dropi no está conectado. Bloqueada: no crea una orden ahí."
        : "Dropi no está conectado. Bloqueada: no se consulta y no se inventan datos.",
  };
}
