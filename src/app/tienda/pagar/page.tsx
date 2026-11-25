import type { Metadata } from "next";
import { CheckoutScreen } from "@/components/store/checkout-screen";
import { listPublicProducts } from "@/server/catalog-store";
import { requireCustomerSession } from "@/server/customer-auth";

export const metadata: Metadata = {
  title: "Confirmar pedido",
  description:
    "Datos de entrega y pago contra entrega. El pedido queda pendiente de confirmación. Nadie cobra en COMPRUKI.",
};
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await requireCustomerSession("/tienda/pagar");
  return (
    <CheckoutScreen
      products={await listPublicProducts()}
      defaults={{
        customerName: session.profile.displayName,
        phone: session.profile.phone,
      }}
    />
  );
}
