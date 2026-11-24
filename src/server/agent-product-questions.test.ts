import { describe, expect, it } from "vitest";
import { PRODUCT_QUESTION_HANDOFF_REPLY } from "@/lib/product-answers";
import {
  buildOwnerAnswerTemplate,
  parseOpenAIOwnerAnswerDraft,
} from "@/server/agent-product-questions";

const product = {
  description: "Faja moldeadora de tela firme.",
  highlights: "Cierre frontal.",
  answers: "",
  price: 79_000,
  available: true,
  variants: ["M", "L"],
  sizeKind: null,
};

describe("buildOwnerAnswerTemplate", () => {
  it("arma un borrador plantilla sin Dropi", () => {
    const draft = buildOwnerAnswerTemplate(product, "¿Sirve para uso diario?");
    expect(draft.via).toBe("plantilla");
    expect(draft.costEstimateCop).toBe(0);
    expect(draft.text.toLowerCase()).toContain("ficha");
    expect(draft.text).not.toMatch(/Dropi|OpenAI/i);
  });
});

describe("parseOpenAIOwnerAnswerDraft", () => {
  it("lee draft limpio", () => {
    const draft = parseOpenAIOwnerAnswerDraft(
      JSON.stringify({ draft: "Según la ficha: cierre frontal. Sin Dropi ni OpenAI.", handoff: false }),
    );
    expect(draft).toBe("Según la ficha: cierre frontal. Sin ni .");
  });

  it("rechaza handoff o vacío", () => {
    expect(parseOpenAIOwnerAnswerDraft(JSON.stringify({ draft: "", handoff: true }))).toBeNull();
    expect(parseOpenAIOwnerAnswerDraft(JSON.stringify({ draft: PRODUCT_QUESTION_HANDOFF_REPLY }))).toBeNull();
    expect(parseOpenAIOwnerAnswerDraft("no-json")).toBeNull();
  });
});
