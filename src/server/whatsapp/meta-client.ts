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
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  messages?: Array<{ id?: string }>;
  data?:
    | Array<{
        name?: string;
        language?: string;
        status?: string;
        category?: string;
        object?: string;
        callback_url?: string;
        app_id?: string;
        is_valid?: boolean;
      }>
    | { app_id?: string; is_valid?: boolean };
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
  if (!env.businessAccountId) {
    throw new MetaApiError(
      422,
      "Falta META_WA_WABA_ID. Sin la cuenta de WhatsApp, Meta no entrega webhooks.",
    );
  }

  await metaRequest(env, `${env.businessAccountId}/subscribed_apps`, "POST");

  const notes = ["App suscrita a la cuenta de WhatsApp"];
  let callbackReady = false;
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
          fields: "messages",
        }),
        token,
      );
      notes.push("Callback de la app registrado");
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
    notes.push("Callback del número apuntando a Compruki");
    callbackReady = true;
  } catch (error) {
    if (!callbackReady) throw error;
    const message = error instanceof Error ? error.message : "el override del número falló";
    notes.push(`Override del número no quedó: ${message}`);
  }

  if (!callbackReady) {
    throw new MetaApiError(
      422,
      "La cuenta quedó suscrita, pero el callback no apunta a Compruki. Revisa META_WA_APP_ID y el verify token.",
    );
  }
  return `${notes.join(". ")}.`;
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

export async function listWhatsAppTemplates(env: MetaWaEnv) {
  if (!env.businessAccountId) return [];
  const result = await metaRequest(
    env,
    `${env.businessAccountId}/message_templates?limit=50&fields=name,language,status,category`,
    "GET",
  );
  return Array.isArray(result.data) ? result.data : [];
}
