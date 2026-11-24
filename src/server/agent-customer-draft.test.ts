import { describe, expect, it } from "vitest";
import {
  buildCustomerMessageTemplate,
  clearCustomerDraftCache,
  getCustomerDraftPreview,
  parseOpenAICustomerDraft,
  rememberCustomerDraft,
  type CustomerMessageDraft,
} from "@/server/agent-customer-draft";
import type { StoreOrder } from "@/lib/store-order";

const order = {
  id: "1",
  number: "PED-1001",
  idempotencyKey: "k",
  viewToken: "t",
  status: "confirmado",
  collected: false,
  createdAt: "2026-11-24T12:00:00.000Z",
  customerName: "Ana Ríos",
  phone: "3001234567",
  city: "Bogotá",
  address: "Calle 1",
  reference: "",
  lines: [],
  total: 80_000,
  payment: "contra_entrega",
  history: [],
} as StoreOrder;

describe("buildCustomerMessageTemplate", () => {
  it("usa el mensaje de ficha", () => {
    const draft = buildCustomerMessageTemplate(order);
    expect(draft.via).toBe("plantilla");
    expect(draft.text).toContain("PED-1001");
    expect(draft.text.toLowerCase()).toContain("hola");
  });
});

describe("parseOpenAICustomerDraft", () => {
  it("limpia Dropi/OpenAI", () => {
    expect(
      parseOpenAICustomerDraft(JSON.stringify({ message: "Hola Ana. Tu pedido Dropi va bien OpenAI." })),
    ).toBe("Hola Ana. Tu pedido va bien .");
  });

  it("rechaza vacío", () => {
    expect(parseOpenAICustomerDraft(JSON.stringify({ message: "corto" }))).toBeNull();
  });
});

describe("cache borrador cliente", () => {
  it("recuerda el borrador tras Generar", () => {
    clearCustomerDraftCache();
    const draft: CustomerMessageDraft = {
      orderNumber: "PED-1001",
      text: "Hola Ana. Tu pedido PED-1001 está confirmado.",
      via: "openai",
      costEstimateCop: 4,
    };
    rememberCustomerDraft(draft);
    expect(getCustomerDraftPreview("PED-1001")?.via).toBe("openai");
    clearCustomerDraftCache();
    expect(getCustomerDraftPreview("PED-1001")).toBeNull();
  });
});
