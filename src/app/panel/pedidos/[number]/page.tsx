import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderEditor } from "@/components/panel/orders-screen";
import { listCostGuides, listOrderableProducts, listSizeGuides } from "@/server/catalog-store";
import { listOrders } from "@/server/order-store";
import { requirePanelAccess } from "@/server/panel-auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await params;
  const order = (await listOrders()).find((item) => item.number === decodeURIComponent(number));
  return { title: order ? `Pedido ${order.number}` : "No encontrado" };
}

export default async function OrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const [orders, access, products, sizeGuides, costGuides] = await Promise.all([
    listOrders(),
    requirePanelAccess(),
    listOrderableProducts(),
    listSizeGuides(),
    listCostGuides(),
  ]);
  const order = orders.find((item) => item.number === decodeURIComponent(number));
  if (!order) notFound();
  return (
    <OrderEditor
      order={order}
      orders={orders}
      products={products}
      sizeGuides={sizeGuides}
      costGuides={costGuides}
      canManageOrderMoney={access.role === "owner"}
    />
  );
}
