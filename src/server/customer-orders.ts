import { STATUS_LABEL } from "@/lib/demo-data";
import { formatCop } from "@/lib/format";
import { listOrders } from "@/server/order-store";

export type CustomerOrderSummary = {
  id: string;
  number: string;
  viewToken: string;
  statusLabel: string;
  totalLabel: string;
  createdAt: string;
};

export async function listOrdersForCustomer(userId: string): Promise<CustomerOrderSummary[]> {
  const orders = await listOrders();
  return orders
    .filter((order) => order.customerUserId === userId)
    .slice(0, 40)
    .map((order) => ({
      id: order.id,
      number: order.number,
      viewToken: order.viewToken,
      statusLabel: STATUS_LABEL[order.status] ?? order.status,
      totalLabel: formatCop(order.total),
      createdAt: order.createdAt,
    }));
}
