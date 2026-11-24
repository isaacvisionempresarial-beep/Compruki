import type { Metadata } from "next";
import { AgentsScreen } from "@/components/panel/agents-screen";
import { routeTask } from "@/server/agent-central";
import { getContentDraftPreview, listContentDrafts, listDraftableProducts } from "@/server/agent-content";
import { searchLocalCatalog } from "@/server/agent-explorer";
import { getAgentCenterView } from "@/server/agent-gateway";
import { getAnalystToolkit } from "@/server/agent-tools";
import { requirePanelAccess } from "@/server/panel-auth";

export const metadata: Metadata = {
  title: "Centro de agentes",
  description: "Esqueleto P0-IA. Agentes locales. Dropi no está conectado. OpenAI solo si hay clave y prueba OK.",
};

export const dynamic = "force-dynamic";

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    categoria?: string;
    sku?: string;
    intent?: string;
    agente?: string;
    agenteError?: string;
  }>;
}) {
  const params = await searchParams;
  const selectedSku = (params.sku ?? "").trim().toUpperCase();
  const intent = (params.intent ?? "").trim();
  const policyError =
    params.agenteError?.trim()
      ? { agentId: (params.agente ?? "").trim() || null, message: params.agenteError.trim() }
      : null;

  const [access, view, analyst, explorer, products, packed, saved, central] = await Promise.all([
    requirePanelAccess(),
    getAgentCenterView(),
    getAnalystToolkit(),
    searchLocalCatalog(params.q ?? "", params.categoria ?? ""),
    listDraftableProducts(),
    selectedSku ? getContentDraftPreview(selectedSku) : Promise.resolve(null),
    listContentDrafts(selectedSku || undefined),
    intent ? routeTask(intent) : Promise.resolve(null),
  ]);

  return (
    <AgentsScreen
      view={view}
      analyst={analyst}
      explorer={explorer}
      creator={{
        products,
        selectedSku,
        facts: packed?.facts ?? null,
        drafts: packed?.drafts ?? [],
        saved,
      }}
      central={{ route: central, defaultIntent: intent }}
      policyError={policyError}
      canApproveCatalog={access.role === "owner"}
      roleLabel={access.roleLabel}
    />
  );
}
