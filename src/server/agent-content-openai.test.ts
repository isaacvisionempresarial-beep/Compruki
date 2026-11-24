import { describe, expect, it } from "vitest";
import { getContentDraftPreview, rememberContentPreview } from "@/server/agent-content";

describe("preview de borradores OpenAI", () => {
  it("recuerda la generación openai sin volver a llamar al modelo", async () => {
    const facts = {
      sku: "AUD-INAL-01",
      title: "Audífonos inalámbricos",
      category: "Tecnología",
      price: 129000,
      priceLabel: "$129.000",
      margin: 1,
      published: true,
      available: true,
      variants: [] as string[],
      sizeKind: null as null,
      description: "Audífonos con estuche.",
      highlights: "",
      externalRef: "",
      brandNotes: ["Marca de trabajo COMPRUKI."],
    };

    rememberContentPreview(facts.sku, {
      facts,
      via: "openai",
      costEstimateCop: 12,
      drafts: [
        {
          channel: "ficha",
          title: facts.title,
          body: `Precio ${facts.priceLabel}. Pagas al recibir.`,
          cta: "Ver producto",
          source: "openai",
        },
        {
          channel: "anuncio",
          title: `${facts.title} · ${facts.priceLabel}`,
          body: `Oferta ${facts.priceLabel}`,
          cta: "Pedir ahora",
          source: "openai",
        },
        {
          channel: "whatsapp",
          title: `Consulta ${facts.sku}`,
          body: `Hola por ${facts.title}`,
          cta: "Quiero pedirlo",
          source: "openai",
        },
      ],
    });

    const preview = await getContentDraftPreview(facts.sku);
    expect(preview?.via).toBe("openai");
    expect(preview?.drafts).toHaveLength(3);
    expect(preview?.costEstimateCop).toBe(12);
    expect(preview?.drafts.every((draft) => draft.source === "openai")).toBe(true);
  });
});
