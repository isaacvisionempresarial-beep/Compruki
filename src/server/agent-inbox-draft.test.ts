import { describe, expect, it } from "vitest";
import { buildInboxReplyTemplate } from "@/server/agent-inbox-draft";
import type { InboxMessage } from "@/server/whatsapp-inbox";

function msg(partial: Partial<InboxMessage> & Pick<InboxMessage, "body" | "direction">): InboxMessage {
  return {
    id: partial.id ?? "1",
    waMessageId: partial.waMessageId ?? "wamid.1",
    direction: partial.direction,
    body: partial.body,
    messageType: partial.messageType ?? "text",
    deliveryStatus: partial.deliveryStatus ?? "received",
    deliveryDetail: partial.deliveryDetail ?? "",
    mediaId: partial.mediaId ?? "",
    createdBy: partial.createdBy ?? "",
    createdAt: partial.createdAt ?? "2026-11-28T12:00:00.000Z",
  };
}

describe("buildInboxReplyTemplate", () => {
  it("usa pedido cuando hay chip", () => {
    const draft = buildInboxReplyTemplate({
      contactName: "María López",
      messages: [msg({ direction: "inbound", body: "Hola" })],
      orders: [{ number: "P-100", statusLabel: "Confirmado", totalLabel: "$50.000" }],
    });
    expect(draft.via).toBe("plantilla");
    expect(draft.text).toContain("María");
    expect(draft.text).toContain("P-100");
    expect(draft.text).toContain("Confirmado");
  });

  it("omite nombre si es solo teléfono", () => {
    const draft = buildInboxReplyTemplate({
      contactName: "573001112233",
      messages: [],
      orders: [],
    });
    expect(draft.text.startsWith("Hola.")).toBe(true);
  });
});
