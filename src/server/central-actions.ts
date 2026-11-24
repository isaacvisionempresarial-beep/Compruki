"use server";

import { redirect } from "next/navigation";
import { routeTask } from "@/server/agent-central";
import { agentDeniedRedirect, evaluateAgentPolicy } from "@/server/agent-policy";
import { recordAgentRun } from "@/server/agent-runs";
import { assertPanelAccess } from "@/server/panel-auth";

export async function routeCentralAction(formData: FormData) {
  const access = await assertPanelAccess();
  if (!access) redirect("/ingresar");

  const intent = String(formData.get("intent") ?? "").trim();
  if (!intent) redirect("/panel/agentes");

  const policy = await evaluateAgentPolicy("AG-01");
  if (!policy.ok) {
    await recordAgentRun({
      agentId: "AG-01",
      status: "cancelled",
      summary: policy.reason,
      createdBy: access.user.id,
      actorName: access.actorName,
    });
    redirect(agentDeniedRedirect("AG-01", policy.reason, { intent }));
  }

  const result = await routeTask(intent);
  const via = result.via === "openai" ? "openai" : "reglas";
  const summary = [
    `Central ${via}`,
    `Intención: ${result.intent}`,
    `Agentes: ${result.agents.join(", ")}`,
    ...result.summary.slice(0, 6),
  ].join(" · ");

  await recordAgentRun({
    agentId: "AG-01",
    status: "succeeded",
    summary,
    costEstimateCop: result.costEstimateCop,
    createdBy: access.user.id,
    actorName: access.actorName,
  });

  redirect(`/panel/agentes?intent=${encodeURIComponent(intent)}`);
}
