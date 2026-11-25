import { describe, expect, it } from "vitest";
import { orderWhatsAppText, whatsAppHref } from "@/lib/store-order";

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

describe("orderWhatsAppText", () => {
  it("incluye número de pedido y nombre de tienda", () => {
    expect(orderWhatsAppText("P-1042", "Tienda Piloto")).toBe(
      "Hola. Escribo por mi pedido P-1042 en Tienda Piloto.",
    );
  });

  it("usa respaldo si el nombre viene vacío", () => {
    expect(orderWhatsAppText("P-9", "   ")).toBe("Hola. Escribo por mi pedido P-9 en la tienda.");
  });
});
