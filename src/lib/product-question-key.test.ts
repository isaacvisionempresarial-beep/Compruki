import { describe, expect, it } from "vitest";
import { normalizeProductQuestionKey } from "@/lib/product-question-key";

describe("normalizeProductQuestionKey", () => {
  it("iguala acentos y espacios", () => {
    expect(normalizeProductQuestionKey("  ¿Sirve para  Acuario?  ")).toBe(
      normalizeProductQuestionKey("sirve para acuario?"),
    );
  });

  it("distingue preguntas distintas", () => {
    expect(normalizeProductQuestionKey("¿Incluye cable?")).not.toBe(
      normalizeProductQuestionKey("¿Incluye bombillo?"),
    );
  });
});
