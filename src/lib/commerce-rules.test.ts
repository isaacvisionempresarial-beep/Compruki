import { describe, expect, it } from "vitest";
import { catalogToBackupCsv, ordersToBackupCsv } from "@/lib/commerce-backup";
import { foreignIds } from "@/lib/tenant-scope";
import {
  actionsFor,
  applyOrderAction,
  nextOrderNumber,
  orderMargin,
  orderRealizedMargin,
  orderTotal,
  ownerOnlyOrderIntent,
  pendingCheckoutMatch,
  pendingPhoneIsFull,
  summarizeStoreOrders,
  validateCheckout,
  validateLineEdits,
  type CheckoutInput,
  type StoreOrder,
} from "@/lib/store-order";

function order(partial: Partial<StoreOrder> & Pick<StoreOrder, "status">): StoreOrder {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    number: "P-2001",
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
    viewToken: "secreto-del-cliente",
    collected: false,
    createdAt: "2026-11-20T15:00:00.000Z",
    customerName: "Ana Ruiz",
    phone: "3001234567",
    city: "Cali",
    department: "Valle del Cauca",
    address: "Calle 10 # 20-30",
    reference: "",
    lines: [
      {
        sku: "SKU-1",
        title: "Faja",
        unitPrice: 80_000,
        quantity: 1,
        unitCost: 40_000,
        unitShipping: 8_000,
        unitCommissions: 2_000,
      },
    ],
    total: 80_000,
    payment: "contra_entrega",
    history: [],
    ...partial,
  };
}

function checkout(partial: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    idempotencyKey: "33333333-3333-4333-8333-333333333333",
    customerName: "Ana Ruiz",
    phone: "3001234567",
    document: "",
    city: "Cali",
    department: "Valle",
    address: "Calle 10 # 20-30",
    reference: "",
    accepted: true,
    lines: [{ sku: "SKU-1", quantity: 1, variant: "Negro L" }],
    ...partial,
  };
}

describe("precios y utilidad", () => {
  it("el total es precio por cantidad y la talla no entra en la cuenta", () => {
    expect(orderTotal([{ unitPrice: 80_000, quantity: 2 }])).toBe(160_000);
    const edited = validateLineEdits(
      order({
        status: "pendiente_confirmacion",
        lines: [{ sku: "SKU-1", title: "Faja", unitPrice: 80_000, quantity: 1, variant: "Negro L", sizeKind: "talla" }],
      }),
      [{ sku: "SKU-1", variant: "Negro L", nextVariant: "Beige Xl", quantity: 2 }],
      () => ({ variants: ["Negro L", "Beige Xl"], sizeKind: "talla" }),
    );
    expect(edited.error).toBeNull();
    expect(edited.lines?.[0]?.unitPrice).toBe(80_000);
    expect(orderTotal(edited.lines ?? [])).toBe(160_000);
  });

  it("separa el total cobrado de la utilidad y resta el flete de devolución", () => {
    const collected = order({ status: "entregado", collected: true, number: "P-2002" });
    const returned = order({
      status: "devuelto",
      number: "P-2003",
      returnFreight: 5_000,
      lines: [{ sku: "SKU-1", title: "Faja", unitPrice: 80_000, quantity: 1 }],
    });
    const summary = summarizeStoreOrders([collected, returned]);

    expect(orderRealizedMargin(collected)).toBe(30_000);
    expect(summary.collected.amount).toBe(80_000);
    expect(summary.realized.amount).toBe(25_000);
    expect(summary.estimatedMargin.amount).not.toBe(summary.collected.amount);
  });

  it("sin costo no inventa margen", () => {
    const open = order({
      status: "confirmado",
      lines: [{ sku: "SKU-1", title: "Faja", unitPrice: 80_000, quantity: 1 }],
    });
    expect(orderMargin(open)).toBeNull();
    expect(summarizeStoreOrders([open]).estimatedMargin.missing).toBe(1);
  });
});

describe("pedidos y antiabuso", () => {
  it("asigna el siguiente número libre y no reutiliza huecos", () => {
    expect(nextOrderNumber([])).toBe("P-2001");
    expect(nextOrderNumber(["P-2000", "P-2005", "borrador"])).toBe("P-2006");
    expect(nextOrderNumber(["P-999999"])).toBeNull();
  });

  it("deja reabrir el mismo pendiente y frena el cuarto distinto", () => {
    const pending = [
      order({ status: "pendiente_confirmacion", phone: "3001234567" }),
      order({ status: "pendiente_confirmacion", phone: "3001234567", id: "b" }),
      order({ status: "pendiente_confirmacion", phone: "3001234567", id: "c" }),
      order({ status: "confirmado", phone: "3001234567", id: "d" }),
    ];
    expect(pendingPhoneIsFull(pending, "3001234567")).toBe(true);
    expect(pendingPhoneIsFull(pending, "3010000000")).toBe(false);
  });

  it("reconoce el mismo checkout solo dentro de media hora", () => {
    const pending = order({
      status: "pendiente_confirmacion",
      department: "Valle",
      createdAt: "2026-11-20T15:00:00.000Z",
      lines: [{ sku: "SKU-1", title: "Faja", unitPrice: 80_000, quantity: 1, variant: "Negro L" }],
    });
    const input = checkout();
    expect(pendingCheckoutMatch(pending, input, "2026-11-20T15:20:00.000Z")).toBe(true);
    expect(pendingCheckoutMatch(pending, input, "2026-11-20T15:31:00.000Z")).toBe(false);
    expect(pendingCheckoutMatch(pending, checkout({ address: "Otra dirección 123" }), "2026-11-20T15:10:00.000Z")).toBe(false);
  });

  it("rechaza un checkout sin aceptación o con cantidad fuera de rango", () => {
    expect(validateCheckout(checkout({ accepted: false }))).toMatch(/condiciones/);
    expect(validateCheckout(checkout({ lines: [{ sku: "SKU-1", quantity: 6 }] }))).toMatch(/1 a 5/);
  });
});

describe("estados y permisos", () => {
  it("confirmar y cobrar no cambian el total guardado", () => {
    const pending = order({ status: "pendiente_confirmacion" });
    const confirmed = applyOrderAction(pending, "confirmar");
    expect(confirmed.order?.status).toBe("confirmado");
    expect(confirmed.order?.total).toBe(pending.total);
    expect(confirmed.order?.collected).toBe(false);

    const delivered = order({ status: "entregado", providerRef: "DP-10" });
    const paid = applyOrderAction(delivered, "cobrar");
    expect(paid.order?.collected).toBe(true);
    expect(paid.order?.total).toBe(delivered.total);
    expect(applyOrderAction(pending, "cobrar").order).toBeNull();
  });

  it("preparar exige el número anotado y el cobro es solo del propietario", () => {
    const confirmed = order({ status: "confirmado" });
    expect(applyOrderAction(confirmed, "preparar").order).toBeNull();
    expect(applyOrderAction({ ...confirmed, providerRef: "DP-10" }, "preparar").order?.status).toBe("en_preparacion");
    expect(actionsFor(order({ status: "pendiente_confirmacion" })).map((action) => action.id)).toEqual(["confirmar", "cancelar"]);
    expect(ownerOnlyOrderIntent("cobrar")).toBe(true);
    expect(ownerOnlyOrderIntent("confirmar")).toBe(false);
  });
});

describe("aislamiento y respaldo", () => {
  it("rechaza un id de otra tienda y acepta los de la misma", () => {
    expect(foreignIds([{ id: "a", tenant_id: "piloto" }, { id: "b", tenant_id: "otra" }, { id: "c", tenant_id: null }], "piloto")).toEqual(["b", "c"]);
    expect(foreignIds([{ id: "a", tenant_id: "piloto" }], "piloto")).toEqual([]);
  });

  it("la copia de pedidos omite el enlace secreto y no trata el total como utilidad", () => {
    const csv = ordersToBackupCsv([
      order({
        status: "entregado",
        collected: true,
        customerName: "=Ana",
        internalNote: "nota interna",
      }),
    ]);
    expect(csv).toContain("P-2001");
    expect(csv).toContain("80000");
    expect(csv).toContain("30000");
    expect(csv).toContain("'=Ana");
    expect(csv).toContain("nota interna");
    expect(csv).not.toContain("secreto-del-cliente");
    expect(csv).not.toContain("22222222-2222-4222-8222-222222222222");
  });

  it("la copia de fichas guarda el precio publicado y el margen estimado aparte", () => {
    const csv = catalogToBackupCsv([
      {
        sku: "SKU-1",
        title: "Faja",
        price: 80_000,
        cost: 40_000,
        shipping: 8_000,
        commissions: 2_000,
        published: true,
        available: true,
        externalRef: "",
      },
    ]);
    expect(csv).toContain("precio_publicado,costo,envio_estimado,comisiones,margen_estimado");
    expect(csv).toContain("80000,40000,8000,2000,30000");
    expect(csv).toContain("Publicado");
  });
});
