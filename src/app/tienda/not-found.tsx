import type { Metadata } from "next";
import { StatusPage } from "@/components/status-page";

export const metadata: Metadata = {
  title: "No encontrado",
  description:
    "Ese producto o pedido no está en la tienda. Puedes volver al catálogo o consultar con número y celular.",
};

export default function StoreNotFound() {
  return (
    <StatusPage
      eyebrow="Tienda"
      title="No encontramos eso"
      body="El producto o el pedido no está publicado aquí, o el enlace ya no sirve. El carrito de este navegador no cambia. No cobra."
      actions={[
        { href: "/tienda", label: "Ver productos", title: "Verlos no cambia los precios publicados ni crea un pedido.", primary: true },
        { href: "/tienda/consultar", label: "Consultar un pedido", title: "Consultar no cobra ni cambia el total guardado." },
        { href: "/tienda/carrito", label: "Ver carrito", title: "Abrirlo no cobra ni registra un pedido." },
      ]}
      asideItems={[
        {
          label: "Productos",
          text: "Solo se muestran los publicados y revisados por la tienda. El precio publicado no cambia.",
        },
        {
          label: "Pedidos",
          text: "Se abren con el número y el celular de la entrega. Sin guía ni fecha exacta.",
        },
        {
          label: "Pago",
          text: "Nadie cobra en COMPRUKI. Pagas al recibir el precio publicado. Confirmar no cobra.",
        },
      ]}
    />
  );
}
