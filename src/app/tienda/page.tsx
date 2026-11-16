import type { Metadata } from "next";
import { StoreHome } from "@/components/store/store-home";
import { listPublicProducts } from "@/server/catalog-store";

export const metadata: Metadata = {
  title: "Tienda",
  description: "Productos publicados de la tienda piloto. Pagas al recibir. El envío se acuerda aparte. Dropi no está conectado.",
};
export const dynamic = "force-dynamic";

export default function StorePage() {
  return <StoreHome products={listPublicProducts()} />;
}
