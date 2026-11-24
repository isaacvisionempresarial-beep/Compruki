import { describe, expect, it } from "vitest";
import {
  buildFollowupPriorityTemplate,
  clearFollowupPriorityCache,
  getFollowupPriorityPreview,
  parseOpenAIFollowupPriority,
  rememberFollowupPriority,
  type FollowupPriority,
} from "@/server/agent-followup-priority";
import type { StoreOrder } from "@/lib/store-order";

const orders = [
  {
    id: "1",
    number: "PED-1001",
    idempotencyKey: "k",
    viewToken: "t",
    status: "incidencia",
    collected: false,
    createdAt: "2026-11-24T12:00:00.000Z",
    customerName: "Ana",
    phone: "3001234567",
    city: "Bogotá",
    address: "Calle 1",
    reference: "",
    lines: [],
    total: 80_000,
    payment: "contra_entrega",
    history: [],
  },
  {
    id: "2",
    number: "PED-1002",
    idempotencyKey: "k2",
    viewToken: "t2",
    status: "entregado",
    collected: true,
    createdAt: "2026-11-20T12:00:00.000Z",
    customerName: "Luis",
    phone: "3019998877",
    city: "Medellín",
    address: "Calle 2",
    reference: "",
    lines: [],
    total: 40_000,
    payment: "contra_entrega",
    history: [],
  },
] as StoreOrder[];

describe("buildFollowupPriorityTemplate", () => {
  it("sugiere incidencia", () => {
    const pack = buildFollowupPriorityTemplate(orders);
    expect(pack.via).toBe("plantilla");
    expect(pack.suggestions.some((item) => item.orderNumber === "PED-1001")).toBe(true);
  });
});

describe("parseOpenAIFollowupPriority", () => {
  it("solo acepta pedidos reales y limpia", () => {
    const parsed = parseOpenAIFollowupPriority(
      JSON.stringify({
        suggestions: [
          { orderNumber: "PED-1001", reason: "Revisar incidencia con Dropi y OpenAI" },
          { orderNumber: "PED-9999", reason: "No existe" },
        ],
      }),
      orders,
    );
    expect(parsed).toHaveLength(1);
    expect(parsed?.[0]?.reason).not.toMatch(/Dropi|OpenAI/i);
  });
});

describe("cache prioridad", () => {
  it("recuerda", () => {
    clearFollowupPriorityCache();
    const pack: FollowupPriority = {
      suggestions: [
        {
          orderNumber: "PED-1001",
          customerName: "Ana",
          phone: "3001234567",
          reason: "Incidencia abierta",
        },
      ],
      via: "openai",
      costEstimateCop: 4,
    };
    rememberFollowupPriority(pack);
    expect(getFollowupPriorityPreview()?.via).toBe("openai");
    clearFollowupPriorityCache();
    expect(getFollowupPriorityPreview()).toBeNull();
  });
});
