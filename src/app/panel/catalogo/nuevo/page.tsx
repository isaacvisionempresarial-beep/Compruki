import type { Metadata } from "next";
import { ProductEditorPage } from "@/components/panel/product-editor-page";

export const metadata: Metadata = {
  title: "Nuevo producto",
  description: "Alta manual de un producto del catálogo. Importar desde Dropi sigue pendiente de autorización.",
};

export const dynamic = "force-dynamic";

export default function NewCatalogProductPage() {
  return <ProductEditorPage product={null} />;
}
