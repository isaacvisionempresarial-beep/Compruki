import { hasPermission, requirePanelAccess } from "@/server/panel-auth";
import { getInboxMessageById } from "@/server/whatsapp-inbox";
import { requireMetaWaEnv } from "@/server/whatsapp/env";
import { downloadWhatsAppMedia, MetaApiError } from "@/server/whatsapp/meta-client";

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
  try {
    const env = requireMetaWaEnv();
    const file = await downloadWhatsAppMedia(env, message.mediaId);
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mimeType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status = error instanceof MetaApiError ? error.status : 502;
    const text =
      error instanceof Error ? error.message : "No se pudo descargar el archivo de Meta.";
    return new Response(text, { status: status === 422 ? 404 : status });
  }
}
