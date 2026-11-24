"use server";

import { redirect } from "next/navigation";
import { orderFocusHref } from "@/lib/store-order";
import { generateCustomerMessageDraft } from "@/server/agent-customer-draft";
import { generateOrderReading } from "@/server/agent-order-reading";
import { generateSupportDraft } from "@/server/agent-support-draft";
import { evaluateAgentPolicy } from "@/server/agent-policy";
import { recordAgentRun } from "@/server/agent-runs";
import { assertPanelAccess } from "@/server/panel-auth";

function orderSectionHref(number: string, section: string, extra: Record<string, string> = {}) {
  const sp = new URLSearchParams(extra);
  const query = sp.toString();
  return `${orderFocusHref(number)}${query ? `?${query}` : ""}#${section}`;
}

function orderReadingHref(number: string, extra: Record<string, string> = {}) {
  return orderSectionHref(number, "pedido-lectura", extra);
}

export async function runOrderReadingAction(formData: FormData) {
  const access = await assertPanelAccess();
  if (!access) redirect("/ingresar");

  const number = String(formData.get("orderNumber") ?? "").trim();
  if (!number) redirect("/panel/pedidos");

  const policy = await evaluateAgentPolicy("AG-06");
  if (!policy.ok) {
    await recordAgentRun({
      agentId: "AG-06",
      status: "cancelled",
      summary: policy.reason,
      createdBy: access.user.id,
      actorName: access.actorName,
    });
    redirect(
      orderReadingHref(number, {
        agente: "AG-06",
        agenteError: policy.reason.slice(0, 280),
      }),
    );
  }

  const reading = await generateOrderReading(number);
  const via = reading?.via === "openai" ? "openai" : "cifras";

  await recordAgentRun({
    agentId: "AG-06",
    status: reading ? "succeeded" : "failed",
    costEstimateCop: reading?.costEstimateCop ?? 0,
    summary: reading
      ? [`Gestor ${via}`, reading.orderNumber, ...reading.bullets.slice(0, 2)].join(" · ")
      : `Gestor · pedido ${number} no encontrado`,
    createdBy: access.user.id,
    actorName: access.actorName,
  });

  redirect(orderReadingHref(number, { lecturaPedido: "1" }));
}

export async function runCustomerDraftAction(formData: FormData) {
  const access = await assertPanelAccess();
  if (!access) redirect("/ingresar");

  const number = String(formData.get("orderNumber") ?? "").trim();
  if (!number) redirect("/panel/pedidos");

  const policy = await evaluateAgentPolicy("AG-07");
  if (!policy.ok) {
    await recordAgentRun({
      agentId: "AG-07",
      status: "cancelled",
      summary: policy.reason,
      createdBy: access.user.id,
      actorName: access.actorName,
    });
    redirect(
      orderSectionHref(number, "pedido-mensaje", {
        agente: "AG-07",
        agenteError: policy.reason.slice(0, 280),
      }),
    );
  }

  const draft = await generateCustomerMessageDraft(number);
  const via = draft?.via === "openai" ? "openai" : "plantilla";

  await recordAgentRun({
    agentId: "AG-07",
    status: draft ? "succeeded" : "failed",
    costEstimateCop: draft?.costEstimateCop ?? 0,
    summary: draft
      ? [`Clientes ${via}`, draft.orderNumber, draft.text.slice(0, 120), "no se envió"].join(" · ")
      : `Clientes · pedido ${number} no encontrado`,
    createdBy: access.user.id,
    actorName: access.actorName,
  });

  redirect(orderSectionHref(number, "pedido-mensaje", { borradorMensaje: "1" }));
}

export async function runSupportDraftAction(formData: FormData) {
  const access = await assertPanelAccess();
  if (!access) redirect("/ingresar");

  const number = String(formData.get("orderNumber") ?? "").trim();
  if (!number) redirect("/panel/pedidos");

  const policy = await evaluateAgentPolicy("AG-09");
  if (!policy.ok) {
    await recordAgentRun({
      agentId: "AG-09",
      status: "cancelled",
      summary: policy.reason,
      createdBy: access.user.id,
      actorName: access.actorName,
    });
    redirect(
      orderSectionHref(number, "pedido-posventa", {
        agente: "AG-09",
        agenteError: policy.reason.slice(0, 280),
      }),
    );
  }

  const draft = await generateSupportDraft(number);
  const via = draft?.via === "openai" ? "openai" : "plantilla";

  await recordAgentRun({
    agentId: "AG-09",
    status: draft ? "succeeded" : "failed",
    costEstimateCop: draft?.costEstimateCop ?? 0,
    summary: draft
      ? [`Posventa ${via}`, draft.orderNumber, ...draft.bullets.slice(0, 2), "no resolvió solo"].join(" · ")
      : `Posventa · pedido ${number} no encontrado`,
    createdBy: access.user.id,
    actorName: access.actorName,
  });

  redirect(orderSectionHref(number, "pedido-posventa", { borradorPosventa: "1" }));
}
