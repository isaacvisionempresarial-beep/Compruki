import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { OfflineNotice } from "@/components/offline-notice";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { siteOrigin } from "@/lib/site-url";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: "COMPRUKI",
    template: "%s · COMPRUKI",
  },
  description: "Tu negocio, en modo venta. Panel para catálogo, pedidos y margen. Pagas al recibir.",
  applicationName: "COMPRUKI",
  appleWebApp: { capable: true, title: "COMPRUKI", statusBarStyle: "default" },
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: "COMPRUKI",
    description: "Tu negocio, en modo venta. Panel para catálogo, pedidos y margen. Pagas al recibir.",
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "COMPRUKI",
    description: "Tu negocio, en modo venta. Pagas al recibir.",
  },
};

export const viewport: Viewport = {
  themeColor: "#222638",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO">
      <body className={`${jakarta.variable} ${outfit.variable} font-sans antialiased`}>
        <a className="skip-link" href="#contenido" title="Saltar no cobra ni cambia el carrito.">
          Saltar al contenido
        </a>
        <OfflineNotice />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
