import type { Metadata } from "next";
import { WhatsAppScreen } from "@/components/panel/whatsapp-screen";
import { requirePanelAccess } from "@/server/panel-auth";
import { loadWhatsAppPanelData } from "@/server/whatsapp-actions";

export const metadata: Metadata = {
  title: "WhatsApp",
  description: "Conexión Meta Cloud API, webhook y envío de prueba para operadores del panel.",
};

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const access = await requirePanelAccess();
  const data = await loadWhatsAppPanelData();
  return (
    <WhatsAppScreen
      connection={data.connection}
      recent={data.recent}
      webhookUrl={data.webhookUrl}
      roleLabel={access.roleLabel}
    />
  );
}
