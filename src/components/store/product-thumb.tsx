"use client";

import { useState } from "react";
import { PhotoCarousel } from "@/components/photo-carousel";
import { cx } from "@/lib/cx";

/** Miniatura o foto de catálogo; si el archivo falta, muestra Sin foto sin inventar imagen. */
export function CatalogPhoto({
  sku,
  alt,
  imgClassName,
  frameClassName,
  query,
  note,
  title,
}: {
  sku: string;
  alt: string;
  imgClassName: string;
  frameClassName?: string;
  query?: string;
  note?: string;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={cx("grid place-items-center bg-subtle px-2 text-center", frameClassName)}>
        <span title={title}>
          <span className="block text-xs font-semibold text-muted">Sin foto</span>
          {note ? <span className="mt-1 block text-[11px] leading-4 text-muted">{note}</span> : null}
        </span>
      </div>
    );
  }
  const src = query ? `/tienda/imagen/${sku}?${query}` : `/tienda/imagen/${sku}`;
  return (
    <div className={cx("overflow-hidden bg-subtle", frameClassName)}>
      {/* Ruta local dinámica + Sin foto en onError; next/image no aporta aquí. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} title={title} className={imgClassName} onError={() => setFailed(true)} />
    </div>
  );
}

export function ProductThumb({ sku, show }: { sku: string; show: boolean }) {
  if (!show) return null;
  return (
    <CatalogPhoto
      sku={sku}
      alt=""
      title="Verla no cambia el precio publicado ni crea un pedido."
      frameClassName="h-12 w-12 shrink-0 rounded-[10px]"
      imgClassName="h-12 w-12 rounded-[10px] bg-canvas object-contain"
    />
  );
}

export function LinePhotos({
  sku,
  title,
  images,
}: {
  sku: string;
  title: string;
  images: { id: string }[];
}) {
  if (images.length < 2) return null;
  return (
    <PhotoCarousel
      slides={images.map((image, index) => ({
        key: image.id,
        src: `/tienda/imagen/${sku}?m=${image.id}`,
        alt: index === 0 ? title : "",
      }))}
      label={`Fotos de ${title}`}
      frameClassName="h-32 w-full"
      roundedClassName="rounded-[10px]"
      compact
    />
  );
}
