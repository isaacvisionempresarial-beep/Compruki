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
  createWhatsAppTemplate,
  listWhatsAppTemplates,
  MetaApiError,
  ensureWhatsAppInbound,
  sendWhatsAppTemplate,
  sendWhatsAppText,
  verifyMetaPhone,
  type WhatsAppTemplateInfo,
} from "@/server/whatsapp/meta-client";
import { siteUrl } from "@/lib/site-url";

export type WhatsAppTemplateRow = WhatsAppTemplateInfo;

export type WhatsAppActionState = {
  error: string | null;
  ok: string | null;
  connection: WhatsAppConnectionState | null;
  templates: WhatsAppTemplateRow[];
  recent: RecentWaMessage[];
};

function emptyState(): WhatsAppActionState {
  return { error: null, ok: null, connection: null, templates: [], recent: [] };
}

async function loadManagedTemplates(): Promise<WhatsAppTemplateRow[]> {
  if (!metaWaConfigured()) return [];
  try {
    const env = requireMetaWaEnv();
    if (!env.businessAccountId) return [];
    return await listWhatsAppTemplates(env);
  } catch {
    return [];
  }
}

export async function loadWhatsAppPanelData(): Promise<{
  connection: WhatsAppConnectionState;
  recent: RecentWaMessage[];
  templates: WhatsAppTemplateRow[];
  webhookUrl: string;
}> {
  const access = await assertPanelAccess();
  if (!access) {
    return {
      connection: await readWhatsAppConnection(),
      recent: [],
      templates: [],
      webhookUrl: siteUrl("/api/whatsapp/webhook"),
    };
  }
  const [connection, recent, templates] = await Promise.all([
    readWhatsAppConnection(access.tenantId),
    listRecentWhatsAppMessages(access.tenantId, 25),
    loadManagedTemplates(),
  ]);
  return {
    connection,
    recent,
    templates,
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
    let inboundWarn = "";
    try {
      inboundNote = await ensureWhatsAppInbound(env, siteUrl("/api/whatsapp/webhook"));
    } catch (error) {
      // Número OK: no bloquear Verificar; Meta UI puede ya entregar webhooks.
      inboundWarn =
        error instanceof MetaApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Webhook no confirmado por API.";
      inboundNote =
        "Webhook no confirmado por API; deja «Suscribir webhooks» ON en Meta y prueba un mensaje entrante.";
    }
    await upsertWhatsAppConnection(access.tenantId, {
      ...phonePatch,
      lastError: inboundWarn,
      detail: `Número verificado con Graph API. ${inboundNote}`,
    });

    let templates: WhatsAppActionState["templates"] = [];
    try {
      templates = await listWhatsAppTemplates(env);
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

export async function refreshWhatsAppTemplatesAction(
  _state: WhatsAppActionState,
  _formData: FormData,
): Promise<WhatsAppActionState> {
  const access = await assertPanelAccess();
  if (!access) return { ...emptyState(), error: "Sin sesión." };
  if (!hasPermission(access, "whatsapp_manage")) {
    return { ...emptyState(), error: "Tu rol no permite administrar plantillas." };
  }
  if (!metaWaConfigured()) {
    return { ...emptyState(), error: "Faltan META_WA_* en Railway." };
  }
  try {
    const templates = await listWhatsAppTemplates(requireMetaWaEnv());
    const [connection, recent] = await Promise.all([
      readWhatsAppConnection(access.tenantId),
      listRecentWhatsAppMessages(access.tenantId, 25),
    ]);
    return {
      error: null,
      ok: `${templates.length} plantilla(s) en Meta.`,
      connection,
      templates,
      recent,
    };
  } catch (error) {
    return {
      ...emptyState(),
      error: error instanceof Error ? error.message : "No se pudieron listar plantillas.",
      connection: await readWhatsAppConnection(access.tenantId),
    };
  }
}

export async function submitWhatsAppTemplateAction(
  _state: WhatsAppActionState,
  formData: FormData,
): Promise<WhatsAppActionState> {
  const access = await assertPanelAccess();
  if (!access) return { ...emptyState(), error: "Sin sesión." };
  if (!hasPermission(access, "whatsapp_manage")) {
    return { ...emptyState(), error: "Tu rol no permite crear plantillas." };
  }
  if (!metaWaConfigured()) {
    return { ...emptyState(), error: "Faltan META_WA_* en Railway." };
  }

  const body = String(formData.get("body") || "");
  const positions = [
    ...new Set([...body.matchAll(/{{(\d+)}}/g)].map((match) => Number(match[1]))),
  ].sort((a, b) => a - b);
  const variables = positions.map((position) => ({
    position,
    example: String(formData.get(`example_${position}`) || "").trim(),
  }));
  const categoryRaw = String(formData.get("category") || "UTILITY").toUpperCase();
  const category = categoryRaw === "MARKETING" ? "MARKETING" : "UTILITY";

  try {
    const created = await createWhatsAppTemplate(requireMetaWaEnv(), {
      name: String(formData.get("name") || ""),
      category,
      language: String(formData.get("language") || "es"),
      body,
      variables,
    });
    const templates = await listWhatsAppTemplates(requireMetaWaEnv()).catch(() => []);
    const [connection, recent] = await Promise.all([
      readWhatsAppConnection(access.tenantId),
      listRecentWhatsAppMessages(access.tenantId, 25),
    ]);
    return {
      error: null,
      ok: `Plantilla «${created.name}» enviada a Meta (pendiente de aprobación).`,
      connection,
      templates,
      recent,
    };
  } catch (error) {
    const templates = await loadManagedTemplates();
    return {
      error: error instanceof Error ? error.message : "No se pudo enviar la plantilla a Meta.",
      ok: null,
      connection: await readWhatsAppConnection(access.tenantId),
      templates,
      recent: await listRecentWhatsAppMessages(access.tenantId, 25),
    };
  }
}
