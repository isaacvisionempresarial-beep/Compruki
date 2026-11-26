import type { Metadata } from "next";
import { Dashboard } from "@/components/panel/dashboard";
import { bogotaNow } from "@/lib/catalog";
import { listPendingApprovals } from "@/server/agent-central";
import { getAgentHomeBrief } from "@/server/agent-gateway";
import { listOrders } from "@/server/order-store";
import { listCostGuides, listPriceGuides, listSizeGuides } from "@/server/catalog-store";
import { getOpsSnapshot } from "@/server/ops-snapshot";
import { hasPermission, requirePanelAccess } from "@/server/panel-auth";

export const metadata: Metadata = {
  title: "Panel",
  description: "Resumen de la tienda piloto: pedidos, colas de trabajo y muestra. Dropi no está conectado.",
};

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const access = await requirePanelAccess();
  const today = bogotaNow().slice(0, 10);
  const greetingName = access.actorName.split(/\s+/)[0] || access.actorName;
  const [storeOrders, sizeGuides, priceGuides, costGuides, pendingApprovals, agentHome, ops] =
    await Promise.all([
      listOrders(),
      listSizeGuides(),
      listPriceGuides(),
      listCostGuides(),
      listPendingApprovals(),
      getAgentHomeBrief(),
      getOpsSnapshot(access.tenantId, access.user.id),
    ]);

  const pendingSummary = {
    total: pendingApprovals.length,
    pedidos: pendingApprovals.filter((item) => item.kind === "pedido").length,
    borradores: pendingApprovals.filter((item) => item.kind === "borrador").length,
    agentes: pendingApprovals.filter((item) => item.kind === "agente").length,
    preguntas: pendingApprovals.filter((item) => item.kind === "pregunta").length,
    seguimientos: pendingApprovals.filter((item) => item.kind === "seguimiento").length,
    preview: pendingApprovals.slice(0, 4).map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.label,
      detail: item.detail,
      href: item.href ?? "/panel/agentes#pendientes-humanos",
    })),
  };

  return (
    <Dashboard
      storeOrders={storeOrders}
      sizeGuides={sizeGuides}
      priceGuides={priceGuides}
      costGuides={costGuides}
      today={today}
      greetingName={greetingName}
      canManageOrderMoney={hasPermission(access, "orders_money")}
      canApproveCatalog={hasPermission(access, "catalog_manage")}
      agentPendingCount={pendingSummary.total}
      agentPendingSummary={pendingSummary}
      agentHome={agentHome}
      ops={ops}
    />
  );
}
