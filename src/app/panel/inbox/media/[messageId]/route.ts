import { hasPermission, requirePanelAccess } from "@/server/panel-auth";
import { getInboxMessageById } from "@/server/whatsapp-inbox";
import {
  loadCachedInboxMedia,
  saveCachedInboxMedia,
} from "@/server/whatsapp-inbox-media";
import { requireMetaWaEnv } from "@/server/whatsapp/env";
import { downloadWhatsAppMedia, MetaApiError } from "@/server/whatsapp/meta-client";

function mediaResponse(bytes: ArrayBuffer, mimeType: string, cached: boolean) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": cached ? "private, max-age=86400" : "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "X-Compruki-Media-Cache": cached ? "hit" : "miss",
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const access = await requirePanelAccess();
  if (!hasPermission(access, "whatsapp_manage")) {
    return new Response("Sin permiso", { status: 403 });
  }
  const { messageId } = await params;
  const message = await getInboxMessageById(access.tenantId, messageId).catch(() => null);
  if (!message?.mediaId) {
    return new Response("No encontrado", { status: 404 });
  }

  const cached = await loadCachedInboxMedia(access.tenantId, message.id);
  if (cached) return mediaResponse(cached.bytes, cached.mimeType, true);

  try {
    const env = requireMetaWaEnv();
    const file = await downloadWhatsAppMedia(env, message.mediaId);
    await saveCachedInboxMedia(access.tenantId, message.id, file.bytes, file.mimeType);
    return mediaResponse(file.bytes, file.mimeType, false);
  } catch (error) {
    const status = error instanceof MetaApiError ? error.status : 502;
    const text =
      error instanceof Error
        ? error.message
        : "No se pudo descargar el archivo de Meta.";
    return new Response(
      `${text} Si pasaron más de ~7 días y no hay copia local, Meta ya no lo entrega.`,
      { status: status === 422 ? 404 : status },
    );
  }
}
