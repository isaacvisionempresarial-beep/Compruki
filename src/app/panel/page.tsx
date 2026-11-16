import type { Metadata } from "next";
import { Dashboard } from "@/components/panel/dashboard";
import { bogotaNow } from "@/lib/catalog";
import { listSizeGuides } from "@/server/catalog-store";
import { listOrders } from "@/server/order-store";

export const metadata: Metadata = {
  title: "Panel",
  description: "Resumen de la tienda piloto: pedidos, colas de trabajo y muestra. Dropi no está conectado.",
};

export const dynamic = "force-dynamic";

export default function PanelPage() {
  const today = bogotaNow().slice(0, 10);
  return <Dashboard storeOrders={listOrders()} sizeGuides={listSizeGuides()} today={today} />;
}
