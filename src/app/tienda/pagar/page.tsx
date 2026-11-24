import type { Metadata } from "next";
import { CheckoutScreen } from "@/components/store/checkout-screen";
import { listPublicProducts } from "@/server/catalog-store";

export const metadata: Metadata = {
  title: "Confirmar pedido",
  description:
    "Datos de entrega y pago contra entrega. El pedido queda pendiente de confirmación. Nadie cobra en COMPRUKI.",
};
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  return <CheckoutScreen products={await listPublicProducts()} />;
}
