import {
  insertWhatsAppMessage,
  updateWhatsAppDelivery,
  upsertWhatsAppConnection,
} from "@/server/whatsapp/connection";
import { prefetchInboxMediaFromMeta } from "@/server/whatsapp-inbox-media";
import { ensureLeadFromInbound } from "@/server/followups";
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
  image?: { id?: string; caption?: string };
  document?: { id?: string; caption?: string; filename?: string };
  video?: { id?: string; caption?: string };
  audio?: { id?: string };
  voice?: { id?: string };
  sticker?: { id?: string };
  reaction?: { emoji?: string };
};

type WebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
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
        event?: string;
        message_template_id?: string;
        message_template_name?: string;
        message_template_language?: string;
        reason?: string;
      };
    }>;
  }>;
};

function extractInboundBody(
  message: InboundMessage,
): { body: string; messageType: string; mediaId: string } | null {
  if (message.type === "text" && message.text?.body?.trim()) {
    return { body: message.text.body.trim(), messageType: "text", mediaId: "" };
  }
  if (message.type === "button" && message.button?.text?.trim()) {
    return { body: message.button.text.trim(), messageType: "button", mediaId: "" };
  }
  const choice =
    message.interactive?.button_reply?.title || message.interactive?.list_reply?.title;
  if (message.type === "interactive" && choice?.trim()) {
    return { body: choice.trim(), messageType: "interactive", mediaId: "" };
  }
  if (message.type === "reaction") {
    const emoji = message.reaction?.emoji?.trim() || "👍";
    return { body: `Reacción: ${emoji}`, messageType: "reaction", mediaId: "" };
  }
  if (message.type === "image") {
    const caption = message.image?.caption?.trim();
    return {
      body: caption ? `Imagen · ${caption}` : "Imagen",
      messageType: "image",
      mediaId: message.image?.id?.trim() || "",
    };
  }
  if (message.type === "document") {
    const caption = message.document?.caption?.trim();
    const filename = message.document?.filename?.trim();
    return {
      body: caption || filename || "Documento",
      messageType: "document",
      mediaId: message.document?.id?.trim() || "",
    };
  }
  if (message.type === "video") {
    const caption = message.video?.caption?.trim();
    return {
      body: caption ? `Video · ${caption}` : "Video",
      messageType: "video",
      mediaId: message.video?.id?.trim() || "",
    };
  }
  if (message.type === "audio" || message.type === "voice") {
    return {
      body: "Nota de voz",
      messageType: "audio",
      mediaId: message.audio?.id?.trim() || message.voice?.id?.trim() || "",
    };
  }
  if (message.type === "sticker") {
    return {
      body: "Sticker",
      messageType: "sticker",
      mediaId: message.sticker?.id?.trim() || "",
    };
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
  let templateEvents = 0;
  const templateNotes: string[] = [];

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;

      if (
        change.field === "message_template_status_update" &&
        value.message_template_name
      ) {
        const event = String(value.event || "UPDATE").toUpperCase();
        const name = String(value.message_template_name);
        const language = String(value.message_template_language || "");
        const reason = String(value.reason || "").trim();
        templateNotes.push(
          `Plantilla ${name}${language ? ` (${language})` : ""} → ${event}${
            reason && reason !== "NONE" ? `: ${reason}` : ""
          }`,
        );
        templateEvents += 1;
        continue;
      }

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
        const updated = await updateWhatsAppDelivery(tenantId, status.id, status.status, detail);
        if (!updated) {
          // Envío fuera del panel (p. ej. Meta): rastro en Actividad, no ensucia el Inbox.
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
        }
        statuses += 1;
      }

      for (const message of value.messages || []) {
        if (!message.id || !message.from) continue;
        const extracted = extractInboundBody(message);
        if (!extracted) continue;
        const contactName =
          value.contacts?.find((c) => c.wa_id === message.from)?.profile?.name?.trim() || "";
        const rowId = await insertWhatsAppMessage(tenantId, {
          waMessageId: message.id,
          direction: "inbound",
          phone: message.from,
          contactName,
          body: extracted.body,
          messageType: extracted.messageType,
          deliveryStatus: "received",
          // Sin migración: el media_id de Meta vive en delivery_detail.
          deliveryDetail: extracted.mediaId ? `media:${extracted.mediaId}` : "",
        });
        if (rowId && extracted.mediaId) {
          // No await: el webhook responde rápido; el cache corre en paralelo.
          void prefetchInboxMediaFromMeta(tenantId, rowId, extracted.mediaId);
        }
        await ensureLeadFromInbound({
          tenantId,
          phone: message.from,
          customerName: contactName,
          preview: extracted.body,
        }).catch(() => undefined);
        inbound += 1;
      }
    }
  }

  const receivedSomething = inbound > 0 || statuses > 0 || templateEvents > 0;
  const detailParts = [
    receivedSomething
      ? `Webhook OK · entrantes ${inbound} · estados ${statuses}${
          templateEvents ? ` · plantillas ${templateEvents}` : ""
        }`
      : "Webhook recibido sin mensajes/estados",
    ...templateNotes.slice(0, 3),
    new Date().toISOString(),
  ];
  await upsertWhatsAppConnection(tenantId, {
    status: "verificada",
    touchInbound: inbound > 0,
    touchChecked: true,
    detail: detailParts.filter(Boolean).join(" · "),
    lastError: "",
  });

  return {
    accepted: true,
    inbound,
    statuses,
    ignored: !receivedSomething,
  };
}
