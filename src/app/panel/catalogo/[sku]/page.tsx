import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductEditorPage } from "@/components/panel/product-editor-page";
import { getCatalogProduct } from "@/server/catalog-store";
import { skuCostPreviewNote } from "@/lib/store-order";
import { countOrdersForSku, listOrders, storedLinesForSku } from "@/server/order-store";
import { hasPermission, requirePanelAccess } from "@/server/panel-auth";
import { listOpenProductQuestionsForSku } from "@/server/product-questions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }): Promise<Metadata> {
  const { sku } = await params;
  const product = await getCatalogProduct(sku);
  return { title: product ? product.title : "No encontrado" };
}

export default async function CatalogProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const [product, access] = await Promise.all([getCatalogProduct(sku), requirePanelAccess()]);
  if (!product) notFound();
  const [relatedOrderCount, storedLines, orders, openQuestions] = await Promise.all([
    countOrdersForSku(product.sku),
    storedLinesForSku(product.sku),
    listOrders(),
    listOpenProductQuestionsForSku(product.sku),
  ]);
  const costPreview = skuCostPreviewNote(
    orders.filter((order) => order.lines.some((line) => line.sku === product.sku)),
    product.sku,
    { sku: product.sku, cost: product.cost, shipping: product.shipping, commissions: product.commissions },
  );
  return (
    <ProductEditorPage
      product={product}
      relatedOrderCount={relatedOrderCount}
      storedLines={storedLines}
      costPreview={costPreview}
      canManageCommerce={hasPermission(access, "catalog_manage")}
      openQuestions={openQuestions}
    />
  );
}
