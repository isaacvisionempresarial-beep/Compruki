import type { Metadata } from "next";
import { CatalogScreen } from "@/components/panel/catalog-screen";
import { listProducts } from "@/server/catalog-store";
import { listOrders } from "@/server/order-store";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Fichas, precios, costos y publicación de lo que se vende. Importar desde Dropi sigue pendiente.",
};

export const dynamic = "force-dynamic";

export default function CatalogPage() {
  return <CatalogScreen products={listProducts()} orders={listOrders()} />;
}
