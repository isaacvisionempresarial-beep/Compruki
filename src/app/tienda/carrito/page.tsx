import type { Metadata } from "next";
import { CartScreen } from "@/components/store/cart-screen";
import { listPublicProducts } from "@/server/catalog-store";
import { getCustomerSession } from "@/server/customer-auth";

export const metadata: Metadata = {
  title: "Carrito",
  description:
    "Revisa los productos antes de pedir. El total es de los precios publicados. El envío se confirma aparte.",
};
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [products, session] = await Promise.all([listPublicProducts(), getCustomerSession()]);
  const buyerName = session?.profile.displayName.trim() || session?.profile.email || null;
  return <CartScreen products={products} buyerName={buyerName} />;
}
