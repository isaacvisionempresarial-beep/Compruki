import { createHmac, timingSafeEqual } from "node:crypto";
import { requireMetaWaEnv } from "@/server/whatsapp/env";

/**
 * Firma Meta `X-Hub-Signature-256` sobre los bytes crudos del body.
 * Misma regla que ConexionIA (`rawBody`, no un JSON reordenado).
 */
export function verifyMetaSignature(
  appSecret: string,
  signatureHeader: string | null,
  rawBody: Uint8Array,
) {
  const signature = signatureHeader?.split(",")[0]?.trim() ?? "";
  if (!signature.startsWith("sha256=")) return false;
  const provided = Buffer.from(signature.slice("sha256=".length), "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/** Respuesta al GET de verificación. No toca base de datos. */
export function verifyWebhookChallenge(query: URLSearchParams): string | null {
  const mode = (query.get("hub.mode") || "").trim();
  const token = (query.get("hub.verify_token") || "").trim();
  const challenge = query.get("hub.challenge") || "";
  if (mode !== "subscribe" || !challenge || token.length < 8) return null;
  if (token !== requireMetaWaEnv().verifyToken) return null;
  return challenge;
}
