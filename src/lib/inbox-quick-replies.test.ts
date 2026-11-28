import { describe, expect, it } from "vitest";
import {
  fillInboxQuickReply,
  inboxMediaLabel,
  orderStatusQuickReply,
} from "@/lib/inbox-quick-replies";

describe("fillInboxQuickReply", () => {
  it("inserta el primer nombre", () => {
    expect(fillInboxQuickReply("Hola{nombre}, ¿sí?", "María López")).toBe("Hola María, ¿sí?");
  });

  it("omite nombre si es solo teléfono", () => {
    expect(fillInboxQuickReply("Hola{nombre}, ¿sí?", "573001112233")).toBe("Hola, ¿sí?");
  });
});

describe("inboxMediaLabel", () => {
  it("etiqueta tipos de media y reaccion", () => {
    expect(inboxMediaLabel("image")).toBe("Imagen");
    expect(inboxMediaLabel("voice")).toBe("Audio");
    expect(inboxMediaLabel("document")).toBe("Documento");
    expect(inboxMediaLabel("text")).toBeNull();
  });
});

describe("orderStatusQuickReply", () => {
  it("arma el borrador con pedido y estado", () => {
    expect(
      orderStatusQuickReply({ number: "P-100", statusLabel: "Confirmado" }, "Ana Pérez"),
    ).toBe("Hola Ana, tu pedido P-100 está en: Confirmado. ¿Te ayudo con algo más?");
  });
});
