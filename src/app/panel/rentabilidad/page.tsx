import type { Metadata } from "next";
import { ProfitabilityScreen } from "@/components/panel/profitability-screen";
import { bogotaNow } from "@/lib/catalog";
import { listProducts } from "@/server/catalog-store";
import { listOrders } from "@/server/order-store";

export const metadata: Metadata = {
  title: "Rentabilidad",
  description:
    "Margen estimado y utilidad realizada por producto y período. El margen no es dinero cobrado. Dropi no está conectado.",
};

export const dynamic = "force-dynamic";

export default async function ProfitabilityPage() {
  const today = bogotaNow().slice(0, 10);
  return <ProfitabilityScreen products={await listProducts()} orders={await listOrders()} today={today} />;
}
