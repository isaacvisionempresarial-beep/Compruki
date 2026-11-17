import type { Metadata } from "next";
import { Dashboard } from "@/components/panel/dashboard";
import { bogotaNow } from "@/lib/catalog";
import { listSizeGuides } from "@/server/catalog-store";
import { listOrders } from "@/server/order-store";
import { requirePanelAccess } from "@/server/panel-auth";

export const metadata: Metadata = {
  title: "Panel",
  description: "Resumen de la tienda piloto: pedidos, colas de trabajo y muestra. Dropi no está conectado.",
};

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const access = await requirePanelAccess();
  const today = bogotaNow().slice(0, 10);
  const greetingName = access.actorName.split(/\s+/)[0] || access.actorName;
  return (
    <Dashboard
      storeOrders={await listOrders()}
      sizeGuides={await listSizeGuides()}
      today={today}
      greetingName={greetingName}
    />
  );
}
