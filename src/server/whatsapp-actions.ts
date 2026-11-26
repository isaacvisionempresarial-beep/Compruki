"use server";

import { assertPanelAccess, hasPermission } from "@/server/panel-auth";
import {
  insertWhatsAppMessage,
  listRecentWhatsAppMessages,
  normalizeWaPhone,
  readWhatsAppConnection,
  upsertWhatsAppConnection,
  type RecentWaMessage,
  type WhatsAppConnectionState,
} from "@/server/whatsapp/connection";
import { metaWaConfigured, requireMetaWaEnv } from "@/server/whatsapp/env";
import {
  listWhatsAppTemplates,
  MetaApiError,
  ensureWhatsAppInbound,
  sendWhatsAppTemplate,
  sendWhatsAppText,
  verifyMetaPhone,
} from "@/server/whatsapp/meta-client";
import { siteUrl } from "@/lib/site-url";

export type WhatsAppActionState = {
  error: string | null;
  ok: string | null;
  connection: WhatsAppConnectionState | null;
  templates: Array<{ name: string; language: string; status: string; category: string }>;
  recent: RecentWaMessage[];
};

function emptyState(): WhatsAppActionState {
  return { error: null, ok: null, connection: null, templates: [], recent: [] };
}

export async function loadWhatsAppPanelData(): Promise<{
  connection: WhatsAppConnectionState;
  recent: RecentWaMessage[];
  webhookUrl: string;
}> {
  const access = await assertPanelAccess();
  if (!access) {
    return {
      connection: await readWhatsAppConnection(),
      recent: [],
      webhookUrl: siteUrl("/api/whatsapp/webhook"),
    };
  }
  const [connection, recent] = await Promise.all([
    readWhatsAppConnection(access.tenantId),
    listRecentWhatsAppMessages(access.tenantId, 25),
  ]);
  return {
    connection,
    recent,
    webhookUrl: siteUrl("/api/whatsapp/webhook"),
  };
}

export async function verifyWhatsAppConnectionAction(
  _state: WhatsAppActionState,
  _formData: FormData,
): Promise<WhatsAppActionState> {
  const access = await assertPanelAccess();
  if (!access) return { ...emptyState(), error: "Tu sesión no permite verificar WhatsApp." };
  if (!hasPermission(access, "whatsapp_manage")) {
    return { ...emptyState(), error: "Tu rol no permite verificar WhatsApp." };
  }

  if (!metaWaConfigured()) {
    const connection = await readWhatsAppConnection(access.tenantId);
    return {
      ...emptyState(),
      error: "Faltan META_WA_* en Railway (token, phone number id, verify token, app secret).",
      connection,
    };
  }

  try {
    const env = requireMetaWaEnv();
    const verified = await verifyMetaPhone(env);
    const phonePatch = {
      status: "verificada" as const,
      phoneNumberId: verified.phoneNumberId,
      businessAccountId: env.businessAccountId,
      displayPhoneNumber: verified.displayPhoneNumber,
      verifiedName: verified.verifiedName,
      qualityRating: verified.qualityRating,
      touchChecked: true,
    };
    let inboundNote = "";
    try {
      inboundNote = await ensureWhatsAppInbound(env, siteUrl("/api/whatsapp/webhook"));
    } catch (error) {
      const message =
        error instanceof MetaApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "No se pudo suscribir el webhook.";
      await upsertWhatsAppConnection(access.tenantId, {
        ...phonePatch,
        lastError: message,
        detail: "Número verificado con Graph API. El webhook no quedó suscrito.",
      });
      const [connection, recent] = await Promise.all([
        readWhatsAppConnection(access.tenantId),
        listRecentWhatsAppMessages(access.tenantId, 25),
      ]);
      return { error: message, ok: null, connection, templates: [], recent };
    }
    await upsertWhatsAppConnection(access.tenantId, {
      ...phonePatch,
      lastError: "",
      detail: `Número verificado con Graph API. ${inboundNote}`,
    });

    let templates: WhatsAppActionState["templates"] = [];
    try {
      const rows = await listWhatsAppTemplates(env);
      templates = rows
        .filter((row) => row.name && row.language)
        .map((row) => ({
          name: String(row.name),
          language: String(row.language),
          status: String(row.status || ""),
          category: String(row.category || ""),
        }));
    } catch {
      templates = [];
    }

    const [connection, recent] = await Promise.all([
      readWhatsAppConnection(access.tenantId),
      listRecentWhatsAppMessages(access.tenantId, 25),
    ]);
    return {
      error: null,
      ok: `Verificado: ${verified.displayPhoneNumber || verified.phoneNumberId}${verified.verifiedName ? ` · ${verified.verifiedName}` : ""}`,
      connection,
      templates,
      recent,
    };
  } catch (error) {
    const message =
      error instanceof MetaApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo verificar con Meta.";
    await upsertWhatsAppConnection(access.tenantId, {
      status: "error",
      touchChecked: true,
      lastError: message,
      detail: "Falló la verificación con Graph API.",
    }).catch(() => undefined);
    const connection = await readWhatsAppConnection(access.tenantId);
    return { ...emptyState(), error: message, connection };
  }
}

export async function sendWhatsAppTestAction(
  _state: WhatsAppActionState,
  formData: FormData,
): Promise<WhatsAppActionState> {
  const access = await assertPanelAccess();
  if (!access) return { ...emptyState(), error: "Tu sesión no permite enviar WhatsApp." };
  if (!hasPermission(access, "whatsapp_manage")) {
    return { ...emptyState(), error: "Tu rol no permite enviar WhatsApp." };
  }

  if (!metaWaConfigured()) {
    return {
      ...emptyState(),
      error: "Faltan META_WA_* en Railway.",
      connection: await readWhatsAppConnection(access.tenantId),
    };
  }

  const phone = normalizeWaPhone(String(formData.get("phone") || ""));
  const mode = String(formData.get("mode") || "text");
  const body = String(formData.get("body") || "").trim();
  const templateName = String(formData.get("templateName") || "").trim();
  const language = String(formData.get("language") || "es").trim() || "es";
  const templateValues = String(formData.get("templateValues") || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!phone) {
    return {
      ...emptyState(),
      error: "Celular inválido. Usa dígitos con indicativo (ej. 57300…).",
      connection: await readWhatsAppConnection(access.tenantId),
    };
  }

  try {
    const env = requireMetaWaEnv();
    let messageId: string;
    let storedBody: string;
    let messageType: string;

    if (mode === "template") {
      if (!templateName) {
        return {
          ...emptyState(),
          error: "Indica el nombre de la plantilla aprobada en Meta.",
          connection: await readWhatsAppConnection(access.tenantId),
        };
      }
      messageId = await sendWhatsAppTemplate(env, {
        toPhoneDigits: phone,
        templateName,
        language,
        bodyValues: templateValues,
      });
      storedBody = `Plantilla ${templateName} (${language})${templateValues.length ? `: ${templateValues.join(", ")}` : ""}`;
      messageType = "template";
    } else {
      if (!body || body.length > 4096) {
        return {
          ...emptyState(),
          error: "Escribe un texto de prueba (1–4096 caracteres). Solo funciona dentro de la ventana 24 h.",
          connection: await readWhatsAppConnection(access.tenantId),
        };
      }
      messageId = await sendWhatsAppText(env, phone, body);
      storedBody = body;
      messageType = "text";
    }

    await insertWhatsAppMessage(access.tenantId, {
      waMessageId: messageId,
      direction: "outbound",
      phone,
      body: storedBody,
      messageType,
      deliveryStatus: "sent",
      createdBy: access.actorName,
    });

    const [connection, recent] = await Promise.all([
      readWhatsAppConnection(access.tenantId),
      listRecentWhatsAppMessages(access.tenantId, 25),
    ]);

    return {
      error: null,
      ok: `Enviado a ${phone} · id ${messageId.slice(0, 18)}…`,
      connection,
      templates: [],
      recent,
    };
  } catch (error) {
    const message =
      error instanceof MetaApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo enviar el mensaje.";
    return {
      ...emptyState(),
      error: message,
      connection: await readWhatsAppConnection(access.tenantId),
      recent: await listRecentWhatsAppMessages(access.tenantId, 25),
    };
  }
}
