/** Capacidades del panel (roles parametrizables). */

export const PANEL_PERMISSION_KEYS = [
  "orders_money",
  "catalog_manage",
  "agents_manage",
  "store_settings",
  "users_manage",
  "backups",
  "whatsapp_manage",
] as const;

export type PanelPermission = (typeof PANEL_PERMISSION_KEYS)[number];

export type PanelPermissions = Record<PanelPermission, boolean>;

export const PANEL_PERMISSION_META: Array<{
  key: PanelPermission;
  label: string;
  hint: string;
}> = [
  { key: "orders_money", label: "Dinero en pedidos", hint: "Flete, costo y marca de cobro." },
  { key: "catalog_manage", label: "Catálogo crítico", hint: "Precios, alta, baja y publicación." },
  { key: "agents_manage", label: "Agentes", hint: "Aprobar borradores, presupuestos y OpenAI." },
  { key: "store_settings", label: "Ajustes de tienda", hint: "Identidad y configuración sensible." },
  { key: "users_manage", label: "Usuarios y roles", hint: "Invitar, quitar y parametrizar roles." },
  { key: "backups", label: "Respaldos", hint: "Descargar pedidos y fichas." },
  { key: "whatsapp_manage", label: "WhatsApp", hint: "Verificar Meta y enviar desde el panel." },
];

export function emptyPermissions(value = false): PanelPermissions {
  return {
    orders_money: value,
    catalog_manage: value,
    agents_manage: value,
    store_settings: value,
    users_manage: value,
    backups: value,
    whatsapp_manage: value,
  };
}

export function normalizePermissions(raw: unknown): PanelPermissions {
  const base = emptyPermissions(false);
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const key of PANEL_PERMISSION_KEYS) {
    base[key] = Boolean(obj[key]);
  }
  return base;
}

export function permissionsForRoleKey(key: string): PanelPermissions {
  if (key === "owner") return emptyPermissions(true);
  if (key === "operator" || key === "atencion") {
    return { ...emptyPermissions(false), whatsapp_manage: true };
  }
  return emptyPermissions(false);
}

export function roleKeyFromLegacy(role: string): "owner" | "operator" {
  return role === "owner" ? "owner" : "operator";
}
