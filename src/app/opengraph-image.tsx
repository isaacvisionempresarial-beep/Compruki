import { ImageResponse } from "next/og";
import { ShareImage } from "@/components/brand/share-image";

export const alt = "COMPRUKI · Tu negocio, en modo venta. Pagas al recibir.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <ShareImage
        eyebrow="Piloto"
        title="Tu negocio, en modo venta"
        subtitle="Catálogo, pedidos y margen. Pagas al recibir. El pedido queda pendiente de confirmación."
      />
    ),
    { ...size },
  );
}
