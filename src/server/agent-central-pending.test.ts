import { describe, expect, it } from "vitest";
import type { StoreOrder } from "@/lib/store-order";
import { pendingOrderApprovals } from "@/server/agent-central";

const base = {
  id: "1",
  number: "PED-2001",
  idempotencyKey: "k",
  viewToken: "t",
  status: "confirmado",
  collected: false,
  createdAt: "2026-11-24T12:00:00.000Z",
  customerName: "Ana Ríos",
  phone: "3001234567",
  city: "Bogotá",
  department: "Cundinamarca",
  address: "Calle 1",
  reference: "",
  providerRef: "",
  lines: [{ sku: "SKU-1", title: "Chaqueta", quantity: 1, unitPrice: 80_000 }],
  total: 80_000,
  payment: "contra_entrega",
  history: [],
} as StoreOrder;

describe("pendingOrderApprovals", () => {
  it("incluye confirmación e incidencia", () => {
    const items = pendingOrderApprovals([
      { ...base, id: "a", number: "PED-A", status: "pendiente_confirmacion" },
      { ...base, id: "b", number: "PED-B", status: "incidencia" },
    ]);
    expect(items.map((item) => item.label)).toEqual(["PED-A", "PED-B"]);
    expect(items[0]?.href).toContain("pedido-herramientas");
    expect(items[1]?.href).toContain("pedido-posventa");
    expect(items[1]?.detail).toContain("AG-09");
  });

  it("incluye listos para preparar con ancla AG-06", () => {
    const items = pendingOrderApprovals([
      { ...base, id: "c", number: "PED-C", status: "confirmado", providerRef: "DR-1" },
      { ...base, id: "d", number: "PED-D", status: "confirmado", providerRef: "" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe("PED-C");
    expect(items[0]?.id).toBe("prep-c");
    expect(items[0]?.href).toContain("pedido-preparar");
    expect(items[0]?.detail).toContain("AG-06");
  });

  it("incluye despacho, entrega y cobro pendientes", () => {
    const items = pendingOrderApprovals([
      { ...base, id: "e", number: "PED-E", status: "en_preparacion" },
      { ...base, id: "f", number: "PED-F", status: "en_transporte" },
      { ...base, id: "g", number: "PED-G", status: "entregado", collected: false },
      { ...base, id: "h", number: "PED-H", status: "entregado", collected: true },
    ]);
    expect(items.map((item) => item.id)).toEqual(["desp-e", "ent-f", "cob-g"]);
    expect(items.every((item) => item.href?.includes("pedido-herramientas"))).toBe(true);
  });
});
