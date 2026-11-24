import { describe, expect, it } from "vitest";
import {
  buildCampaignDraftTemplate,
  clearCampaignDraftCache,
  getCampaignDraftPreview,
  parseOpenAICampaignDraft,
  rememberCampaignDraft,
  type CampaignDraft,
} from "@/server/agent-campaign-draft";
import type { ProductFacts } from "@/server/agent-content";

const facts: ProductFacts = {
  sku: "SKU-01",
  title: "Chaqueta Urban",
  category: "Abrigos",
  price: 120_000,
  priceLabel: "$120.000",
  margin: 40_000,
  published: true,
  available: true,
  variants: ["S", "M"],
  sizeKind: "ropa",
  description: "Chaqueta liviana para ciudad.",
  highlights: "Cierre frontal\nBolsillos laterales",
  externalRef: "",
  brandNotes: [],
};

describe("buildCampaignDraftTemplate", () => {
  it("arma hipótesis y copy sin gastar", () => {
    const draft = buildCampaignDraftTemplate(facts);
    expect(draft.via).toBe("plantilla");
    expect(draft.hypothesis).toContain("SKU-01");
    expect(draft.headline).toContain("Chaqueta");
    expect(draft.budgetNote.toLowerCase()).toContain("no compra");
  });
});

describe("parseOpenAICampaignDraft", () => {
  it("limpia proveedores", () => {
    const parsed = parseOpenAICampaignDraft(
      JSON.stringify({
        hypothesis: "Probar Meta Ads con Dropi stock inventado para Chaqueta Urban.",
        headline: "Chaqueta Urban lista",
        primaryText: "Abrigo liviano a $120.000. Pagas al recibir. OpenAI tip.",
        audienceHint: "Abrigos Colombia",
        budgetNote: "Tope 40 mil. No compras solo.",
        cta: "Ver ficha",
      }),
      facts,
    );
    expect(parsed?.hypothesis).not.toMatch(/Dropi|Meta Ads/i);
    expect(parsed?.primaryText).not.toMatch(/OpenAI/i);
    expect(parsed?.cta).toBe("Ver ficha");
  });

  it("rechaza vacío", () => {
    expect(parseOpenAICampaignDraft(JSON.stringify({ hypothesis: "x" }), facts)).toBeNull();
  });
});

describe("cache campaña", () => {
  it("recuerda el borrador", () => {
    clearCampaignDraftCache();
    const draft: CampaignDraft = {
      sku: "SKU-01",
      productTitle: "Chaqueta Urban",
      hypothesis: "Probar un anuncio corto sin gastar hasta confirmar tope.",
      headline: "Titular",
      primaryText: "Texto de anuncio de prueba con precio de ficha.",
      audienceHint: "Abrigos Colombia",
      budgetNote: "Tope sugerido: confirma tú.",
      cta: "Ver",
      via: "openai",
      costEstimateCop: 8,
    };
    rememberCampaignDraft(draft);
    expect(getCampaignDraftPreview("sku-01")?.via).toBe("openai");
    clearCampaignDraftCache();
    expect(getCampaignDraftPreview("SKU-01")).toBeNull();
  });
});
