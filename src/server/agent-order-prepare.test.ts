import { describe, expect, it } from "vitest";
import {
  buildOrderPrepareTemplate,
  clearOrderPrepareCache,
  getOrderPreparePreview,
  parseOpenAIOrderPrepare,
  rememberOrderPrepare,
  type OrderPreparePack,
} from "@/server/agent-order-prepare";
import type { StoreOrder } from "@/lib/store-order";

const order = {
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
  providerRef: "DR-99",
  lines: [{ sku: "SKU-1", title: "Chaqueta", quantity: 1, unitPrice: 80_000 }],
  total: 80_000,
  payment: "contra_entrega",
  history: [],
} as StoreOrder;

describe("buildOrderPrepareTemplate", () => {
  it("arma checklist y texto de handoff", () => {
    const pack = buildOrderPrepareTemplate(order);
    expect(pack.via).toBe("plantilla");
    expect(pack.checklist[0]).toContain("PED-2001");
    expect(pack.handoffText).toContain("Ana Ríos");
    expect(pack.blockers).toHaveLength(0);
  });

  it("bloquea sin número de sync en confirmado", () => {
    const pack = buildOrderPrepareTemplate({ ...order, providerRef: "" });
    expect(pack.blockers.length).toBeGreaterThan(0);
  });
});

describe("parseOpenAIOrderPrepare", () => {
  it("limpia proveedores", () => {
    const parsed = parseOpenAIOrderPrepare(
      JSON.stringify({
        checklist: ["Revisar sync Dropi", "Copiar paquete"],
        blockers: ["Falta OpenAI tip"],
      }),
    );
    expect(parsed?.checklist[0]).toContain("sincronización");
    expect(parsed?.blockers[0]).not.toMatch(/OpenAI/i);
  });

  it("rechaza vacío", () => {
    expect(parseOpenAIOrderPrepare(JSON.stringify({ checklist: ["solo"] }))).toBeNull();
  });
});

describe("cache prepare", () => {
  it("recuerda el paquete", () => {
    clearOrderPrepareCache();
    const pack: OrderPreparePack = {
      orderNumber: "PED-2001",
      ready: true,
      blockers: [],
      checklist: ["a", "b"],
      handoffText: "Pedido PED-2001",
      via: "openai",
      costEstimateCop: 5,
    };
    rememberOrderPrepare(pack);
    expect(getOrderPreparePreview("ped-2001")?.via).toBe("openai");
    clearOrderPrepareCache();
    expect(getOrderPreparePreview("PED-2001")).toBeNull();
  });
});
