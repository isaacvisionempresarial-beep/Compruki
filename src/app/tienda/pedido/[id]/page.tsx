import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmationScreen } from "@/components/store/confirmation-screen";
import { toCustomerOrder } from "@/lib/store-order";
import { listPublicProducts } from "@/server/catalog-store";
import { getOrder } from "@/server/order-store";
import { getStoreIdentity } from "@/server/store-identity";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { t } = await searchParams;
  const generic = {
    title: "Pedido",
    description:
      "Consulta el estado con el número del pedido y el celular de la entrega. Sin guía ni fecha exacta.",
    robots: { index: false, follow: false },
  } as const;
  if (!t?.trim()) return generic;
  const order = await getOrder(id);
  if (!order || order.viewToken !== t) return generic;
  return {
    title: `Pedido ${order.number}`,
    description: generic.description,
    robots: generic.robots,
  };
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; nuevo?: string; ya?: string }>;
}) {
  const { id } = await params;
  const { t, nuevo, ya } = await searchParams;
  const order = await getOrder(id);
  if (!order || !t || order.viewToken !== t) notFound();
  const [published, identity] = await Promise.all([listPublicProducts(), getStoreIdentity()]);
  const images = published
    .filter((product) => product.images.length > 0)
    .map((product) => ({ sku: product.sku, images: product.images }));
  const sizes = published.flatMap((product) =>
    product.sizeKind && product.variants.length > 0
      ? [{ sku: product.sku, sizeKind: product.sizeKind, variants: product.variants }]
      : [],
  );
  return (
    <ConfirmationScreen
      order={toCustomerOrder(order)}
      justPlaced={nuevo === "1"}
      repeated={ya === "1"}
      images={images}
      sizes={sizes}
      token={t}
      storeName={identity.name}
      storeWhatsapp={identity.whatsapp}
    />
  );
}
