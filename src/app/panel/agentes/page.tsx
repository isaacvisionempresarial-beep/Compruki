import type { Metadata } from "next";
import { AgentsScreen } from "@/components/panel/agents-screen";
import { routeTask } from "@/server/agent-central";
import { buildTemplateDrafts, listContentDrafts, listDraftableProducts } from "@/server/agent-content";
import { searchLocalCatalog } from "@/server/agent-explorer";
import { getAgentCenterView } from "@/server/agent-gateway";
import { getAnalystToolkit } from "@/server/agent-tools";

export const metadata: Metadata = {
  title: "Centro de agentes",
  description: "Esqueleto P0-IA. OpenAI no está conectado. Dropi no está conectado.",
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

  const [view, analyst, explorer, products, packed, saved, central] = await Promise.all([
    getAgentCenterView(),
    getAnalystToolkit(),
    searchLocalCatalog(params.q ?? "", params.categoria ?? ""),
    listDraftableProducts(),
    selectedSku ? buildTemplateDrafts(selectedSku) : Promise.resolve(null),
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
    />
  );
}
