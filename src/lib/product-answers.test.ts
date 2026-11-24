import { describe, expect, it } from "vitest";
import {
  answerProductQuestion,
  PRODUCT_QUESTION_HANDOFF_REPLY,
  productQuestionNeedsHandoff,
} from "@/lib/product-answers";

const base = {
  description: "Lámpara de mesa con luz cálida.",
  highlights: "Incluye cable.\nNo incluye bombillo.",
  answers: "Material: metal y tela.",
  price: 89000,
  available: true,
  variants: ["Grande", "Pequeño"],
  sizeKind: "tamano" as const,
};

describe("answerProductQuestion", () => {
  it("responde precio publicado sin handoff", () => {
    const reply = answerProductQuestion(base, "¿Cuánto cuesta?");
    expect(reply).toContain("precio publicado");
    expect(productQuestionNeedsHandoff(reply)).toBe(false);
  });

  it("marca handoff cuando la ficha no alcanza", () => {
    const reply = answerProductQuestion(base, "¿Sirve para acuario marino tropical?");
    expect(reply).toBe(PRODUCT_QUESTION_HANDOFF_REPLY);
    expect(productQuestionNeedsHandoff(reply)).toBe(true);
  });

  it("no ofrece handoff para costo interno", () => {
    const reply = answerProductQuestion(base, "¿Cuál es el margen o utilidad?");
    expect(reply).toBe("Eso no está en la ficha pública.");
    expect(productQuestionNeedsHandoff(reply)).toBe(false);
  });
});
