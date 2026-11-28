import { STATUS_LABEL, type OrderStatus } from "@/lib/demo-data";
import {
  followupStageLabel,
  normalizeFollowupStage,
  type FollowupStageId,
} from "@/lib/crm-pipeline";
import { formatCop } from "@/lib/format";
import type { StoreOrder } from "@/lib/store-order";

export type CrmContact = {
  phone: string;
  customerName: string;
  city: string;
  orderCount: number;
  latestOrderNumber: string;
  latestStatus: OrderStatus;
  latestStatusLabel: string;
  latestAt: string;
  openFollowups: number;
};

/** Normaliza teléfono para agrupar contactos de pedidos. */
export function normalizeCrmPhone(phone: string) {
  return phone.replace(/\D/g, "").slice(-10);
}

/**
 * Meta guarda el wa_id con 57 y los pedidos suelen ir en 10 dígitos.
 * Coincide solo cuando ambos quedan en los mismos 10.
 */
export function phonesMatchLast10(left: string, right: string) {
  const a = normalizeCrmPhone(left);
  const b = normalizeCrmPhone(right);
  return a.length === 10 && a === b;
}

export type PhoneOrderChip = {
  number: string;
  statusLabel: string;
  totalLabel: string;
};

/** Pedidos recientes del mismo celular (últimos 10 dígitos), del más nuevo al más viejo. */
export function recentOrdersForPhone(
  orders: Array<Pick<StoreOrder, "number" | "phone" | "status" | "total" | "createdAt">>,
  phone: string,
  limit = 3,
): { shown: PhoneOrderChip[]; extra: number } {
  if (normalizeCrmPhone(phone).length !== 10) return { shown: [], extra: 0 };
  const matched = orders
    .filter((order) => phonesMatchLast10(order.phone, phone))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const shown = matched.slice(0, Math.max(0, limit)).map((order) => ({
    number: order.number,
    statusLabel: STATUS_LABEL[order.status] ?? order.status,
    totalLabel: formatCop(order.total),
  }));
  return { shown, extra: Math.max(0, matched.length - shown.length) };
}

export type PhoneFollowupChip = {
  note: string;
  stageLabel: string;
  dueLabel: string;
  overdue: boolean;
  high: boolean;
  openCount: number;
};

type FollowupChipSource = {
  phone: string;
  note: string;
  stage: string;
  dueAt: string | null;
  priority: string;
  status: string;
  createdAt: string;
};

function followupDueLabel(dueAt: string | null, today: string, overdue: boolean) {
  if (!dueAt) return "";
  const day = dueAt.slice(0, 10);
  if (overdue) return "vencido";
  if (day === today) return "hoy";
  return day.slice(5).replace("-", "/");
}

/** Seguimiento abierto más urgente del celular (vencido → alta → fecha). */
export function openFollowupChipForPhone(
  tasks: FollowupChipSource[],
  phone: string,
  today = new Date().toISOString().slice(0, 10),
): PhoneFollowupChip | null {
  if (normalizeCrmPhone(phone).length !== 10) return null;
  const open = tasks.filter(
    (task) => task.status === "open" && phonesMatchLast10(task.phone, phone),
  );
  if (!open.length) return null;
  const ranked = [...open].sort((a, b) => {
    const aDue = a.dueAt?.slice(0, 10) || "";
    const bDue = b.dueAt?.slice(0, 10) || "";
    const aOver = Boolean(aDue && aDue < today);
    const bOver = Boolean(bDue && bDue < today);
    if (aOver !== bOver) return aOver ? -1 : 1;
    const aHigh = a.priority === "high";
    const bHigh = b.priority === "high";
    if (aHigh !== bHigh) return aHigh ? -1 : 1;
    if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
    if (aDue !== bDue) return aDue ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  const top = ranked[0]!;
  const dueDay = top.dueAt?.slice(0, 10) || "";
  const overdue = Boolean(dueDay && dueDay < today);
  const stage = normalizeFollowupStage(top.stage) as FollowupStageId;
  const note = top.note.trim().replace(/\s+/g, " ");
  return {
    note: note.length > 72 ? `${note.slice(0, 71)}…` : note,
    stageLabel: followupStageLabel(stage),
    dueLabel: followupDueLabel(top.dueAt, today, overdue),
    overdue,
    high: top.priority === "high",
    openCount: open.length,
  };
}

/**
 * Contactos derivados de pedidos (seguimiento del pedido, no difusión).
 * openByPhone: conteo de seguimientos abiertos por teléfono normalizado.
 */
export function buildCrmContacts(
  orders: StoreOrder[],
  openByPhone: Record<string, number> = {},
): CrmContact[] {
  const byPhone = new Map<string, CrmContact>();

  const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const order of sorted) {
    const phone = normalizeCrmPhone(order.phone);
    if (phone.length < 7) continue;
    const existing = byPhone.get(phone);
    if (!existing) {
      byPhone.set(phone, {
        phone,
        customerName: order.customerName.trim() || "Sin nombre",
        city: order.city.trim(),
        orderCount: 1,
        latestOrderNumber: order.number,
        latestStatus: order.status,
        latestStatusLabel: STATUS_LABEL[order.status] ?? order.status,
        latestAt: order.createdAt,
        openFollowups: openByPhone[phone] ?? 0,
      });
      continue;
    }
    existing.orderCount += 1;
    if (order.createdAt > existing.latestAt) {
      existing.latestAt = order.createdAt;
      existing.latestOrderNumber = order.number;
      existing.latestStatus = order.status;
      existing.latestStatusLabel = STATUS_LABEL[order.status] ?? order.status;
      existing.customerName = order.customerName.trim() || existing.customerName;
      existing.city = order.city.trim() || existing.city;
    }
  }

  return [...byPhone.values()].sort((a, b) => {
    if (b.openFollowups !== a.openFollowups) return b.openFollowups - a.openFollowups;
    return b.latestAt.localeCompare(a.latestAt);
  });
}
