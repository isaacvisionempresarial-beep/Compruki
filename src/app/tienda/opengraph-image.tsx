import { ImageResponse } from "next/og";
import { ShareImage } from "@/components/brand/share-image";

export const alt = "Tienda COMPRUKI · Pagas al recibir. Dropi no está conectado.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function StoreOpenGraphImage() {
  return new ImageResponse(
    (
      <ShareImage
        eyebrow="Tienda piloto · Colombia"
        title="Pagas al recibir"
        subtitle="Productos publicados. El pedido queda pendiente de confirmación. El envío se acuerda aparte."
      />
    ),
    { ...size },
  );
}
