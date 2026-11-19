"use server";

import { revalidatePath } from "next/cache";
import { saveContentDraft, type ContentChannel } from "@/server/agent-content";
import { evaluateAgentPolicy } from "@/server/agent-policy";
import { recordAgentRun } from "@/server/agent-runs";
import { assertPanelAccess } from "@/server/panel-auth";

export type SaveDraftState = { error: string | null; message: string | null };

export async function saveContentDraftAction(_state: SaveDraftState, formData: FormData): Promise<SaveDraftState> {
  const access = await assertPanelAccess();
  if (!access) return { error: "Tu sesión no permite guardar borradores.", message: null };

  const channel = String(formData.get("channel") ?? "") as ContentChannel;
  const sku = String(formData.get("sku") ?? "");

  const policy = await evaluateAgentPolicy("AG-03");
  if (!policy.ok) {
    await recordAgentRun({
      agentId: "AG-03",
      status: "cancelled",
      summary: policy.reason,
      createdBy: access.user.id,
      actorName: access.actorName,
    });
    return { error: policy.reason, message: null };
  }

  const result = await saveContentDraft({
    sku,
    channel,
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    cta: String(formData.get("cta") ?? ""),
    createdBy: access.user.id,
    authorName: access.actorName,
  });

  if (result.error || !result.draft) {
    await recordAgentRun({
      agentId: "AG-03",
      status: "failed",
      summary: `Guardar borrador falló · ${sku || "sin SKU"} · ${channel || "sin canal"} · ${result.error ?? "error"}`,
      createdBy: access.user.id,
      actorName: access.actorName,
    });
    return { error: result.error ?? "No se pudo guardar el borrador.", message: null };
  }

  await recordAgentRun({
    agentId: "AG-03",
    status: "succeeded",
    summary: `Borrador guardado · pendiente revisión humana · no se publicó · el precio no cambió · ${result.draft.productSku} · ${result.draft.channel}`,
    createdBy: access.user.id,
    actorName: access.actorName,
  });

  revalidatePath("/panel/agentes");
  revalidatePath("/panel");
  return {
    error: null,
    message: `Borrador ${result.draft.channel} guardado para ${result.draft.productSku}. Quedó en Pendientes humanos. No se publicó. El precio no cambió.`,
  };
}
