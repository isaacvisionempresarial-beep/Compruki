import type { Metadata } from "next";
import { ConnectionsScreen } from "@/components/panel/connections-screen";
import { readDropiQueue } from "@/server/dropi-connection";
import { getHealthSnapshot } from "@/server/health";
import { hasPermission, requirePanelAccess } from "@/server/panel-auth";

export const metadata: Metadata = {
  title: "Conexiones",
  description: "Estado de Dropi, readiness y agentes. La tienda sigue sin marcarse como conectada a Dropi.",
};

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const [access, health, queue] = await Promise.all([requirePanelAccess(), getHealthSnapshot(), readDropiQueue()]);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "") || null;
  return (
    <ConnectionsScreen
      healthOk={health.ok}
      tenantPilotOk={health.checks.tenantPilot}
      openaiConnected={health.openaiConnected}
      openaiKeyConfigured={health.checks.openaiKey}
      connection={queue.connection}
      jobs={queue.jobs}
      canProbeOpenAI={hasPermission(access, "agents_manage")}
      siteUrl={siteUrl}
      plannedDomain="compruki.com"
    />
  );
}
