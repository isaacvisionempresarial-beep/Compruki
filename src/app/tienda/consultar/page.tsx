import type { Metadata } from "next";
import { LookupScreen } from "@/components/store/lookup-screen";

const lookupDescription =
  "Consulta el estado con el número del pedido y el celular de la entrega. Consultar no cobra ni cambia el total guardado. Dropi no está conectado. Sin guía ni fecha exacta.";

export const metadata: Metadata = {
  title: "Consultar pedido",
  description: lookupDescription,
  robots: { index: false, follow: false },
  openGraph: {
    title: "Consultar pedido · COMPRUKI",
    description: lookupDescription,
    url: "/tienda/consultar",
  },
  twitter: {
    card: "summary_large_image",
    title: "Consultar pedido · COMPRUKI",
    description: lookupDescription,
  },
};

export default function LookupPage() {
  return <LookupScreen />;
}
