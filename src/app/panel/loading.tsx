import { RouteLoading } from "@/components/route-loading";

export default function PanelLoading() {
  return (
    <RouteLoading
      wide
      eyebrow="Panel"
      title="Cargando el panel"
      hint="Estamos preparando esta pantalla. No se anota ni se confirma nada. No cobra. Dropi no está conectado."
    />
  );
}