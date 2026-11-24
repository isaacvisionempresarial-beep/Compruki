import {
  PRODUCT_QUESTION_HANDOFF_REPLY,
  type AnswerableProduct,
} from "@/lib/product-answers";
import { formatCop } from "@/lib/format";

export type OwnerAnswerDraft = {
  text: string;
  via: "openai" | "plantilla";
  costEstimateCop: number;
};

function scrubDraft(text: string) {
  return text
    .replace(/\bDropi\b/gi, "")
    .replace(/\bOpenAI\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plantilla corta para el dueño cuando no hay modelo. */
export function buildOwnerAnswerTemplate(product: AnswerableProduct, question: string): OwnerAnswerDraft {
  const bits = [
    product.highlights.trim().slice(0, 120),
    product.description.trim().slice(0, 120),
  ].filter(Boolean);
  const base = bits[0]
    ? `Según la ficha: ${bits[0]}`
    : `El precio publicado es ${formatCop(product.price)}. Pagas al recibir.`;
  return {
    text: scrubDraft(`${base} (Revisa la pregunta: «${question.trim().slice(0, 80)}»).`).slice(0, 400),
    via: "plantilla",
    costEstimateCop: 0,
  };
}

/** Interpreta JSON de borrador AG-05. */
export function parseOpenAIOwnerAnswerDraft(raw: string): string | null {
  try {
    const data = JSON.parse(raw) as { draft?: unknown; handoff?: unknown };
    if (data.handoff === true) return null;
    const draft = typeof data.draft === "string" ? scrubDraft(data.draft).slice(0, 400) : "";
    if (draft.length < 12) return null;
    if (draft === PRODUCT_QUESTION_HANDOFF_REPLY) return null;
    return draft;
  } catch {
    return null;
  }
}

/**
 * AG-05 · borrador de respuesta para el dueño (no publica solo).
 * OpenAI si responde; si no, plantilla a partir de la ficha.
 */
export async function draftOwnerProductAnswer(
  product: AnswerableProduct & { sku: string; title: string },
  question: string,
): Promise<OwnerAnswerDraft> {
  const template = buildOwnerAnswerTemplate(product, question);
  const { openAIKeyConfigured } = await import("@/server/openai-client");
  if (!openAIKeyConfigured()) return template;

  try {
    const { chatJsonCompletion } = await import("@/server/openai-client");
    const system = [
      "Eres AG-05 de COMPRUKI (panel dueño, Colombia).",
      "El comprador hizo una pregunta que la ficha no resolvió sola.",
      "Devuelve SOLO JSON: {draft:string, handoff:boolean}.",
      "draft: respuesta corta (≤400 chars) solo con hechos del producto. Español colombiano.",
      "Si no hay hechos suficientes, handoff:true y draft:\"\".",
      "No inventes medidas, materiales, stock ni plazos. No menciones Dropi ni OpenAI.",
      "Pagas al recibir. Envío aparte. Nadie cobra en la tienda web.",
      "Esto es un borrador: un humano lo revisa antes de anotarlo en la ficha.",
    ].join(" ");

    const completion = await chatJsonCompletion({
      system,
      user: JSON.stringify({
        question: question.trim().slice(0, 200),
        sku: product.sku,
        title: product.title,
        priceLabel: formatCop(product.price),
        available: product.available,
        variants: product.variants.slice(0, 12),
        sizeKind: product.sizeKind ?? null,
        description: product.description.slice(0, 700),
        highlights: product.highlights.slice(0, 400),
        answers: product.answers.slice(0, 500),
      }),
      maxTokens: 320,
    });

    if (!completion.ok) return template;
    const draft = parseOpenAIOwnerAnswerDraft(completion.text);
    if (!draft) return template;

    return {
      text: draft,
      via: "openai",
      costEstimateCop: completion.costEstimateCop,
    };
  } catch {
    return template;
  }
}
