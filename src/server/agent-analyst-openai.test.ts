import { describe, expect, it } from "vitest";
import {
  buildCifrasReading,
  clearAnalystReadingCache,
  getAnalystReadingPreview,
  parseOpenAIAnalystReading,
  rememberAnalystReading,
  type MarginBreakdown,
  type OrderFinancials,
  type ProductScenarios,
} from "@/server/agent-tools";

const orders: OrderFinancials = {
  orderCount: 2,
  lineCount: 3,
  revenue: 100_000,
  estimatedCost: 40_000,
  estimatedShipping: 10_000,
  estimatedCommissions: 5_000,
  estimatedMargin: 45_000,
  missingCostLines: 1,
};

const margins: MarginBreakdown[] = [
  {
    sku: "LAM-MES-01",
    title: "Lámpara",
    price: 80_000,
    cost: 30_000,
    shipping: 8_000,
    commissions: 4_000,
    margin: 38_000,
    marginRate: 0.475,
    published: true,
    available: true,
  },
];

const scenarios: ProductScenarios[] = [
  {
    sku: "LAM-MES-01",
    title: "Lámpara",
    base: margins[0],
    scenarios: [
      { label: "Precio −10 %", price: 72_000, margin: 30_000, marginRate: null },
      { label: "Precio actual", price: 80_000, margin: 38_000, marginRate: null },
      { label: "Precio +10 %", price: 88_000, margin: 46_000, marginRate: null },
    ],
  },
];

describe("buildCifrasReading", () => {
  it("arma bullets de un SKU", () => {
    const reading = buildCifrasReading(margins, scenarios, orders, "LAM-MES-01");
    expect(reading.via).toBe("cifras");
    expect(reading.costEstimateCop).toBe(0);
    expect(reading.bullets[0]).toContain("LAM-MES-01");
    expect(reading.bullets.some((line) => line.includes("Pedidos"))).toBe(true);
  });

  it("avisa si el SKU no existe", () => {
    const reading = buildCifrasReading([], [], orders, "NO-EXISTE");
    expect(reading.bullets[0]).toContain("no está en el catálogo");
  });
});

describe("parseOpenAIAnalystReading", () => {
  it("limpia Dropi/OpenAI y limita bullets", () => {
    const bullets = parseOpenAIAnalystReading(
      JSON.stringify({
        bullets: ["Margen Dropi alto", "Pedidos con OpenAI ok", "", 12],
      }),
    );
    expect(bullets).toEqual(["Margen alto", "Pedidos con ok"]);
  });

  it("devuelve null si no hay bullets útiles", () => {
    expect(parseOpenAIAnalystReading(JSON.stringify({ bullets: [] }))).toBeNull();
    expect(parseOpenAIAnalystReading("no-json")).toBeNull();
  });
});

describe("cache de lectura Analista", () => {
  it("recuerda la lectura openai sin regenerar", () => {
    clearAnalystReadingCache();
    rememberAnalystReading({
      focusSku: "LAM-MES-01",
      bullets: ["ok"],
      via: "openai",
      costEstimateCop: 9,
    });
    expect(getAnalystReadingPreview("LAM-MES-01")?.via).toBe("openai");
    expect(getAnalystReadingPreview("LAM-MES-01")?.costEstimateCop).toBe(9);
    clearAnalystReadingCache();
    expect(getAnalystReadingPreview("LAM-MES-01")).toBeNull();
  });
});
