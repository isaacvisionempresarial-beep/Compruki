import type { Metadata } from "next";
import { StatusPage } from "@/components/status-page";

export const metadata: Metadata = {
  title: "No encontrada",
  description:
    "Esta página no existe en COMPRUKI. Puedes abrir la tienda o entrar al panel. Dropi no está conectado.",
};

export default function NotFound() {
  return (
    <main id="contenido" tabIndex={-1} className="min-h-dvh bg-canvas outline-none">
      <StatusPage
        showBrand
        eyebrow="COMPRUKI"
        title="Esta página no está"
        body="La dirección no corresponde a una pantalla de la tienda ni del panel. No se creó ni se borró nada. Dropi no está conectado."
        actions={[
          { href: "/tienda", label: "Ir a la tienda", primary: true },
          { href: "/ingresar", label: "Entrar al panel" },
        ]}
        asideItems={[
          {
            label: "Tienda",
            text: "Catálogo público, carrito y consulta de pedidos con número y celular.",
          },
          {
            label: "Panel",
            text: "Pedidos, sincronización, catálogo y rentabilidad de la tienda piloto.",
          },
          {
            label: "Dropi",
            text: "No está conectado. Desde aquí no se crea un pedido en Dropi.",
          },
        ]}
      />
    </main>
  );
}
