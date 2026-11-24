import { describe, expect, it } from "vitest";
import { whatsAppHref } from "@/lib/store-order";

describe("whatsAppHref", () => {
  it("arma wa.me con celular colombiano de 10 dígitos", () => {
    const href = whatsAppHref("3001234567", "Hola Ana");
    expect(href).toBe("https://wa.me/573001234567?text=Hola%20Ana");
  });

  it("rechaza teléfonos inválidos", () => {
    expect(whatsAppHref("2001234567", "Hola")).toBeNull();
    expect(whatsAppHref("300123456", "Hola")).toBeNull();
    expect(whatsAppHref("", "Hola")).toBeNull();
  });
});
