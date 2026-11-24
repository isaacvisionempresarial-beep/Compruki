"use server";

import { redirect } from "next/navigation";
import { orderFocusHref } from "@/lib/store-order";
import { generateFollowupPriority } from "@/server/agent-followup-priority";
import { evaluateAgentPolicy } from "@/server/agent-policy";
import { recordAgentRun } from "@/server/agent-runs";
import { isFollowupStageId, normalizeFollowupStage } from "@/lib/crm-pipeline";
import { createFollowup, moveFollowupStage, resolveFollowup } from "@/server/followups";
import { assertPanelAccess } from "@/server/panel-auth";

function clientesRedirect(extra: Record<string, string> = {}) {
  const sp = new URLSearchParams(extra);
  const query = sp.toString();
  return query ? `/panel/clientes?${query}` : "/panel/clientes";
}

export async function createFollowupAction(formData: FormData) {
  const access = await assertPanelAccess();
  if (!access) redirect("/ingresar");

  const phone = String(formData.get("phone") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const orderNumber = String(formData.get("orderNumber") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const stage = normalizeFollowupStage(String(formData.get("stage") ?? "nuevo"));
  const from = String(formData.get("from") ?? "").trim();

  const result = await createFollowup({
    phone,
    customerName,
    orderNumber,
    note,
    stage,
    createdBy: access.actorName,
  });

  if (from === "pedido" && orderNumber) {
    if (result.error) {
      redirect(
        `${orderFocusHref(orderNumber)}?seguimientoError=${encodeURIComponent(result.error.slice(0, 200))}#pedido-crm`,
      );
    }
    redirect(`${orderFocusHref(orderNumber)}?seguimiento=1#pedido-crm`);
  }

  if (result.error) {
    redirect(clientesRedirect({ error: result.error.slice(0, 200) }));
  }
  redirect(clientesRedirect({ creado: "1" }));
}

export async function resolveFollowupAction(formData: FormData) {
  const access = await assertPanelAccess();
  if (!access) redirect("/ingresar");

  const id = String(formData.get("id") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "done").trim();
  const status = statusRaw === "dismissed" ? "dismissed" : "done";

  const result = await resolveFollowup({
    id,
    status,
    resolvedBy: access.actorName,
  });

  if (result.error) {
    redirect(clientesRedirect({ error: result.error.slice(0, 200) }));
  }
  redirect(clientesRedirect({ cerrado: "1" }));
}

export async function moveFollowupStageAction(formData: FormData) {
  const access = await assertPanelAccess();
  if (!access) redirect("/ingresar");

  const id = String(formData.get("id") ?? "").trim();
  const stageRaw = String(formData.get("stage") ?? "").trim();
  if (!isFollowupStageId(stageRaw)) {
    redirect(clientesRedirect({ error: "Etapa no válida." }));
  }

  const result = await moveFollowupStage({ id, stage: stageRaw });
  if (result.error) {
    redirect(clientesRedirect({ error: result.error.slice(0, 200) }));
  }
  redirect(clientesRedirect({ movido: "1" }));
}

export async function prioritizeFollowupsAction() {
  const access = await assertPanelAccess();
  if (!access) redirect("/ingresar");

  const policy = await evaluateAgentPolicy("AG-07");
  if (!policy.ok) {
    await recordAgentRun({
      agentId: "AG-07",
      status: "cancelled",
      summary: policy.reason,
      createdBy: access.user.id,
      actorName: access.actorName,
    });
    redirect(clientesRedirect({ agente: "AG-07", agenteError: policy.reason.slice(0, 280) }));
  }

  const pack = await generateFollowupPriority();
  const via = pack.via === "openai" ? "openai" : "plantilla";

  await recordAgentRun({
    agentId: "AG-07",
    status: "succeeded",
    costEstimateCop: pack.costEstimateCop,
    summary: [
      `Clientes priorizar ${via}`,
      `${pack.suggestions.length} sugerencia(s)`,
      "no creó tareas ni envió",
    ].join(" · "),
    createdBy: access.user.id,
    actorName: access.actorName,
  });

  redirect(clientesRedirect({ prioridad: "1" }));
}

export async function createSuggestedFollowupAction(formData: FormData) {
  const access = await assertPanelAccess();
  if (!access) redirect("/ingresar");

  const phone = String(formData.get("phone") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const orderNumber = String(formData.get("orderNumber") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const stage = normalizeFollowupStage(String(formData.get("stage") ?? "nuevo"));

  const result = await createFollowup({
    phone,
    customerName,
    orderNumber,
    note,
    stage,
    createdBy: access.actorName,
  });

  if (result.error) {
    redirect(clientesRedirect({ error: result.error.slice(0, 200), prioridad: "1" }));
  }
  redirect(clientesRedirect({ creado: "1", prioridad: "1" }));
}
