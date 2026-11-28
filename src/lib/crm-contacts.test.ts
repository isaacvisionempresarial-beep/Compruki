import { describe, expect, it } from "vitest";
import { buildCrmContacts, normalizeCrmPhone, phonesMatchLast10, recentOrdersForPhone } from "@/lib/crm-contacts";
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
    total: partial.total ?? 50_000,
    payment: "contra_entrega",
    history: [],
  } as StoreOrder;
}

describe("normalizeCrmPhone", () => {
  it("deja 10 dígitos", () => {
    expect(normalizeCrmPhone("+57 300 123 4567")).toBe("3001234567");
  });
});

describe("phonesMatchLast10", () => {
  it("iguala el wa_id 57… con el celular de 10 dígitos del pedido", () => {
    expect(phonesMatchLast10("573001234567", "3001234567")).toBe(true);
    expect(phonesMatchLast10("+57 300 123 4567", "300-123-4567")).toBe(true);
    expect(phonesMatchLast10("573001234567", "3001234568")).toBe(false);
  });

  it("no trata un fragmento corto como el celular completo", () => {
    expect(phonesMatchLast10("300", "3001234567")).toBe(false);
    expect(phonesMatchLast10("", "3001234567")).toBe(false);
    expect(phonesMatchLast10("573001234567", "")).toBe(false);
  });
});

describe("recentOrdersForPhone", () => {
  it("devuelve hasta 3 pedidos del mismo celular y cuenta el resto", () => {
    const rows = [1, 2, 3, 4].map((n) =>
      order({
        number: `P-100${n}`,
        phone: n === 4 ? "3010000000" : "3001234567",
        createdAt: `2026-0${n}-01T10:00:00.000Z`,
        status: "confirmado",
        total: 50_000,
      }),
    );
    rows.push(
      order({
        number: "P-2001",
        phone: "573001234567",
        createdAt: "2026-05-01T10:00:00.000Z",
        status: "en_transporte",
        total: 80_000,
      }),
    );
    const result = recentOrdersForPhone(rows, "573001234567");
    expect(result.shown.map((item) => item.number)).toEqual(["P-2001", "P-1003", "P-1002"]);
    expect(result.shown[0]).toMatchObject({ statusLabel: "En transporte", totalLabel: "$80.000" });
    expect(result.extra).toBe(1);
    expect(recentOrdersForPhone(rows, "3010000000").shown).toHaveLength(1);
    expect(recentOrdersForPhone(rows, "3010000000").extra).toBe(0);
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
