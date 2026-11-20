"use client";

import { StatusPage } from "@/components/status-page";

export function OfflineScreen() {
  return (
    <main id="contenido" tabIndex={-1} className="min-h-dvh bg-canvas outline-none">
      <StatusPage
        showBrand
        eyebrow="Sin red"
        title="No hay conexión"
        body="Sin internet no cargan pantallas nuevas. No cobra. Dropi no está conectado ni se sincroniza. El carrito de este navegador puede seguir aquí; no se confirma ni se envía un pedido."
        actions={[
          { label: "Intentar de nuevo", title: "Reintentar no cobra ni registra un pedido.", primary: true, onClick: () => window.location.reload() },
          { href: "/tienda", label: "Ir a la tienda", title: "Abrirla no registra pedido ni cobra." },
        ]}
        asideTitle="Qué significa"
        asideItems={[
          {
            label: "Datos",
            text: "Lo que ya está en este navegador no se borra solo por quedarte sin red.",
          },
          {
            label: "Dropi",
            text: "No está conectado. Sin guía, fecha ni sync. No se inventa un estado.",
          },
          {
            label: "Cuando vuelva la red",
            text: "Reintenta o abre la tienda. No cobra. Las cifras y el catálogo se piden otra vez al servidor.",
          },
        ]}
      />
    </main>
  );
}
