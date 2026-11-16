import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PanelShell } from "@/components/panel/panel-shell";
import { SESSION_COOKIE, SESSION_VALUE } from "@/lib/session";

const panelDescription =
  "Panel de la tienda piloto. Catálogo, pedidos, sincronización y margen. Dropi no está conectado.";

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
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    redirect("/ingresar");
  }

  return <PanelShell>{children}</PanelShell>;
}
