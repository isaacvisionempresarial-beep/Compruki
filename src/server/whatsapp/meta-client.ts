/** Cliente Graph API WhatsApp (referencia ConexionIA, adaptado a Compruki). */

import type { MetaWaEnv } from "@/server/whatsapp/env";

const DEFAULT_TIMEOUT_MS = 12_000;

export type MetaJson = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_user_title?: string;
    error_user_msg?: string;
    fbtrace_id?: string;
  };
  success?: boolean;
  id?: string;
  url?: string;
  mime_type?: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  messages?: Array<{ id?: string }>;
  data?:
    | Array<{
        id?: string;
        name?: string;
        language?: string;
        status?: string;
        category?: string;
        rejected_reason?: string;
        components?: Array<{ type?: string; text?: string }>;
        object?: string;
        callback_url?: string;
        app_id?: string;
        is_valid?: boolean;
      }>
    | { app_id?: string; is_valid?: boolean };
  whatsapp_business_account?: { id?: string; name?: string };
};

export type WhatsAppTemplateInfo = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  body: string;
  rejectedReason: string;
};

export class MetaApiError extends Error {
  status: number;
  metaCode: number | null;
  constructor(status: number, message: string, metaCode: number | null = null) {
    super(message);
    this.name = "MetaApiError";
    this.status = status;
    this.metaCode = metaCode;
  }
}

function formatMetaReject(error: MetaJson["error"] | undefined): string {
  const code = typeof error?.code === "number" ? error.code : null;
  const raw = (error?.error_user_msg || error?.message || "").replace(/\s+/g, " ").trim();
  const lower = raw.toLowerCase();
  const authLike =
    code === 190 ||
    code === 102 ||
    /authentication|access token|expired|invalid.*token|oauth/i.test(lower);

  if (authLike) {
    return (
      "Token de Meta inválido o vencido. En Meta Developers → App → WhatsApp → API Setup " +
      "copia un token nuevo (mejor System User permanente), pégalo en Railway como " +
      "META_WA_ACCESS_TOKEN, redeploy, y en /panel/whatsapp pulsa Verificar con Meta." +
      (code ? ` (código ${code})` : "")
    );
  }

  if (
    code === 10 ||
    /paid message account|cannot access the provided/i.test(lower)
  ) {
    return (
      "El token no tiene acceso a la cuenta de mensajería de este número (error 10). " +
      "En Meta Business → Usuarios del sistema → Conextalaatomyads → Asignar activos, " +
      "agrega la cuenta de WhatsApp/mensajería del 301 1234236 con Control total, " +
      "genera un token nuevo y actualízalo en Railway."
    );
  }

  const detail = raw.slice(0, 240);
  return detail
    ? `Meta rechazó la solicitud: ${detail}${code ? ` (${code})` : ""}`
    : "Meta rechazó la solicitud. Revisa token e IDs en Railway.";
}

async function sleepMs(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function metaRequest(
  env: Pick<MetaWaEnv, "accessToken" | "graphVersion">,
  path: string,
  method: "GET" | "POST",
  payload?: unknown,
  accessToken = env.accessToken,
): Promise<MetaJson> {
  const form = payload instanceof URLSearchParams;
  let lastNetworkError = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`https://graph.facebook.com/${env.graphVersion}/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(payload
            ? { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" }
            : {}),
        },
        body: payload ? (form ? payload : JSON.stringify(payload)) : undefined,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch {
      lastNetworkError = true;
      if (attempt < 2) {
        await sleepMs(400 * (attempt + 1));
        continue;
      }
      throw new MetaApiError(502, "No fue posible conectar con Meta. Intenta de nuevo.");
    }

    const data = (await response.json().catch(() => ({}))) as MetaJson;
    if ([429, 500, 502, 503].includes(response.status) && attempt < 2) {
      await sleepMs(400 * (attempt + 1));
      continue;
    }
    if (!response.ok) {
      const status = response.status >= 400 && response.status < 500 ? 422 : 502;
      const metaCode = typeof data.error?.code === "number" ? data.error.code : null;
      throw new MetaApiError(status, formatMetaReject(data.error), metaCode);
    }
    return data;
  }
  throw new MetaApiError(
    502,
    lastNetworkError
      ? "No fue posible conectar con Meta. Intenta de nuevo."
      : "Meta rechazó la solicitud. Revisa token e IDs.",
  );
}

export async function verifyMetaPhone(env: MetaWaEnv) {
  const result = await metaRequest(
    env,
    `${env.phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`,
    "GET",
  );
  return {
    phoneNumberId: result.id || env.phoneNumberId,
    displayPhoneNumber: result.display_phone_number || "",
    verifiedName: result.verified_name || "",
    qualityRating: result.quality_rating || "",
  };
}

/** Resuelve el WABA real del número (el Messaging Account ID de Meta UI a veces no sirve para subscribed_apps). */
export async function resolveWhatsAppBusinessAccountId(env: MetaWaEnv): Promise<string | null> {
  try {
    const result = await metaRequest(
      env,
      `${env.phoneNumberId}?fields=whatsapp_business_account{id,name}`,
      "GET",
    );
    if (result.whatsapp_business_account?.id) {
      return String(result.whatsapp_business_account.id);
    }
  } catch {
    /* token sin ese field */
  }
  try {
    const listed = await metaRequest(env, "me/whatsapp_business_accounts?fields=id,name&limit=25", "GET");
    const rows = Array.isArray(listed.data) ? listed.data : [];
    const match = rows.find((row) => row.id);
    if (match?.id) return String(match.id);
  } catch {
    /* sin acceso a /me/WABA */
  }
  return env.businessAccountId || null;
}

export async function sendWhatsAppText(env: MetaWaEnv, toPhoneDigits: string, body: string) {
  const sent = await metaRequest(env, `${env.phoneNumberId}/messages`, "POST", {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toPhoneDigits,
    type: "text",
    text: { preview_url: false, body },
  });
  const messageId = sent.messages?.[0]?.id;
  if (!messageId) {
    throw new MetaApiError(502, "Meta aceptó el mensaje sin devolver el identificador.");
  }
  return messageId;
}

export async function sendWhatsAppTemplate(
  env: MetaWaEnv,
  input: {
    toPhoneDigits: string;
    templateName: string;
    language: string;
    bodyValues?: string[];
  },
) {
  const parameters = (input.bodyValues ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .map((text) => ({ type: "text" as const, text }));

  const sent = await metaRequest(env, `${env.phoneNumberId}/messages`, "POST", {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.toPhoneDigits,
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.language },
      ...(parameters.length
        ? { components: [{ type: "body", parameters }] }
        : {}),
    },
  });
  const messageId = sent.messages?.[0]?.id;
  if (!messageId) {
    throw new MetaApiError(502, "Meta aceptó la plantilla sin devolver el identificador.");
  }
  return messageId;
}

function appAccessToken(appId: string, appSecret: string) {
  return `${appId}|${appSecret}`;
}

async function resolveMetaAppId(env: MetaWaEnv): Promise<string | null> {
  if (env.appId) return env.appId;
  try {
    const result = await metaRequest(
      env,
      `debug_token?input_token=${encodeURIComponent(env.accessToken)}`,
      "GET",
    );
    const data = result.data;
    if (data && !Array.isArray(data) && data.app_id) return String(data.app_id);
  } catch {
    return null;
  }
  return null;
}

/**
 * Hace que Meta entregue eventos de este número a Compruki.
 * El botón "Verificar" solo leía el número; sin subscribed_apps y sin
 * callback, Graph API envía pero Actividad no recibe webhooks.
 * No pisa un callback de app que apunte a otro host (p. ej. ConexionIA):
 * en ese caso solo registra el override de este phone number id.
 */
export async function ensureWhatsAppInbound(env: MetaWaEnv, callbackUrl: string): Promise<string> {
  const notes: string[] = [];
  let callbackReady = false;
  let wabaSubscribed = false;

  const wabaId = (await resolveWhatsAppBusinessAccountId(env)) || env.businessAccountId;
  if (wabaId) {
    try {
      await metaRequest(env, `${wabaId}/subscribed_apps`, "POST");
      wabaSubscribed = true;
    } catch {
      // Meta UI «Suscribir webhooks» + override del número suelen bastar.
    }
  }

  const appId = await resolveMetaAppId(env);
  if (!appId) {
    notes.push("Sin META_WA_APP_ID no registro el callback de la app");
  } else {
    const token = appAccessToken(appId, env.appSecret);
    let currentUrl: string | null = null;
    try {
      const listed = await metaRequest(env, `${appId}/subscriptions`, "GET", undefined, token);
      const rows = Array.isArray(listed.data) ? listed.data : [];
      currentUrl =
        rows.find((row) => row.object === "whatsapp_business_account")?.callback_url?.trim() || "";
    } catch {
      currentUrl = null;
    }

    if (currentUrl === null) {
      notes.push("No pude leer el callback de la app; no lo reemplazo");
    } else if (currentUrl && !sameCallback(currentUrl, callbackUrl)) {
      notes.push("La app ya tiene otro callback; no lo reemplazo");
    } else {
      await metaRequest(
        env,
        `${appId}/subscriptions`,
        "POST",
        new URLSearchParams({
          object: "whatsapp_business_account",
          callback_url: callbackUrl,
          verify_token: env.verifyToken,
          fields: "messages,message_template_status_update",
        }),
        token,
      );
      callbackReady = true;
    }
  }

  try {
    await metaRequest(env, env.phoneNumberId, "POST", {
      webhook_configuration: {
        override_callback_uri: callbackUrl,
        verify_token: env.verifyToken,
      },
    });
    callbackReady = true;
  } catch (error) {
    if (!callbackReady) throw error;
    notes.push("Override del número no quedó; el callback de la app sigue activo");
  }

  if (callbackReady) {
    const parts = ["Webhook de Compruki activo"];
    if (wabaSubscribed) parts.push("app suscrita a la cuenta");
    return `${parts.join("; ")}${notes.length ? `. ${notes.join(". ")}` : ""}.`;
  }

  return (
    "Callback no confirmado por API. Deja «Suscribir webhooks» ON en Meta y prueba un mensaje entrante." +
    (notes.length ? ` ${notes.join(". ")}.` : "")
  );
}

function sameCallback(left: string, right: string) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    const path = (url: URL) => url.pathname.replace(/\/$/, "") || "/";
    return a.origin === b.origin && path(a) === path(b);
  } catch {
    return left === right;
  }
}

export async function listWhatsAppTemplates(env: MetaWaEnv): Promise<WhatsAppTemplateInfo[]> {
  if (!env.businessAccountId) return [];
  const result = await metaRequest(
    env,
    `${env.businessAccountId}/message_templates?limit=100&fields=id,name,language,status,category,rejected_reason,components`,
    "GET",
  );
  const rows = Array.isArray(result.data) ? result.data : [];
  return rows
    .filter((row) => row.name)
    .map((row) => ({
      id: String(row.id || ""),
      name: String(row.name || ""),
      language: String(row.language || ""),
      status: String(row.status || ""),
      category: String(row.category || ""),
      body: row.components?.find((part) => part.type === "BODY")?.text || "",
      rejectedReason: String(row.rejected_reason || ""),
    }));
}

/**
 * Envía una plantilla a revisión de Meta (misma lógica que ConexionIA).
 * POST /{waba-id}/message_templates
 */
export async function createWhatsAppTemplate(
  env: MetaWaEnv,
  input: {
    name: string;
    category: "MARKETING" | "UTILITY";
    language: string;
    body: string;
    variables: Array<{ position: number; example: string }>;
  },
): Promise<{ id: string | null; name: string; status: string }> {
  if (!env.businessAccountId) {
    throw new MetaApiError(422, "Falta META_WA_WABA_ID para crear plantillas.");
  }
  const name = input.name.trim().toLowerCase();
  if (!/^[a-z0-9_]{2,512}$/.test(name)) {
    throw new MetaApiError(
      422,
      "El nombre debe ser minúsculas, números o _ (ej. saludo_compruki).",
    );
  }
  const body = input.body.trim();
  if (!body) throw new MetaApiError(422, "Escribe el texto de la plantilla.");
  if (body.replace(/{{\d+}}/g, "").includes("{{") || body.replace(/{{\d+}}/g, "").includes("}}")) {
    throw new MetaApiError(422, "Usa variables numéricas con el formato {{1}}, {{2}}.");
  }
  if (/^{{\d+}}/.test(body) || /{{\d+}}$/.test(body)) {
    throw new MetaApiError(
      422,
      "Meta no permite una variable al inicio o al final. Añade texto antes y después.",
    );
  }
  const matches = [...body.matchAll(/{{(\d+)}}/g)].map((match) => Number(match[1]));
  const positions = [...new Set(matches)].sort((a, b) => a - b);
  if (positions.some((position, index) => position !== index + 1)) {
    throw new MetaApiError(422, "Las variables deben comenzar en {{1}} y continuar sin saltos.");
  }
  const provided = [...input.variables].sort((a, b) => a.position - b.position);
  if (
    provided.length !== positions.length ||
    provided.some((variable, index) => variable.position !== positions[index])
  ) {
    throw new MetaApiError(422, "Completa un ejemplo para cada variable {{n}} del texto.");
  }
  if (provided.some((variable) => !variable.example.trim())) {
    throw new MetaApiError(422, "Los ejemplos de variable no pueden ir vacíos.");
  }

  const bodyComponent: Record<string, unknown> = { type: "BODY", text: body };
  if (provided.length) {
    bodyComponent.example = { body_text: [provided.map((variable) => variable.example.trim())] };
  }
  const result = await metaRequest(env, `${env.businessAccountId}/message_templates`, "POST", {
    name,
    language: input.language.trim() || "es",
    category: input.category,
    allow_category_change: true,
    components: [bodyComponent],
  });
  return { id: result.id ? String(result.id) : null, name, status: "PENDING" };
}

/** Baja un archivo de Meta por media_id (URL temporal ~5 min). */
export async function downloadWhatsAppMedia(env: MetaWaEnv, mediaId: string) {
  const id = mediaId.trim();
  if (!id) throw new MetaApiError(422, "Falta el media_id de Meta.");
  const path = `${id}?phone_number_id=${encodeURIComponent(env.phoneNumberId)}`;
  const meta = await metaRequest(env, path, "GET");
  const url = typeof meta.url === "string" ? meta.url : "";
  const mimeType =
    typeof meta.mime_type === "string" && meta.mime_type
      ? meta.mime_type
      : "application/octet-stream";
  if (!url) throw new MetaApiError(502, "Meta no devolvió URL de media.");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${env.accessToken}` },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch {
    throw new MetaApiError(502, "No fue posible descargar el archivo de Meta.");
  }
  if (!response.ok) {
    throw new MetaApiError(502, "Meta rechazó la descarga del archivo.");
  }
  return {
    bytes: await response.arrayBuffer(),
    mimeType: response.headers.get("content-type") || mimeType,
  };
}
