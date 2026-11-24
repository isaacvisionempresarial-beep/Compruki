"use server";

import { redirect } from "next/navigation";
import { generateContentDrafts } from "@/server/agent-content";
import { searchLocalCatalog } from "@/server/agent-explorer";
import { agentDeniedRedirect, evaluateAgentPolicy } from "@/server/agent-policy";
import { recordAgentRun } from "@/server/agent-runs";
import { generateAnalystReading } from "@/server/agent-tools";
import { assertPanelAccess } from "@/server/panel-auth";

function agentesRedirect(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const trimmed = value?.trim();
    if (trimmed) sp.set(key, trimmed);
  }
  const query = sp.toString();
  return query ? `/panel/agentes?${query}` : "/panel/agentes";
}

export async function searchExplorerAction(formData: FormData) {
  const access = await assertPanelAccess();
  if (!access) redirect("/ingresar");

  const q = String(formData.get("q") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();

  const policy = await evaluateAgentPolicy("AG-02");
  if (!policy.ok) {
    await recordAgentRun({
      agentId: "AG-02",
      status: "cancelled",
      summary: policy.reason,
      createdBy: access.user.id,
      actorName: access.actorName,
    });
    redirect(agentDeniedRedirect("AG-02", policy.reason, { q, categoria, sku }));
  }

  const shortlist = await searchLocalCatalog(q, categoria);
  const filters = [
    q ? `«${q}»` : null,
    categoria ? `categoría ${categoria}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  await recordAgentRun({
    agentId: "AG-02",
    status: "succeeded",
    summary: [
      "Explorador local",
      filters || "sin filtros",
      `${countWord(shortlist.results.length, "producto", "productos")} en shortlist`,
      "no cambia el catálogo",
      shortlist.sourceLabel,
    ].join(" · "),
    createdBy: access.user.id,
    actorName: access.actorName,
  });

  redirect(agentesRedirect({ q, categoria, sku }));
}

export async function generateContentDraftsAction(formData: FormData) {
  const access = await assertPanelAccess();
  if (!access) redirect("/ingresar");

  const sku = String(formData.get("sku") ?? "").trim().toUpperCase();
  const q = String(formData.get("q") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();

  if (!sku) redirect(agentesRedirect({ q, categoria }));

  const policy = await evaluateAgentPolicy("AG-03");
  if (!policy.ok) {
    await recordAgentRun({
      agentId: "AG-03",
      status: "cancelled",
      summary: policy.reason,
      createdBy: access.user.id,
      actorName: access.actorName,
    });
    redirect(agentDeniedRedirect("AG-03", policy.reason, { q, categoria, sku }));
  }

  const packed = await generateContentDrafts(sku);
  const channels = packed?.drafts.map((draft) => draft.channel) ?? [];
  const via = packed?.via ?? "plantilla";

  await recordAgentRun({
    agentId: "AG-03",
    status: packed ? "succeeded" : "failed",
    costEstimateCop: packed?.costEstimateCop ?? 0,
    summary: packed
      ? `Creador ${via} · ${sku} · ${channels.join(", ") || "ninguno"} · no se guardaron ni se publicaron. El precio no cambió`
      : `Creador · SKU ${sku} no encontrado en catálogo local`,
    createdBy: access.user.id,
    actorName: access.actorName,
  });

  redirect(agentesRedirect({ q, categoria, sku }));
}

export async function runAnalystAction(formData: FormData) {
  const access = await assertPanelAccess();
  if (!access) redirect("/ingresar");

  const focusSku = String(formData.get("marginSku") ?? "").trim().toUpperCase();
  const q = String(formData.get("q") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();

  const policy = await evaluateAgentPolicy("AG-04");
  if (!policy.ok) {
    await recordAgentRun({
      agentId: "AG-04",
      status: "cancelled",
      summary: policy.reason,
      createdBy: access.user.id,
      actorName: access.actorName,
    });
    redirect(agentDeniedRedirect("AG-04", policy.reason, { q, categoria, sku, marginSku: focusSku || undefined }));
  }

  const reading = await generateAnalystReading(focusSku || undefined);
  const via = reading.via === "openai" ? "openai" : "cifras";
  const missingFocus = Boolean(focusSku) && reading.bullets.some((line) => line.includes("no está en el catálogo"));

  await recordAgentRun({
    agentId: "AG-04",
    status: missingFocus ? "failed" : "succeeded",
    costEstimateCop: reading.costEstimateCop,
    summary: [
      `Analista ${via}`,
      focusSku ? `SKU ${focusSku}` : "catálogo completo",
      ...reading.bullets.slice(0, 3),
    ].join(" · "),
    createdBy: access.user.id,
    actorName: access.actorName,
  });

  redirect(agentesRedirect({ q, categoria, sku, marginSku: focusSku || undefined, lectura: "1" }));
}
