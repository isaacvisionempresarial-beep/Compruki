import { createAdminSupabase } from "@/lib/supabase/admin";

export const WHATSAPP_INBOX_MEDIA_BUCKET = "whatsapp-inbox-media";

function inboxMediaKey(tenantId: string, messageId: string) {
  return `${tenantId}/inbox/${messageId}`;
}

export async function loadCachedInboxMedia(
  tenantId: string,
  messageId: string,
): Promise<{ bytes: ArrayBuffer; mimeType: string } | null> {
  try {
    const supabase = createAdminSupabase();
    const { data, error } = await supabase.storage
      .from(WHATSAPP_INBOX_MEDIA_BUCKET)
      .download(inboxMediaKey(tenantId, messageId));
    if (error || !data) return null;
    return {
      bytes: await data.arrayBuffer(),
      mimeType: data.type || "application/octet-stream",
    };
  } catch {
    return null;
  }
}

export async function saveCachedInboxMedia(
  tenantId: string,
  messageId: string,
  bytes: ArrayBuffer,
  mimeType: string,
) {
  try {
    const supabase = createAdminSupabase();
    const type = mimeType.trim() || "application/octet-stream";
    const { error } = await supabase.storage
      .from(WHATSAPP_INBOX_MEDIA_BUCKET)
      .upload(inboxMediaKey(tenantId, messageId), bytes, {
        contentType: type,
        upsert: true,
      });
    if (error) return false;
    return true;
  } catch {
    return false;
  }
}
