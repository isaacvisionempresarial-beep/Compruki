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
  attentionSheetText,
  closePhrase,
  closeSheetText,
  ordersInSpan,
  dispatchSheetOrders,
  dispatchSheetText,
  widerPeriodWithResults,
  ownerOnlyOrderIntent,
  pendingCheckoutMatch,
  pendingPhoneIsFull,
  resultsByProduct,
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

describe("cierre de pedidos", () => {
  it("recorta las cifras por fecha y deja fuera de la hoja lo que no está en curso", () => {
    const pending = order({
      status: "pendiente_confirmacion",
      number: "P-2001",
      createdAt: "2026-11-18T15:00:00.000Z",
    });
    const moving = order({
      status: "en_preparacion",
      number: "P-2002",
      createdAt: "2026-11-20T15:00:00.000Z",
      providerRef: "DP-10",
    });
    expect(ordersInSpan([pending, moving], "hoy", "2026-11-20").map((item) => item.number)).toEqual(["P-2002"]);
    expect(ordersInSpan([pending, moving], "todo", "2026-11-20")).toHaveLength(2);
    expect(dispatchSheetOrders([pending, moving]).map((item) => item.number)).toEqual(["P-2002"]);
    const sheet = dispatchSheetText([pending, moving]);
    expect(sheet).toContain("Pedido P-2002");
    expect(sheet).toContain("Total guardado");
    expect(sheet).not.toContain("P-2001");
    expect(sheet).not.toContain("secreto-del-cliente");
    expect(sheet).toContain("no crea el pedido en Dropi");
  });

  it("incluye en Hoy un pedido viejo que se movió hoy y conserva su total guardado", () => {
    const moved = order({
      status: "en_preparacion",
      number: "P-2002",
      createdAt: "2026-11-01T15:00:00.000Z",
      providerRef: "DP-10",
      history: [{ id: "evt-1", at: "2026-11-20T18:00:00.000Z", actorName: "Ana", summary: "Pasó el pedido a preparación." }],
    });
    const quiet = order({
      status: "confirmado",
      number: "P-1999",
      createdAt: "2026-11-01T15:00:00.000Z",
      history: [{ id: "evt-2", at: "2026-11-02T18:00:00.000Z", actorName: "Ana", summary: "Confirmó el pedido." }],
    });
    expect(ordersInSpan([moved, quiet], "hoy", "2026-11-20", "creados")).toHaveLength(0);
    expect(ordersInSpan([moved, quiet], "hoy", "2026-11-20", "movidos").map((item) => item.number)).toEqual(["P-2002"]);
    const summary = summarizeStoreOrders(ordersInSpan([moved], "hoy", "2026-11-20", "movidos"));
    expect(summary.confirmed.amount).toBe(moved.total);
    expect(dispatchSheetText(ordersInSpan([moved], "hoy", "2026-11-20", "movidos"))).toContain("Pedido P-2002");
    expect(closePhrase("hoy", "movidos")).toBe("movimientos de hoy");
    expect(closePhrase("7d")).toBe("pedidos creados en los últimos 7 días");
    expect(resultsByProduct(ordersInSpan([moved], "hoy", "2026-11-20", "movidos"))).toHaveLength(1);
    expect(widerPeriodWithResults([moved], "hoy", [], "2026-11-20", "creados")).toBe("30d");
  });

  it("el cierre para copiar usa el total guardado y deja fuera el dato del cliente", () => {
    const pending = order({ status: "pendiente_confirmacion", number: "P-2001" });
    const moving = order({
      status: "en_preparacion",
      number: "P-2002",
      id: "44444444-4444-4444-8444-444444444444",
    });
    const sheet = closeSheetText([pending, moving], "hoy", "creados");
    expect(sheet).toContain("Cierre · pedidos creados hoy");
    expect(sheet).toContain("Registrados: $160.000 · 2 pedidos. P-2002, P-2001.");
    expect(sheet).toContain("Confirmados: $80.000 · 1 pedido. P-2002.");
    expect(sheet).toContain("Cobrados: $0 · 0 pedidos.");
    expect(sheet).toContain("Margen estimado: $30.000. P-2002.");
    expect(sheet).toContain("Faja (SKU-1)");
    expect(sheet).toContain("no se crea el pedido");
    expect(sheet).not.toContain("3001234567");
    expect(sheet).not.toContain("secreto-del-cliente");
    expect(sheet).not.toContain("Calle 10");
    const movedSheet = closeSheetText([moving], "hoy", "movidos");
    expect(movedSheet).toContain("movimientos de hoy");
    expect(movedSheet).toContain("no lo cobrado en ese día");
    const all = closeSheetText([pending, moving], "todo");
    expect(all).toContain("Cierre · todos los pedidos");
    expect(all).toContain("Registrados: $160.000 · 2 pedidos.");
    expect(all).not.toContain("no lo cobrado en ese día");
  });

  it("la cola para copiar nombra el siguiente paso y deja fuera el celular", () => {
    const ready = order({ status: "pendiente_confirmacion", number: "P-2001" });
    const sheet = attentionSheetText([ready], [], true);
    expect(sheet).toContain("Por atender · un pedido, un siguiente paso");
    expect(sheet).toContain("Se pueden confirmar (1)");
    expect(sheet).toContain("P-2001 · Ana Ruiz · Cali · Valle del Cauca");
    expect(sheet).toContain("Siguiente paso: Confirmar.");
    expect(sheet).toContain("no envía el mensaje");
    expect(sheet).not.toContain("3001234567");
    expect(sheet).not.toContain("secreto-del-cliente");
    expect(sheet).not.toContain("Calle 10");
    const held = order({
      status: "pendiente_confirmacion",
      number: "P-2003",
      id: "55555555-5555-4555-8555-555555555555",
      lines: [
        {
          sku: "SKU-1",
          title: "Faja",
          unitPrice: 80_000,
          quantity: 1,
          variant: "",
          unitCost: 40_000,
          unitShipping: 8_000,
          unitCommissions: 2_000,
        },
      ],
    });
    const heldSheet = attentionSheetText([held], [{ sku: "SKU-1", variants: ["M"], sizeKind: "talla" }], false);
    expect(heldSheet).toContain("Falta la talla o el tamaño (1)");
    expect(heldSheet).toContain("Falta la talla de Faja.");
    expect(heldSheet).not.toContain("Se pueden confirmar");
  });
});
