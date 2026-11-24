import type { Metadata } from "next";
import { CartScreen } from "@/components/store/cart-screen";
import { listPublicProducts } from "@/server/catalog-store";

export const metadata: Metadata = {
  title: "Carrito",
  description:
    "Revisa los productos antes de pedir. El total es de los precios publicados. El envío se confirma aparte.",
};
export const dynamic = "force-dynamic";

export default async function CartPage() {
  return <CartScreen products={await listPublicProducts()} />;
}
