"use server";

import { redirect } from "next/navigation";
import { orderFocusHref } from "@/lib/store-order";
import { generateOrderReading } from "@/server/agent-order-reading";
import { evaluateAgentPolicy } from "@/server/agent-policy";
import { recordAgentRun } from "@/server/agent-runs";
import { assertPanelAccess } from "@/server/panel-auth";

function orderReadingHref(number: string, extra: Record<string, string> = {}) {
  const sp = new URLSearchParams(extra);
  const query = sp.toString();
  return `${orderFocusHref(number)}${query ? `?${query}` : ""}#pedido-lectura`;
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
