import type { Metadata } from "next";
import { OrdersScreen } from "@/components/panel/orders-screen";
import { listSizeGuides } from "@/server/catalog-store";
import { listOrders } from "@/server/order-store";

export const metadata: Metadata = {
  title: "Pedidos",
  description: "Atender pedidos de la tienda: confirmar, anotar datos y seguir el estado. No envía nada a Dropi.",
};
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  return <OrdersScreen orders={await listOrders()} sizeGuides={await listSizeGuides()} />;
}
