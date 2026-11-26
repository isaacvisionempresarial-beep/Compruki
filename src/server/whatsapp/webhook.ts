import { createHmac, timingSafeEqual } from "node:crypto";
import {
  insertWhatsAppMessage,
  updateWhatsAppDelivery,
  upsertWhatsAppConnection,
} from "@/server/whatsapp/connection";
import { requireMetaWaEnv } from "@/server/whatsapp/env";
import { getPilotTenantId } from "@/server/tenant";

type InboundMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
  image?: { caption?: string };
  document?: { caption?: string; filename?: string };
  video?: { caption?: string };
  audio?: unknown;
  voice?: unknown;
  sticker?: unknown;
  reaction?: { emoji?: string };
};

type WebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: InboundMessage[];
        statuses?: Array<{
          id?: string;
          status?: string;
          recipient_id?: string;
          errors?: Array<{
            code?: number;
            title?: string;
            message?: string;
            error_data?: { details?: string };
          }>;
        }>;
      };
    }>;
  }>;
};

export function verifyMetaSignature(appSecret: string, signatureHeader: string | null, rawBody: string) {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const provided = Buffer.from(signatureHeader.slice(7), "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function verifyWebhookChallenge(query: URLSearchParams): string | null {
  const mode = query.get("hub.mode") || "";
  const token = query.get("hub.verify_token") || "";
  const challenge = query.get("hub.challenge") || "";
  if (mode !== "subscribe" || !challenge || token.length < 8) return null;
  const expected = requireMetaWaEnv().verifyToken;
  if (token !== expected) return null;
  return challenge;
}

function extractInboundBody(message: InboundMessage): { body: string; messageType: string } | null {
  if (message.type === "text" && message.text?.body?.trim()) {
    return { body: message.text.body.trim(), messageType: "text" };
  }
  if (message.type === "button" && message.button?.text?.trim()) {
    return { body: message.button.text.trim(), messageType: "button" };
  }
  const choice =
    message.interactive?.button_reply?.title || message.interactive?.list_reply?.title;
  if (message.type === "interactive" && choice?.trim()) {
    return { body: choice.trim(), messageType: "interactive" };
  }
  if (message.type === "reaction") {
    const emoji = message.reaction?.emoji?.trim() || "👍";
    return { body: `Reacción: ${emoji}`, messageType: "reaction" };
  }
  if (message.type === "image") {
    return {
      body: message.image?.caption?.trim() || "[Imagen recibida]",
      messageType: "image",
    };
  }
  if (message.type === "document") {
    return {
      body:
        message.document?.caption?.trim() ||
        message.document?.filename?.trim() ||
        "[Documento recibido]",
      messageType: "document",
    };
  }
  if (message.type === "video") {
    return {
      body: message.video?.caption?.trim() || "[Video recibido]",
      messageType: "video",
    };
  }
  if (message.type === "audio" || message.type === "voice") {
    return { body: "[Nota de voz recibida]", messageType: "audio" };
  }
  if (message.type === "sticker") {
    return { body: "[Sticker recibido]", messageType: "sticker" };
  }
  return null;
}

export async function processWhatsAppWebhook(payload: WebhookPayload): Promise<{
  accepted: boolean;
  inbound: number;
  statuses: number;
  ignored: boolean;
}> {
  if (payload.object !== "whatsapp_business_account") {
    return { accepted: true, inbound: 0, statuses: 0, ignored: true };
  }

  const tenantId = await getPilotTenantId();
  let inbound = 0;
  let statuses = 0;

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;

      for (const status of value.statuses || []) {
        if (!status.id || !status.status) continue;
        if (!["sent", "delivered", "read", "failed"].includes(status.status)) continue;
        const error = status.errors?.[0];
        let detail = error?.error_data?.details || error?.message || error?.title || "";
        if (error?.code === 131047) {
          detail = "Ventana de 24 h cerrada; usa una plantilla aprobada.";
        }
        if (error?.code === 131042) {
          detail = "Configura país, moneda y método de pago en Meta Business.";
        }
        // Si el envío fue desde Meta (no desde el panel), igual dejamos rastro en Actividad.
        await insertWhatsAppMessage(tenantId, {
          waMessageId: status.id,
          direction: "outbound",
          phone: status.recipient_id || "",
          body: `Estado Meta: ${status.status}${detail ? ` · ${detail}` : ""}`,
          messageType: "status",
          deliveryStatus: status.status,
          deliveryDetail: detail,
          createdBy: "meta-webhook",
        });
        await updateWhatsAppDelivery(tenantId, status.id, status.status, detail);
        statuses += 1;
      }

      for (const message of value.messages || []) {
        if (!message.id || !message.from) continue;
        const extracted = extractInboundBody(message);
        if (!extracted) continue;
        const contactName =
          value.contacts?.find((c) => c.wa_id === message.from)?.profile?.name?.trim() || "";
        await insertWhatsAppMessage(tenantId, {
          waMessageId: message.id,
          direction: "inbound",
          phone: message.from,
          contactName,
          body: extracted.body,
          messageType: extracted.messageType,
          deliveryStatus: "received",
        });
        inbound += 1;
      }
    }
  }

  const receivedSomething = inbound > 0 || statuses > 0;
  await upsertWhatsAppConnection(tenantId, {
    status: "verificada",
    touchInbound: inbound > 0,
    touchChecked: true,
    detail: receivedSomething
      ? `Webhook OK · entrantes ${inbound} · estados ${statuses} · ${new Date().toISOString()}`
      : `Webhook recibido sin mensajes/estados · ${new Date().toISOString()}`,
    lastError: "",
  });

  return {
    accepted: true,
    inbound,
    statuses,
    ignored: !receivedSomething,
  };
}
