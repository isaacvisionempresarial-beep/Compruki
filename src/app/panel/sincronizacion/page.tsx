import type { Metadata } from "next";
import { SyncScreen } from "@/components/panel/sync-screen";
import { listOrders } from "@/server/order-store";

export const metadata: Metadata = {
  title: "Sincronización",
  description:
    "Dropi no está conectado. Copia la entrega y anota el número a mano. Anotarlo no crea el pedido en Dropi.",
};
export const dynamic = "force-dynamic";

export default function SyncPage() {
  return <SyncScreen orders={listOrders()} />;
}
