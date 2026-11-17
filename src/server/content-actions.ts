"use server";

import { revalidatePath } from "next/cache";
import { assertPanelAccess } from "@/server/panel-auth";
import { saveContentDraft, type ContentChannel } from "@/server/agent-content";

export type SaveDraftState = { error: string | null; message: string | null };

export async function saveContentDraftAction(_state: SaveDraftState, formData: FormData): Promise<SaveDraftState> {
  const access = await assertPanelAccess();
  if (!access) return { error: "Tu sesión no permite guardar borradores.", message: null };

  const channel = String(formData.get("channel") ?? "") as ContentChannel;
  const result = await saveContentDraft({
    sku: String(formData.get("sku") ?? ""),
    channel,
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    cta: String(formData.get("cta") ?? ""),
    createdBy: access.user.id,
  });

  if (result.error || !result.draft) {
    return { error: result.error ?? "No se pudo guardar el borrador.", message: null };
  }

  revalidatePath("/panel/agentes");
  return {
    error: null,
    message: `Borrador ${result.draft.channel} guardado para ${result.draft.productSku}.`,
  };
}
