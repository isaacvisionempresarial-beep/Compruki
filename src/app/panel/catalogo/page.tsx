import type { Metadata } from "next";
import { CatalogScreen } from "@/components/panel/catalog-screen";
import { listProducts } from "@/server/catalog-store";
import { listOrders } from "@/server/order-store";
import { hasPermission, requirePanelAccess } from "@/server/panel-auth";
import { listOpenProductQuestionCountBySku } from "@/server/product-questions";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Fichas, precios, costos y publicación de lo que se vende. Importar desde Dropi sigue pendiente.",
};

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const params = await searchParams;
  const filtro = params.filtro?.trim() ?? "todos";
  const initialFilter =
    filtro === "diferencia" ||
    filtro === "preguntas" ||
    filtro === "tienda" ||
    filtro === "agotados" ||
    filtro === "ocultos"
      ? filtro
      : "todos";
  const [products, orders, access, openQuestionCounts] = await Promise.all([
    listProducts(),
    listOrders(),
    requirePanelAccess(),
    listOpenProductQuestionCountBySku(),
  ]);
  return (
    <CatalogScreen
      products={products}
      orders={orders}
      canManageCommerce={hasPermission(access, "catalog_manage")}
      openQuestionCounts={openQuestionCounts}
      initialFilter={initialFilter}
    />
  );
}
