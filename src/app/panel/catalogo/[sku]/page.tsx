import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductEditorPage } from "@/components/panel/product-editor-page";
import { getCatalogProduct } from "@/server/catalog-store";
import { countOrdersForSku } from "@/server/order-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }): Promise<Metadata> {
  const { sku } = await params;
  const product = getCatalogProduct(sku);
  return { title: product ? product.title : "No encontrado" };
}

export default async function CatalogProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const product = getCatalogProduct(sku);
  if (!product) notFound();
  return <ProductEditorPage product={product} relatedOrderCount={countOrdersForSku(product.sku)} />;
}
