import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderEditor } from "@/components/panel/orders-screen";
import { getOrderReadingPreview } from "@/server/agent-order-reading";
import { evaluateAgentPolicy } from "@/server/agent-policy";
import { listCostGuides, listOrderableProducts, listPriceGuides, listSizeGuides } from "@/server/catalog-store";
import { listOrders } from "@/server/order-store";
import { requirePanelAccess } from "@/server/panel-auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await params;
  const order = (await listOrders()).find((item) => item.number === decodeURIComponent(number));
  return { title: order ? `Pedido ${order.number}` : "No encontrado" };
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ lecturaPedido?: string; agente?: string; agenteError?: string }>;
}) {
  const { number } = await params;
  const query = await searchParams;
  const decoded = decodeURIComponent(number);
  const [orders, access, products, sizeGuides, costGuides, priceGuides, policy] = await Promise.all([
    listOrders(),
    requirePanelAccess(),
    listOrderableProducts(),
    listSizeGuides(),
    listCostGuides(),
    listPriceGuides(),
    evaluateAgentPolicy("AG-06"),
  ]);
  const order = orders.find((item) => item.number === decoded);
  if (!order) notFound();

  const showReading = query.lecturaPedido === "1";
  const reading = showReading ? getOrderReadingPreview(order.number) : null;
  const orderReadingError =
    query.agente === "AG-06" && query.agenteError?.trim() ? query.agenteError.trim() : null;

  return (
    <OrderEditor
      order={order}
      orders={orders}
      products={products}
      sizeGuides={sizeGuides}
      priceGuides={priceGuides}
      costGuides={costGuides}
      canManageOrderMoney={access.role === "owner"}
      orderReading={reading}
      orderReadingEnabled={policy.ok}
      orderReadingError={orderReadingError}
    />
  );
}
