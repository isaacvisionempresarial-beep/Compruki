import { RouteLoading } from "@/components/route-loading";

export default function StoreLoading() {
  return (
    <RouteLoading
      eyebrow="Tienda"
      title="Cargando la tienda"
      hint="Estamos preparando esta pantalla. El carrito de este navegador no cambia. No registra pedido ni cobra. Dropi no está conectado."
    />
  );
}
