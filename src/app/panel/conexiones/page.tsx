import type { Metadata } from "next";
import { ConnectionsScreen } from "@/components/panel/connections-screen";
import { getHealthSnapshot } from "@/server/health";

export const metadata: Metadata = {
  title: "Conexiones",
  description: "Estado de Dropi, readiness y agentes. La tienda sigue sin marcarse como conectada a Dropi.",
};

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const health = await getHealthSnapshot();
  return <ConnectionsScreen healthOk={health.ok} tenantPilotOk={health.checks.tenantPilot} />;
}
