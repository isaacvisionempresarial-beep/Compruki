import { STATUS_LABEL, type OrderStatus } from "@/lib/demo-data";
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
