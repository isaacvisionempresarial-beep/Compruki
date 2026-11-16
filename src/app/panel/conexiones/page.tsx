import type { Metadata } from "next";
import { ConnectionsScreen } from "@/components/panel/connections-screen";

export const metadata: Metadata = {
  title: "Conexiones",
  description: "Estado de Dropi y consultas bloqueadas. La tienda sigue sin marcarse como conectada.",
};

export const dynamic = "force-dynamic";

export default function ConnectionsPage() {
  return <ConnectionsScreen />;
}
