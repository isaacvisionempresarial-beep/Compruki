import type { Metadata } from "next";
import { OfflineScreen } from "@/components/offline-screen";

export const metadata: Metadata = {
  title: "Sin conexión",
  description:
    "No hay red. Dropi no está conectado ni se sincroniza. El carrito del navegador puede seguir en el dispositivo.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return <OfflineScreen />;
}
