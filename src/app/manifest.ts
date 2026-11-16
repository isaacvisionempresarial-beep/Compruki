import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/tienda",
    name: "COMPRUKI",
    short_name: "COMPRUKI",
    description: "Tu negocio, en modo venta. Pagas al recibir. Dropi no está conectado.",
    start_url: "/tienda",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f8fc",
    theme_color: "#222638",
    lang: "es-CO",
    dir: "ltr",
    categories: ["shopping", "business"],
    prefer_related_applications: false,
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/icono/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icono/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icono/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
