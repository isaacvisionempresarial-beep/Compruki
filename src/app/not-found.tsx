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
        body="La dirección no corresponde a una pantalla de la tienda ni del panel. No se creó ni se borró nada. El carrito de este navegador no cambia. No cobra. Dropi no está conectado."
        actions={[
          { href: "/tienda", label: "Ir a la tienda", title: "Abrirla no registra pedido ni cobra.", primary: true },
          { href: "/ingresar", label: "Entrar al panel", title: "Abrirlo no cobra ni cambia pedidos." },
        ]}
        asideItems={[
          {
            label: "Tienda",
            text: "Catálogo público, carrito y consulta de pedidos con número y celular.",
          },
          {
            label: "Panel",
            text: "Tienda, operación y sistema: pedidos, catálogo, rentabilidad, sincronización y agentes.",
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
