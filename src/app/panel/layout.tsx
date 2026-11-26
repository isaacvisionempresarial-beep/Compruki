import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PanelShell } from "@/components/panel/panel-shell";
import { hasPermission, requirePanelAccess } from "@/server/panel-auth";
import { countInboxUnread } from "@/server/whatsapp-inbox";

const panelDescription =
  "Panel de COMPRUKÍ. Catálogo, pedidos, sincronización y margen.";

export const metadata: Metadata = {
  title: {
    default: "Panel",
    template: "%s · COMPRUKI",
  },
  description: panelDescription,
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: "Panel · COMPRUKI",
    description: panelDescription,
    url: "/panel",
  },
  twitter: {
    card: "summary",
    title: "Panel · COMPRUKI",
    description: panelDescription,
  },
};

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const access = await requirePanelAccess();
  const inboxUnread = hasPermission(access, "whatsapp_manage")
    ? await countInboxUnread(access.tenantId).catch(() => 0)
    : 0;
  return (
    <PanelShell
      storeName={access.tenantName}
      actorName={access.actorName}
      roleLabel={access.roleLabel}
      initials={access.initials}
      canManageUsers={hasPermission(access, "users_manage")}
      inboxUnread={inboxUnread}
    >
      {children}
    </PanelShell>
  );
}
