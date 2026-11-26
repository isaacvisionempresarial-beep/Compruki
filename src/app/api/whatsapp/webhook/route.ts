import { NextResponse } from "next/server";
import { metaWaConfigured, requireMetaWaEnv } from "@/server/whatsapp/env";
import { verifyMetaSignature, verifyWebhookChallenge } from "@/server/whatsapp/signature";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function plain(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Length": String(Buffer.byteLength(body)),
    },
  });
}

/**
 * Verificación del webhook (Meta → Compruki).
 * Tiene que responder el challenge sin importar Supabase: si este GET se
 * cuelga, el edge devuelve 504 y Meta no guarda el callback.
 */
export async function GET(request: Request) {
  try {
    if (!metaWaConfigured()) {
      return plain("WhatsApp no configurado", 503);
    }
    const challenge = verifyWebhookChallenge(new URL(request.url).searchParams);
    if (!challenge) return plain("Forbidden", 403);
    return plain(challenge, 200);
  } catch {
    return plain("Forbidden", 403);
  }
}

/** Eventos entrantes (mensajes y estados de entrega). */
export async function POST(request: Request) {
  try {
    if (!metaWaConfigured()) {
      return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
    }
    const env = requireMetaWaEnv();
    const rawBody = new Uint8Array(await request.arrayBuffer());
    const signature = request.headers.get("x-hub-signature-256");
    if (!verifyMetaSignature(env.appSecret, signature, rawBody)) {
      return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const { processWhatsAppWebhook } = await import("@/server/whatsapp/webhook");
    const result = await processWhatsAppWebhook(payload as Parameters<typeof processWhatsAppWebhook>[0]);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "error_webhook";
    console.error("[whatsapp/webhook]", message);
    try {
      const { getPilotTenantId } = await import("@/server/tenant");
      const { upsertWhatsAppConnection } = await import("@/server/whatsapp/connection");
      const tenantId = await getPilotTenantId();
      await upsertWhatsAppConnection(tenantId, {
        status: "error",
        touchChecked: true,
        lastError: message.slice(0, 400),
        detail: "El webhook de Meta llegó, pero Compruki no pudo guardarlo. ¿Corriste la migración 018?",
      });
    } catch {
      /* no bloquear respuesta a Meta */
    }
    // Meta reintenta si no es 2xx; devolvemos 200 para no ciclar en errores de guardado.
    return NextResponse.json({ ok: true, accepted: true, deferred: true }, { status: 200 });
  }
}
