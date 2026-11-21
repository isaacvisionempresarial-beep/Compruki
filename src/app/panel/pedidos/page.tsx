import type { Metadata } from "next";
import { bogotaNow } from "@/lib/catalog";
import { OrdersScreen } from "@/components/panel/orders-screen";
import { listPriceGuides, listSizeGuides } from "@/server/catalog-store";
import { listOrders } from "@/server/order-store";
import { requirePanelAccess } from "@/server/panel-auth";

export const metadata: Metadata = {
  title: "Pedidos",
  description: "Atender pedidos de la tienda: confirmar, anotar datos y seguir el estado. No envía nada a Dropi.",
};
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const [orders, sizeGuides, priceGuides, access] = await Promise.all([
    listOrders(),
    listSizeGuides(),
    listPriceGuides(),
    requirePanelAccess(),
  ]);
  return (
    <OrdersScreen orders={orders} sizeGuides={sizeGuides} priceGuides={priceGuides} canManageOrderMoney={access.role === "owner"} today={bogotaNow().slice(0, 10)} />
  );
}
