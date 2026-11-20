import type { Metadata } from "next";
import { StatusPage } from "@/components/status-page";

export const metadata: Metadata = {
  title: "No encontrado",
  description:
    "Ese pedido o producto no está en el panel. Puedes volver a pedidos o al catálogo. Dropi no está conectado.",
};

export default function PanelNotFound() {
  return (
    <StatusPage
      wide
      eyebrow="Panel"
      title="No está en este panel"
      body="El pedido o el producto no aparece con esa dirección. No se anotó ni se borró nada. No cobra ni cambia pedidos. Dropi no está conectado."
      actions={[
        { href: "/panel/pedidos", label: "Ir a pedidos", primary: true },
        { href: "/panel/catalogo", label: "Ir al catálogo" },
        { href: "/panel", label: "Panel principal" },
      ]}
      asideItems={[
        {
          label: "Pedidos",
          text: "Confirmar, anotar datos y seguir el estado. Dropi no está conectado.",
        },
        {
          label: "Catálogo",
          text: "Fichas, precios y publicación de lo que se vende en la tienda. Verlas no cobra ni cambia pedidos.",
        },
        {
          label: "Sincronización",
          text: "Dropi no está conectado. El número se anota a mano; anotarlo no crea el pedido ahí.",
        },
      ]}
    />
  );
}
