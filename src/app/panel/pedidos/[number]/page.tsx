import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderEditor } from "@/components/panel/orders-screen";
import { getCustomerDraftPreview } from "@/server/agent-customer-draft";
import { getOrderPreparePreview } from "@/server/agent-order-prepare";
import { getOrderReadingPreview } from "@/server/agent-order-reading";
import { getSupportDraftPreview } from "@/server/agent-support-draft";
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
  searchParams: Promise<{
    lecturaPedido?: string;
    prepararPedido?: string;
    borradorMensaje?: string;
    borradorPosventa?: string;
    seguimiento?: string;
    seguimientoError?: string;
    agente?: string;
    agenteError?: string;
  }>;
}) {
  const { number } = await params;
  const query = await searchParams;
  const decoded = decodeURIComponent(number);
  const [orders, access, products, sizeGuides, costGuides, priceGuides, policy06, policy07, policy09] =
    await Promise.all([
      listOrders(),
      requirePanelAccess(),
      listOrderableProducts(),
      listSizeGuides(),
      listCostGuides(),
      listPriceGuides(),
      evaluateAgentPolicy("AG-06"),
      evaluateAgentPolicy("AG-07"),
      evaluateAgentPolicy("AG-09"),
    ]);
  const order = orders.find((item) => item.number === decoded);
  if (!order) notFound();

  const reading = query.lecturaPedido === "1" ? getOrderReadingPreview(order.number) : null;
  const prepare = query.prepararPedido === "1" ? getOrderPreparePreview(order.number) : null;
  const customerDraft = query.borradorMensaje === "1" ? getCustomerDraftPreview(order.number) : null;
  const supportDraft = query.borradorPosventa === "1" ? getSupportDraftPreview(order.number) : null;
  const agent = query.agente?.trim() ?? "";
  const agentError = query.agenteError?.trim() || null;
  const ag06Error = agent === "AG-06" ? agentError : null;
  const prepareFocused = query.prepararPedido === "1" || Boolean(ag06Error && !query.lecturaPedido);

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
      orderReadingEnabled={policy06.ok}
      orderReadingError={!prepareFocused ? ag06Error : null}
      orderPrepare={prepare}
      orderPrepareEnabled={policy06.ok}
      orderPrepareError={prepareFocused ? ag06Error : null}
      customerDraft={customerDraft}
      customerDraftEnabled={policy07.ok}
      customerDraftError={agent === "AG-07" ? agentError : null}
      supportDraft={supportDraft}
      supportDraftEnabled={policy09.ok}
      supportDraftError={agent === "AG-09" ? agentError : null}
      followupFlash={query.seguimiento === "1"}
      followupError={query.seguimientoError?.trim() || null}
    />
  );
}
