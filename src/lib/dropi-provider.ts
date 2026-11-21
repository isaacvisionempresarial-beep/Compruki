export const DROPI_MCP_HOST = "mcp.dropi.co";
export const DROPI_OAUTH_HOST = "oauth.dropi.co";

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

/** Adaptador local. Ningún método llama a Dropi ni devuelve datos inventados. */
export const dropiAdapter = {
  searchProducts: () => blockedDropiAnswer("searchProducts"),
  getProduct: () => blockedDropiAnswer("getProduct"),
  getAvailability: () => blockedDropiAnswer("getAvailability"),
  quoteShipping: () => blockedDropiAnswer("quoteShipping"),
  createOrder: () => blockedDropiAnswer("createOrder"),
  getOrder: () => blockedDropiAnswer("getOrder"),
  listOrders: () => blockedDropiAnswer("listOrders"),
  getOrderStatuses: () => blockedDropiAnswer("getOrderStatuses"),
};

export type DropiQueuedJob = {
  orderId: string;
  orderNumber: string;
  status: "bloqueado" | "conciliado";
  detail: string;
};

export type DropiConnectionState = {
  tableReady: boolean;
  status: "sin_autorizacion";
  passwordStored: false;
  tokenStored: false;
  appRegistered: false;
  detail: string;
};

export type DropiQueueSnapshot = {
  connection: DropiConnectionState;
  jobs: DropiQueuedJob[];
};

export type DropiEnqueueState = { error: string | null; message: string | null };

export function emptyDropiQueue(detail: string): DropiQueueSnapshot {
  return {
    connection: {
      tableReady: false,
      status: "sin_autorizacion",
      passwordStored: false,
      tokenStored: false,
      appRegistered: false,
      detail,
    },
    jobs: [],
  };
}

export function officialDropiHost(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.host.toLowerCase();
    if (host !== "dropi.co" && !host.endsWith(".dropi.co")) return null;
    return host;
  } catch {
    return null;
  }
}
