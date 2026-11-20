import type { Metadata } from "next";
import { StatusPage } from "@/components/status-page";

export const metadata: Metadata = {
  title: "No encontrado",
  description:
    "Ese producto o pedido no está en la tienda. Puedes volver al catálogo o consultar con número y celular. Dropi no está conectado.",
};

export default function StoreNotFound() {
  return (
    <StatusPage
      eyebrow="Tienda"
      title="No encontramos eso"
      body="El producto o el pedido no está publicado aquí, o el enlace ya no sirve. El carrito de este navegador no cambia. No cobra. Dropi no está conectado."
      actions={[
        { href: "/tienda", label: "Ver productos", primary: true },
        { href: "/tienda/consultar", label: "Consultar un pedido" },
        { href: "/tienda/carrito", label: "Ver carrito" },
      ]}
      asideItems={[
        {
          label: "Productos",
          text: "Solo se muestran los publicados y revisados por la tienda. El precio publicado no cambia.",
        },
        {
          label: "Pedidos",
          text: "Se abren con el número y el celular de la entrega. Dropi no está conectado. Sin guía.",
        },
        {
          label: "Pago",
          text: "Nadie cobra en COMPRUKI. Pagas al recibir el precio publicado. Confirmar no cobra.",
        },
      ]}
    />
  );
}
