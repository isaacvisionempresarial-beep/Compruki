import type { Metadata } from "next";
import { CartProvider } from "@/components/store/cart-state";
import { StoreShell } from "@/components/store/store-shell";

const storeDescription =
  "Tienda piloto en Colombia. Pagas al recibir. El pedido queda pendiente de confirmación. El envío se acuerda aparte.";

export const metadata: Metadata = {
  title: {
    default: "Tienda",
    template: "%s · COMPRUKI",
  },
  description: storeDescription,
  robots: { index: false, follow: false },
  openGraph: {
    title: "Tienda · COMPRUKI",
    description: "Pagas al recibir. El pedido queda pendiente de confirmación. El envío se acuerda aparte.",
    locale: "es_CO",
    type: "website",
    url: "/tienda",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tienda · COMPRUKI",
    description: "Pagas al recibir. El pedido queda pendiente de confirmación. El envío se acuerda aparte.",
  },
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <StoreShell>{children}</StoreShell>
    </CartProvider>
  );
}
