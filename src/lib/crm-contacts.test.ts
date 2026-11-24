import { describe, expect, it } from "vitest";
import { buildCrmContacts, normalizeCrmPhone } from "@/lib/crm-contacts";
import type { StoreOrder } from "@/lib/store-order";

function order(partial: Partial<StoreOrder> & Pick<StoreOrder, "number" | "phone" | "createdAt">): StoreOrder {
  return {
    id: partial.id ?? partial.number,
    number: partial.number,
    idempotencyKey: "k",
    viewToken: "t",
    status: partial.status ?? "confirmado",
    collected: false,
    createdAt: partial.createdAt,
    customerName: partial.customerName ?? "Ana",
    phone: partial.phone,
    city: partial.city ?? "Bogotá",
    address: "Calle 1",
    reference: "",
    lines: [],
    total: 50_000,
    payment: "contra_entrega",
    history: [],
  } as StoreOrder;
}

describe("normalizeCrmPhone", () => {
  it("deja 10 dígitos", () => {
    expect(normalizeCrmPhone("+57 300 123 4567")).toBe("3001234567");
  });
});

describe("buildCrmContacts", () => {
  it("agrupa por teléfono y cuenta seguimientos", () => {
    const contacts = buildCrmContacts(
      [
        order({ number: "PED-1", phone: "3001234567", createdAt: "2026-01-01T10:00:00.000Z", customerName: "Ana" }),
        order({
          number: "PED-2",
          phone: "57 300 123 4567",
          createdAt: "2026-02-01T10:00:00.000Z",
          customerName: "Ana Ríos",
          status: "incidencia",
        }),
        order({ number: "PED-3", phone: "3019998877", createdAt: "2026-01-15T10:00:00.000Z" }),
      ],
      { "3001234567": 2 },
    );
    expect(contacts).toHaveLength(2);
    expect(contacts[0]?.phone).toBe("3001234567");
    expect(contacts[0]?.orderCount).toBe(2);
    expect(contacts[0]?.latestOrderNumber).toBe("PED-2");
    expect(contacts[0]?.openFollowups).toBe(2);
    expect(contacts[0]?.customerName).toBe("Ana Ríos");
  });
});
