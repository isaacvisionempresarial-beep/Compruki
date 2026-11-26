import type { Metadata } from "next";
import { SyncScreen } from "@/components/panel/sync-screen";
import { readDropiQueue } from "@/server/dropi-connection";
import { listOrders } from "@/server/order-store";
import { hasPermission, requirePanelAccess } from "@/server/panel-auth";

export const metadata: Metadata = {
  title: "Sincronización",
  description:
    "Dropi no está conectado. Copia la entrega y anota el número a mano. Anotarlo no crea el pedido en Dropi.",
};
export const dynamic = "force-dynamic";

export default async function SyncPage() {
  const access = await requirePanelAccess();
  const [orders, queue] = await Promise.all([listOrders(), readDropiQueue()]);
  return (
    <SyncScreen
      orders={orders}
      jobs={queue.jobs}
      tableReady={queue.connection.tableReady}
      tableDetail={queue.connection.detail}
      canEnqueue={hasPermission(access, "store_settings") && queue.connection.tableReady}
    />
  );
}
