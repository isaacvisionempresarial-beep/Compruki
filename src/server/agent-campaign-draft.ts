import { getProductFacts, type ProductFacts } from "@/server/agent-content";

export type CampaignDraftSource = "plantilla" | "openai";

export type CampaignDraft = {
  sku: string;
  productTitle: string;
  hypothesis: string;
  headline: string;
  primaryText: string;
  audienceHint: string;
  budgetNote: string;
  cta: string;
  via: CampaignDraftSource;
  costEstimateCop: number;
};

const draftCache = new Map<string, CampaignDraft>();

export function rememberCampaignDraft(draft: CampaignDraft) {
  draftCache.set(draft.sku.toUpperCase(), draft);
}

export function getCampaignDraftPreview(sku: string): CampaignDraft | null {
  return draftCache.get(sku.trim().toUpperCase()) ?? null;
}

/** Solo tests. */
export function clearCampaignDraftCache() {
  draftCache.clear();
}

function scrub(text: string) {
  return text
    .replace(/\bDropi\b/gi, "")
    .replace(/\bOpenAI\b/gi, "")
    .replace(/\bMeta Ads?\b/gi, "anuncios")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plantilla local: hipótesis y copy sin comprar anuncios. */
export function buildCampaignDraftTemplate(facts: ProductFacts): CampaignDraft {
  const highlight =
    facts.highlights.split(/\n/).map((line) => line.trim()).find(Boolean) ||
    facts.description.split(/\n/).map((line) => line.trim()).find(Boolean) ||
    `${facts.title} en ${facts.category || "catálogo"}.`;

  return {
    sku: facts.sku,
    productTitle: facts.title,
    hypothesis: `Probar un anuncio corto de ${facts.title} (${facts.sku}) a gente que busca ${facts.category || "ese tipo de producto"} en Colombia. Medir clics a la ficha; no gastar hasta que tú confirmes tope.`,
    headline: `${facts.title} · ${facts.priceLabel}`,
    primaryText: [
      highlight.slice(0, 220),
      `Precio de ficha ${facts.priceLabel}. Pagas al recibir. El envío se acuerda aparte.`,
      "Nadie cobra en la tienda web.",
    ].join(" "),
    audienceHint: `Interés aproximado: ${facts.category || "catálogo general"} · Colombia. No es audiencia real de una red; es una pista para que la armes tú.`,
    budgetNote:
      "Tope sugerido de prueba: 50.000 COP. Es solo una nota interna. Generar este borrador no compra anuncios ni reserva presupuesto.",
    cta: "Ver producto",
    via: "plantilla",
    costEstimateCop: 0,
  };
}

/** Interpreta JSON de borrador AG-08. */
export function parseOpenAICampaignDraft(
  raw: string,
  facts: ProductFacts,
): Omit<CampaignDraft, "sku" | "productTitle" | "via" | "costEstimateCop"> | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const hypothesis = scrub(String(data.hypothesis ?? "")).slice(0, 320);
    const headline = scrub(String(data.headline ?? "")).slice(0, 80);
    const primaryText = scrub(String(data.primaryText ?? "")).slice(0, 500);
    const audienceHint = scrub(String(data.audienceHint ?? "")).slice(0, 220);
    const budgetNote = scrub(String(data.budgetNote ?? "")).slice(0, 280);
    const cta = scrub(String(data.cta ?? "")).slice(0, 40);
    if (hypothesis.length < 20 || headline.length < 4 || primaryText.length < 20) return null;
    return {
      hypothesis,
      headline,
      primaryText,
      audienceHint:
        audienceHint.length >= 12
          ? audienceHint
          : `Interés aproximado: ${facts.category || "catálogo"} · Colombia. No es audiencia de red.`,
      budgetNote:
        budgetNote.length >= 12
          ? budgetNote
          : "Tope sugerido de prueba: confirma tú el máximo antes de gastar. Generar no compra anuncios.",
      cta: cta || "Ver producto",
    };
  } catch {
    return null;
  }
}

/**
 * AG-08 lite · borrador de campaña / hipótesis publicitaria.
 * No publica ni compra anuncios.
 */
export async function generateCampaignDraft(sku: string): Promise<CampaignDraft | null> {
  const facts = await getProductFacts(sku);
  if (!facts) return null;

  const template = buildCampaignDraftTemplate(facts);
  const { openAIKeyConfigured } = await import("@/server/openai-client");
  if (!openAIKeyConfigured()) {
    rememberCampaignDraft(template);
    return template;
  }

  try {
    const { chatJsonCompletion } = await import("@/server/openai-client");
    const system = [
      "Eres AG-08 Especialista en Publicidad de COMPRUKI (panel dueño, Colombia).",
      "Devuelve SOLO JSON: {hypothesis,headline,primaryText,audienceHint,budgetNote,cta}.",
      "hypothesis: plan de prueba interno (≤320 chars). No inventes métricas reales.",
      "headline ≤80, primaryText ≤500, audienceHint ≤220, budgetNote ≤280, cta ≤40.",
      "Usa solo hechos del producto. Español colombiano. No menciones Dropi ni OpenAI.",
      "Deja claro que un humano confirma presupuesto; generar no compra anuncios.",
      "Pagas al recibir. Envío aparte. Nadie cobra en la tienda web.",
    ].join(" ");

    const completion = await chatJsonCompletion({
      system,
      user: JSON.stringify({
        sku: facts.sku,
        title: facts.title,
        category: facts.category,
        priceLabel: facts.priceLabel,
        published: facts.published,
        available: facts.available,
        variants: facts.variants.slice(0, 8),
        description: facts.description.slice(0, 500),
        highlights: facts.highlights.slice(0, 300),
      }),
      maxTokens: 700,
    });

    if (!completion.ok) {
      rememberCampaignDraft(template);
      return template;
    }

    const parsed = parseOpenAICampaignDraft(completion.text, facts);
    if (!parsed) {
      rememberCampaignDraft(template);
      return template;
    }

    const draft: CampaignDraft = {
      sku: facts.sku,
      productTitle: facts.title,
      ...parsed,
      via: "openai",
      costEstimateCop: completion.costEstimateCop,
    };
    rememberCampaignDraft(draft);
    return draft;
  } catch {
    rememberCampaignDraft(template);
    return template;
  }
}
