import { describe, expect, it } from "vitest";
import { storePublicTagline } from "@/lib/store-identity";

describe("storePublicTagline", () => {
  it("usa la frase guardada", () => {
    expect(storePublicTagline({ tagline: "Ropa con pago al recibir." })).toBe("Ropa con pago al recibir.");
  });

  it("cae al texto por defecto si está vacío", () => {
    expect(storePublicTagline({ tagline: "  " })).toContain("paga cuando te llegue");
  });
});
