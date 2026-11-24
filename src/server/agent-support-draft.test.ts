import { describe, expect, it } from "vitest";
import {
  buildSupportDraftTemplate,
  clearSupportDraftCache,
  getSupportDraftPreview,
  parseOpenAISupportDraft,
  rememberSupportDraft,
  type SupportResolutionDraft,
} from "@/server/agent-support-draft";
import type { StoreOrder } from "@/lib/store-order";

const order = {
  id: "1",
  number: "PED-1001",
  idempotencyKey: "k",
  viewToken: "t",
  status: "incidencia",
  collected: false,
  createdAt: "2026-11-24T12:00:00.000Z",
  customerName: "Ana Ríos",
  phone: "3001234567",
  city: "Bogotá",
  address: "Calle 1",
  reference: "",
  customerReason: "No llegó el paquete",
  lines: [],
  total: 80_000,
  payment: "contra_entrega",
  history: [],
} as StoreOrder;

describe("buildSupportDraftTemplate", () => {
  it("incluye motivo y aviso", () => {
    const draft = buildSupportDraftTemplate(order);
    expect(draft.via).toBe("plantilla");
    expect(draft.bullets[0]).toContain("PED-1001");
    expect(draft.customerNote.toLowerCase()).toContain("hola");
  });
});

describe("parseOpenAISupportDraft", () => {
  it("limpia proveedores", () => {
    const parsed = parseOpenAISupportDraft(
      JSON.stringify({
        bullets: ["Revisar sync Dropi", "Confirmar con cliente"],
        customerNote: "Hola Ana. Estamos con OpenAI revisando tu pedido.",
      }),
    );
    expect(parsed?.bullets[0]).toBe("Revisar sync");
    expect(parsed?.customerNote).toBe("Hola Ana. Estamos con revisando tu pedido.");
  });

  it("rechaza vacío", () => {
    expect(parseOpenAISupportDraft(JSON.stringify({ bullets: [], customerNote: "" }))).toBeNull();
  });
});

describe("cache posventa", () => {
  it("recuerda el borrador", () => {
    clearSupportDraftCache();
    const draft: SupportResolutionDraft = {
      orderNumber: "PED-1001",
      bullets: ["ok"],
      customerNote: "Hola Ana. Estamos revisando tu pedido PED-1001.",
      via: "openai",
      costEstimateCop: 6,
    };
    rememberSupportDraft(draft);
    expect(getSupportDraftPreview("PED-1001")?.via).toBe("openai");
    clearSupportDraftCache();
    expect(getSupportDraftPreview("PED-1001")).toBeNull();
  });
});
