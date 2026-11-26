/** Cliente Graph API WhatsApp (referencia ConexionIA, adaptado a Compruki). */

import type { MetaWaEnv } from "@/server/whatsapp/env";

const DEFAULT_TIMEOUT_MS = 12_000;

export type MetaJson = {
  error?: { message?: string; code?: number };
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  messages?: Array<{ id?: string }>;
  data?: Array<{
    name?: string;
    language?: string;
    status?: string;
    category?: string;
  }>;
};

export class MetaApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "MetaApiError";
    this.status = status;
  }
}

async function sleepMs(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function metaRequest(
  env: Pick<MetaWaEnv, "accessToken" | "graphVersion">,
  path: string,
  method: "GET" | "POST",
  payload?: unknown,
): Promise<MetaJson> {
  let lastNetworkError = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`https://graph.facebook.com/${env.graphVersion}/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${env.accessToken}`,
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
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
      const detail = data.error?.message?.replace(/\s+/g, " ").trim().slice(0, 240);
      const status = response.status >= 400 && response.status < 500 ? 422 : 502;
      throw new MetaApiError(
        status,
        detail ? `Meta rechazó la solicitud: ${detail}` : "Meta rechazó la solicitud. Revisa token e IDs.",
      );
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

export async function listWhatsAppTemplates(env: MetaWaEnv) {
  if (!env.businessAccountId) return [] as NonNullable<MetaJson["data"]>;
  const result = await metaRequest(
    env,
    `${env.businessAccountId}/message_templates?limit=50&fields=name,language,status,category`,
    "GET",
  );
  return result.data ?? [];
}
