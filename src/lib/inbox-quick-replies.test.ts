import { describe, expect, it } from "vitest";
import { fillInboxQuickReply } from "@/lib/inbox-quick-replies";

describe("fillInboxQuickReply", () => {
  it("inserta el primer nombre", () => {
    expect(fillInboxQuickReply("Hola{nombre}, ¿sí?", "María López")).toBe("Hola María, ¿sí?");
  });

  it("omite nombre si es solo teléfono", () => {
    expect(fillInboxQuickReply("Hola{nombre}, ¿sí?", "573001112233")).toBe("Hola, ¿sí?");
  });
});
