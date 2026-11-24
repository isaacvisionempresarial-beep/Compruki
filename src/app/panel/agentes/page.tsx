import type { Metadata } from "next";
import { AgentsScreen } from "@/components/panel/agents-screen";
import { getCampaignDraftPreview } from "@/server/agent-campaign-draft";
import { routeTask } from "@/server/agent-central";
import { getContentDraftPreview, listContentDrafts, listDraftableProducts } from "@/server/agent-content";
import { getExplorerShortlistPreview, searchLocalCatalog } from "@/server/agent-explorer";
import { getAgentCenterView } from "@/server/agent-gateway";
import { getAnalystReadingPreview, getAnalystToolkit } from "@/server/agent-tools";
import { requirePanelAccess } from "@/server/panel-auth";

export const metadata: Metadata = {
  title: "Centro de agentes",
  description:
    "Centro P0-IA. OpenAI cuando responde; si no, reglas o plantilla local. Dropi no está conectado.",
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
    marginSku?: string;
    lectura?: string;
    explorado?: string;
    campanaSku?: string;
    campana?: string;
    agente?: string;
    agenteError?: string;
  }>;
}) {
  const params = await searchParams;
  const selectedSku = (params.sku ?? "").trim().toUpperCase();
  const campaignSku = (params.campanaSku ?? "").trim().toUpperCase();
  const marginSku = (params.marginSku ?? "").trim().toUpperCase();
  const intent = (params.intent ?? "").trim();
  const q = params.q ?? "";
  const categoria = params.categoria ?? "";
  const showReading = params.lectura === "1" || Boolean(marginSku);
  const policyError =
    params.agenteError?.trim()
      ? { agentId: (params.agente ?? "").trim() || null, message: params.agenteError.trim() }
      : null;

  const cachedExplorer =
    params.explorado === "1" ? getExplorerShortlistPreview(q, categoria) : null;

  const [access, view, analyst, explorerFallback, products, packed, saved, central] = await Promise.all([
    requirePanelAccess(),
    getAgentCenterView(),
    getAnalystToolkit(),
    cachedExplorer ? Promise.resolve(cachedExplorer) : searchLocalCatalog(q, categoria),
    listDraftableProducts(),
    selectedSku ? getContentDraftPreview(selectedSku) : Promise.resolve(null),
    listContentDrafts(selectedSku || undefined),
    intent ? routeTask(intent) : Promise.resolve(null),
  ]);

  const reading = showReading ? getAnalystReadingPreview(marginSku || undefined) : null;
  const explorer = cachedExplorer ?? explorerFallback;
  const campaignDraft = campaignSku ? getCampaignDraftPreview(campaignSku) : null;

  return (
    <AgentsScreen
      view={view}
      analyst={analyst}
      analystReading={reading}
      marginSku={marginSku}
      explorer={explorer}
      creator={{
        products,
        selectedSku,
        facts: packed?.facts ?? null,
        drafts: packed?.drafts ?? [],
        saved,
      }}
      campaign={{
        products,
        selectedSku: campaignSku,
        draft: campaignDraft,
      }}
      central={{ route: central, defaultIntent: intent }}
      policyError={policyError}
      canApproveCatalog={access.role === "owner"}
      roleLabel={access.roleLabel}
    />
  );
}
