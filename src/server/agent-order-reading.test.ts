import { describe, expect, it } from "vitest";
import {
  buildOrderCifrasReading,
  clearOrderReadingCache,
  getOrderReadingPreview,
  parseOpenAIOrderReading,
  rememberOrderReading,
  type OrderReading,
} from "@/server/agent-order-reading";
import type { StoreOrder } from "@/lib/store-order";

const order = {
  id: "1",
  number: "PED-1001",
  idempotencyKey: "k",
  viewToken: "t",
  status: "confirmado",
  collected: false,
  createdAt: "2026-11-24T12:00:00.000Z",
  customerName: "Ana",
  phone: "3001234567",
  city: "Bogotá",
  department: "Cundinamarca",
  address: "Calle 1",
  reference: "",
  lines: [
    {
      sku: "LAM-MES-01",
      title: "Lámpara",
      unitPrice: 80_000,
      quantity: 1,
      unitCost: 30_000,
    },
  ],
  total: 80_000,
  payment: "contra_entrega",
  history: [],
} as StoreOrder;

describe("buildOrderCifrasReading", () => {
  it("arma bullets sin Dropi", () => {
    const reading = buildOrderCifrasReading(order);
    expect(reading.via).toBe("cifras");
    expect(reading.bullets[0]).toContain("PED-1001");
    expect(reading.bullets.join(" ")).not.toMatch(/OpenAI/i);
  });
});

describe("parseOpenAIOrderReading", () => {
  it("limpia proveedores y limita", () => {
    const bullets = parseOpenAIOrderReading(
      JSON.stringify({ bullets: ["Pedido listo Dropi", "Sin cobro OpenAI", ""] }),
    );
    expect(bullets).toEqual(["Pedido listo", "Sin cobro"]);
  });

  it("devuelve null si no hay bullets", () => {
    expect(parseOpenAIOrderReading(JSON.stringify({ bullets: [] }))).toBeNull();
  });
});

describe("cache lectura pedido", () => {
  it("recuerda la lectura tras Leer pedido", () => {
    clearOrderReadingCache();
    const reading: OrderReading = {
      orderNumber: "PED-1001",
      bullets: ["ok"],
      via: "openai",
      costEstimateCop: 5,
    };
    rememberOrderReading(reading);
    expect(getOrderReadingPreview("PED-1001")?.via).toBe("openai");
    clearOrderReadingCache();
    expect(getOrderReadingPreview("PED-1001")).toBeNull();
  });
});
