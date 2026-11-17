import type { Metadata } from "next";
import { ProductEditorPage } from "@/components/panel/product-editor-page";
import { requirePanelAccess } from "@/server/panel-auth";

export const metadata: Metadata = {
  title: "Nuevo producto",
  description: "Alta manual de un producto del catálogo. Importar desde Dropi sigue pendiente de autorización.",
};

export const dynamic = "force-dynamic";

export default async function NewCatalogProductPage() {
  const access = await requirePanelAccess();
  return <ProductEditorPage product={null} canManageCommerce={access.role === "owner"} />;
}
