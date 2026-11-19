"use server";

import { redirect } from "next/navigation";
import { buildTemplateDrafts } from "@/server/agent-content";
import { searchLocalCatalog } from "@/server/agent-explorer";
import { agentDeniedRedirect, evaluateAgentPolicy } from "@/server/agent-policy";
import { recordAgentRun } from "@/server/agent-runs";
import { calculateMargin, comparePriceScenarios, getOrderFinancials } from "@/server/agent-tools";
import { assertPanelAccess } from "@/server/panel-auth";
import { formatCop } from "@/lib/format";

function countWord(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

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

  const packed = await buildTemplateDrafts(sku);
  const channels = packed?.drafts.map((draft) => draft.channel) ?? [];

  await recordAgentRun({
    agentId: "AG-03",
    status: packed ? "succeeded" : "failed",
    summary: packed
      ? `Creador plantilla · ${sku} · ${channels.join(", ") || "ninguno"} · no se guardaron ni se publicaron. El precio no cambió`
      : `Creador plantilla · SKU ${sku} no encontrado en catálogo local`,
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

  const [margins, scenarios, orders] = await Promise.all([
    calculateMargin(focusSku || undefined),
    comparePriceScenarios(focusSku || undefined),
    getOrderFinancials(),
  ]);

  const row = margins[0];
  const scenario = scenarios[0];
  const down = scenario?.scenarios[0];
  const up = scenario?.scenarios[2];

  const productNote = row
    ? focusSku
      ? `${row.sku}: margen estimado ${formatCop(row.margin)} sobre el precio de la ficha ${formatCop(row.price)}. No es dinero cobrado` +
        (down && up
          ? `. ±10 % ${formatCop(down.margin)} / ${formatCop(up.margin)}. No guarda el precio ni es utilidad realizada`
          : "")
      : `${margins.length} productos; ${margins.filter((m) => m.margin > 0).length} con margen estimado positivo de la ficha. No es dinero cobrado`
    : focusSku
      ? `SKU ${focusSku} no está en el catálogo local`
      : "Sin productos en catálogo";

  await recordAgentRun({
    agentId: "AG-04",
    status: row || !focusSku ? "succeeded" : "failed",
    summary: [
      "Analista rentabilidad",
      productNote,
      `Pedidos: margen estimado ${formatCop(orders.estimatedMargin)} (${countWord(orders.orderCount, "pedido", "pedidos")}). Lectura. No es utilidad realizada ni el total guardado`,
    ].join(" · "),
    createdBy: access.user.id,
    actorName: access.actorName,
  });

  redirect(agentesRedirect({ q, categoria, sku, marginSku: focusSku || undefined }));
}
