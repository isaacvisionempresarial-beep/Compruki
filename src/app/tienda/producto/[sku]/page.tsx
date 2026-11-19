import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductScreen } from "@/components/store/product-screen";
import { formatCop } from "@/lib/format";
import { getPublicProduct } from "@/server/catalog-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }): Promise<Metadata> {
  const { sku } = await params;
  const product = await getPublicProduct(sku);
  if (!product) return { title: "No encontrado" };

  const blurb =
    product.description.trim() ||
    product.highlights
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ||
    "Pagas al recibir. El pedido queda pendiente de confirmación.";
  const availability = product.available ? "Disponible" : "No disponible";
  const description = `${product.title}. Precio publicado ${formatCop(product.price)}. Pagas al recibir. ${availability}. ${blurb} El envío se confirma aparte. Nadie cobra aquí. Dropi no está conectado.`.slice(
    0,
    300,
  );

  return {
    title: product.title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: `${product.title} · COMPRUKI`,
      description,
      url: `/tienda/producto/${encodeURIComponent(product.sku)}`,
      ...(product.hasImage ? { images: [`/tienda/imagen/${encodeURIComponent(product.sku)}`] } : {}),
    },
    twitter: {
      card: product.hasImage ? "summary_large_image" : "summary",
      title: `${product.title} · COMPRUKI`,
      description,
      ...(product.hasImage ? { images: [`/tienda/imagen/${encodeURIComponent(product.sku)}`] } : {}),
    },
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams: Promise<{ origen?: string }>;
}) {
  const { sku } = await params;
  const { origen } = await searchParams;
  const product = await getPublicProduct(sku);
  if (!product) notFound();
  return <ProductScreen product={product} fromCampaign={origen === "campana"} />;
}
