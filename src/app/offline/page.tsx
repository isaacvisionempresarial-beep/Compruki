import type { Metadata } from "next";
import { OfflineScreen } from "@/components/offline-screen";

export const metadata: Metadata = {
  title: "Sin conexión",
  description:
    "No hay red. El carrito del navegador puede seguir en el dispositivo. No se confirma ni se envía un pedido.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return <OfflineScreen />;
}
