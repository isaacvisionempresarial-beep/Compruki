"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { PublicProduct } from "@/server/catalog-store";
import { useCart } from "@/components/store/cart-state";
import { formatCop } from "@/lib/format";
import { rememberCampaignSku } from "@/lib/campaign";
import { sizeChoiceSentence } from "@/lib/catalog";
import { answerProductQuestion, productQuestionNeedsHandoff } from "@/lib/product-answers";
import { PhotoCarousel, type PhotoSlide } from "@/components/photo-carousel";
import {
  sendProductQuestionAction,
  type SendProductQuestionState,
} from "@/server/product-question-actions";

type HighlightPiece =
  | { kind: "heading"; text: string }
  | { kind: "benefit"; title: string; detail: string }
  | { kind: "text"; text: string };

function highlightPieces(source: string): HighlightPiece[] {
  return source
    .split(/\r?\n\s*\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((block) => {
      const singleLine = !/[\r\n]/.test(block);
      const colon = block.indexOf(":");
      if (singleLine && colon > 0 && colon <= 80) {
        const title = block.slice(0, colon).trim();
        const detail = block.slice(colon + 1).trim();
        if (title && detail) return { kind: "benefit", title, detail };
      }
      const words = block.split(/\s+/).filter(Boolean).length;
      if (singleLine && colon === -1 && words <= 7 && block.length <= 60) return { kind: "heading", text: block };
      return { kind: "text", text: block };
    });
}

function renderHighlightPieces(pieces: HighlightPiece[]) {
  const nodes: ReactNode[] = [];
  let index = 0;
  while (index < pieces.length) {
    const piece = pieces[index];
    if (piece.kind === "heading") {
      nodes.push(
        <h3 key={index} className="pt-1 text-base font-extrabold tracking-tight">
          {piece.text}
        </h3>,
      );
      index += 1;
      continue;
    }
    if (piece.kind === "text") {
      nodes.push(
        <p key={index} className="text-sm leading-5 text-muted">
          {piece.text}
        </p>,
      );
      index += 1;
      continue;
    }
    const start = index;
    const rows: Extract<HighlightPiece, { kind: "benefit" }>[] = [];
    while (index < pieces.length && pieces[index].kind === "benefit") {
      rows.push(pieces[index] as Extract<HighlightPiece, { kind: "benefit" }>);
      index += 1;
    }
    nodes.push(
      <ul key={start} className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-card">
        {rows.map((row) => (
          <li key={`${start}-${row.title}`} className="px-3 py-2">
            <p className="text-sm font-bold text-ink">{row.title}</p>
            <p className="mt-0.5 text-sm leading-5 text-muted">{row.detail}</p>
          </li>
        ))}
      </ul>,
    );
  }
  return nodes;
}

export function ProductScreen({ product, fromCampaign = false }: { product: PublicProduct; fromCampaign?: boolean }) {
  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState("");
  const [variantError, setVariantError] = useState(false);
  const [added, setAdded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [photo, setPhoto] = useState(0);
  const slides: PhotoSlide[] = product.images.map((image, index) => ({
    key: image.id,
    src: `/tienda/imagen/${product.sku}?m=${image.id}`,
    alt: index === 0 ? product.title : "",
  }));
  const cart = useCart();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buyFormId = useId();

  useEffect(() => {
    if (fromCampaign) rememberCampaignSku(product.sku);
  }, [fromCampaign, product.sku]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lightboxOpen) {
      if (typeof dialog.showModal === "function") dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [lightboxOpen]);

  const descriptionParagraphs = product.description
    .split(/\r?\n\s*\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const descriptionIsLong = descriptionParagraphs.length > 1 || product.description.trim().length > 220;
  const pieces = highlightPieces(product.highlights);
  useEffect(() => {
    const root = document.documentElement;
    if (pieces.length > 0) root.dataset.fichaBeneficios = "1";
    else delete root.dataset.fichaBeneficios;
    return () => {
      delete root.dataset.fichaBeneficios;
    };
  }, [pieces.length]);
  const sizeLabelCap = product.sizeKind === "tamano" ? "Tamaño" : "Talla";
  const needsSizeChoice = product.variants.length > 0 && Boolean(product.sizeKind) && !product.variants.includes(variant);
  const canBuy = !needsSizeChoice;
  const already = cart.ready
    ? (cart.lines.find((line) => line.sku === product.sku && line.variant === variant)?.quantity ?? 0)
    : 0;
  const nextQuantity = Math.min(5, already + quantity);
  const capped = already + quantity > 5;

  function addToCart() {
    if (needsSizeChoice) {
      setVariantError(true);
      return;
    }
    cart.add(product.sku, quantity, variant, product.sizeKind ?? undefined);
    setAdded(true);
    router.push("/tienda/carrito");
  }

  function goCheckout() {
    if (needsSizeChoice) {
      setVariantError(true);
      return;
    }
    cart.add(product.sku, quantity, variant, product.sizeKind ?? undefined);
    setAdded(true);
    router.push("/tienda/pagar");
  }

  return (
    <article>
      <nav className="flex items-center gap-2 overflow-hidden text-xs text-muted whitespace-nowrap" aria-label="Ruta">
        <span>Inicio</span>
        <span aria-hidden="true">/</span>
        {product.category ? (
          <>
            <span>{product.category}</span>
            <span aria-hidden="true">/</span>
          </>
        ) : null}
        <strong className="truncate font-bold text-ink">{product.title}</strong>
      </nav>
      <nav aria-label="Vista" className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
        <Link
          href="/tienda"
          title="Volver al inicio no registra pedido ni cobra."
          className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
        >
          Volver a la tienda
        </Link>
      </nav>
      <p className="mt-2 text-xs leading-5 text-muted">Volver no registra pedido ni cobra.</p>

      <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,28rem)]">
        <section className="elevate-1 store-hero rounded-[14px] border border-line px-3 py-3" aria-label="Información principal del producto">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Ficha</p>
          <h1 className="mt-1 text-[24px] leading-7 font-extrabold tracking-tight">{product.title}</h1>
          <p className="mt-1 text-xs text-muted">{`Tienda piloto${product.category ? ` · ${product.category}` : ""}.`}</p>
          <p className="mt-1 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">SKU {product.sku}</p>
          {descriptionParagraphs.length > 0 ? (
            <>
            <p className="mt-2 text-sm leading-5 text-muted">
              {descriptionIsLong ? descriptionParagraphs[0] : product.description.trim()}
            </p>
            {descriptionIsLong ? (
              <nav aria-label="Vista" className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
                <a href="#descripcion" title="Leerla no cambia el precio publicado ni crea un pedido." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
                  Leer la descripción completa
                </a>
              </nav>
            ) : null}
            <p className="mt-1 text-xs leading-5 text-muted">Leerla no cambia el precio publicado ni crea un pedido.</p>
            </>
          ) : null}

          <div className="mt-2 border-y border-line py-2">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Precio publicado</p>
            <p className="mt-0.5 text-lg font-extrabold tracking-tight tabular-nums">{formatCop(product.price)}</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Pagas al recibir. Envío aparte. No es dinero cobrado. Dropi no está conectado.
            </p>
          </div>

          {product.available ? (
            <form
              id={buyFormId}
              className="mt-2 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                addToCart();
              }}
            >
              {product.variants.length > 0 && product.sizeKind ? (
                <fieldset>
                  <legend className="w-full">
                    <span className="block text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Elección</span>
                    <span className="mt-0.5 flex items-baseline justify-between gap-3">
                      <span className="text-sm font-bold">
                        {sizeLabelCap}:{" "}
                        <span className="font-semibold text-muted">{variant || "elige uno"}</span>
                      </span>
                      <span className="text-[11px] font-normal text-muted">El precio no cambia. Elegirlo no cobra.</span>
                    </span>
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {product.variants.map((name) => {
                      const selected = variant === name;
                      return (
                        <label
                          key={name}
                          className={`inline-flex cursor-pointer items-center rounded-[10px] border px-3 py-2 text-sm font-bold transition-colors ${
                            selected
                              ? "border-primary bg-accent-tint text-ink shadow-[0_0_0_1px_#222638]"
                              : "border-line bg-card text-muted hover:border-primary-soft"
                          }`}
                        >
                          <input
                            type="radio"
                            name="variant"
                            value={name}
                            checked={selected}
                            title={
                              product.sizeKind === "tamano"
                                ? "Elegirlo no cambia el precio publicado ni crea un pedido."
                                : "Elegirla no cambia el precio publicado ni crea un pedido."
                            }
                            className="sr-only"
                            onChange={() => {
                              setVariant(name);
                              setVariantError(false);
                            }}
                          />
                          {product.sizeKind === "tamano" ? `Tamaño ${name}` : `Talla ${name}`}
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted" role="status">
                    {needsSizeChoice
                      ? `Elige ${product.sizeKind === "tamano" ? "el tamaño" : "la talla"} para poder pedir. El precio no cambia. Todavía no es un pedido.`
                      : sizeChoiceSentence(product.sizeKind, variant)}
                  </p>
                  {variantError ? (
                    <p role="alert" className="mt-1.5 text-sm font-medium text-danger">
                      {product.sizeKind === "tamano" ? "Elige el tamaño." : "Elige la talla."}
                    </p>
                  ) : null}
                </fieldset>
              ) : null}

              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold" htmlFor="cantidad">
                    Cantidad
                  </label>
                  <div className="flex h-10 overflow-hidden rounded-[10px] border border-line bg-card focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(37,199,165,0.12)]">
                    <button
                      type="button"
                      className="h-full w-10 border-0 bg-card text-xl text-muted hover:bg-accent-tint focus-visible:bg-accent-tint"
                      aria-label="Disminuir cantidad"
                      title="Cambiarla no registra pedido ni cobra."
                      onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    >
                      −
                    </button>
                    <input
                      id="cantidad"
                      title="Cambiarla no registra pedido ni cobra."
                      type="number"
                      min={1}
                      max={5}
                      value={quantity}
                      onChange={(event) => setQuantity(Math.min(5, Math.max(1, Number(event.target.value) || 1)))}
                      className="w-11 border-0 bg-card text-center text-sm font-bold tabular-nums outline-none"
                    />
                    <button
                      type="button"
                      className="h-full w-10 border-0 bg-card text-xl text-muted hover:bg-accent-tint focus-visible:bg-accent-tint"
                      aria-label="Aumentar cantidad"
                      title="Cambiarla no registra pedido ni cobra."
                      onClick={() => setQuantity((current) => Math.min(5, current + 1))}
                    >
                      +
                    </button>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted">Cambiarla no registra pedido ni cobra.</p>
                </div>
                <div className="pb-1 text-xs leading-5 text-muted">
                  <p className="font-extrabold text-ink">Envío aparte</p>
                  <p>Según tu ciudad y dirección. Sin fecha prometida. No se cobra aquí.</p>
                </div>
              </div>
              {canBuy && cart.ready ? (
                <p className="text-xs leading-5 text-muted">
                  {`Quedarán ${nextQuantity} ${nextQuantity === 1 ? "unidad" : "unidades"} · ${formatCop(product.price * nextQuantity)} al recibir${already > 0 ? ` (ya había ${already})` : ""}${capped ? " · máx. 5" : ""}. No registra pedido ni es dinero cobrado.`}
                </p>
              ) : null}

              <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
                <button
                  type="button"
                  disabled={!canBuy}
                  title="Pedirlo lleva al pago. No confirma el pedido ni cobra."
                  className="inline-flex h-9 w-full items-center justify-center sm:w-auto sm:min-w-56 rounded-[10px] bg-primary px-4 text-sm font-extrabold text-on-dark transition-colors enabled:hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-55"
                  onClick={goCheckout}
                >
                  {needsSizeChoice
                    ? product.sizeKind === "tamano"
                      ? "Elige el tamaño"
                      : "Elige la talla"
                    : "Pedir · pagas al recibir"}
                </button>
                <button
                  type="submit"
                  disabled={!canBuy}
                  title="Agregarlo no registra pedido ni cobra."
                  className="inline-flex h-9 w-full items-center justify-center sm:w-auto sm:min-w-56 rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink transition-colors enabled:hover:border-accent enabled:hover:bg-accent-tint disabled:cursor-not-allowed disabled:opacity-55"
                >
                  Agregar al carrito
                </button>
              </nav>
              <p className="text-xs leading-5 text-muted">Pedirlo lleva al pago. No confirma el pedido ni cobra. Agregarlo no registra pedido ni cobra.</p>
              {added ? (
                <p className="text-sm text-accent-strong" role="status">
                  Quedó en el carrito. No registra pedido ni es dinero cobrado.
                </p>
              ) : null}
            </form>
          ) : (
            <div className="mt-3 rounded-[10px] bg-coral-tint px-3 py-2">
              <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Estado</p>
              <p className="mt-0.5 text-sm font-semibold text-coral-strong">
                Este producto está publicado, pero ahora no se puede pedir. El precio publicado no cambia.
              </p>
            </div>
          )}

          <div className="mt-2 border-t border-line pt-2">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">En esta compra</p>
            <ul className="mt-2 space-y-2 text-sm leading-5">
              <li>
                <span className="font-semibold">Pagas al recibir</span>
                <span className="mt-0.5 block text-xs text-muted">Es el precio publicado. Nadie cobra aquí. El envío se acuerda aparte.</span>
              </li>
              <li>
                <span className="font-semibold">Información clara</span>
                <span className="mt-0.5 block text-xs text-muted">Solo lo escrito en esta ficha. Dropi no está conectado.</span>
              </li>
            </ul>
          </div>
        </section>
        <div className="min-w-0">
          <div className="grid gap-3">
            {slides.length === 0 ? (
              <div className="grid min-h-36 place-items-center rounded-[14px] border border-line bg-subtle px-4 text-center">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
                  <p className="mt-0.5 text-sm font-semibold text-muted">Sin foto en la ficha</p>
                  <p className="mt-1 text-xs text-muted">El precio publicado no cambia. La ficha muestra solo lo revisado en el catálogo.</p>
                </div>
              </div>
            ) : (
              <PhotoCarousel
                slides={slides}
                label={`Fotos de ${product.title}`}
                frameClassName="aspect-[4/5] w-full max-h-[70vh] overflow-hidden rounded-[14px]"
                index={photo}
                onIndexChange={setPhoto}
                onOpen={() => setLightboxOpen(true)}
                priority
                corner={
                  <div className="pointer-events-none absolute top-4 left-4 z-10 rounded-[10px] bg-card/90 px-3 py-2 text-[10px] font-extrabold tracking-[0.08em] text-muted uppercase backdrop-blur-sm">
                    {product.available ? "Disponible para pedir" : "No se puede pedir ahora"}
                  </div>
                }
              />
            )}
            {product.hasVideo ? (
              <>
                <video controls preload="metadata" title="Verlo no cambia el precio publicado ni crea un pedido." className="max-h-[70vh] w-full rounded-[14px] bg-subtle" src={`/tienda/video/${product.sku}`}>
                  Tu navegador no reproduce este video.
                </video>
                <p className="text-xs leading-5 text-muted">Verlo no cambia el precio publicado ni crea un pedido.</p>
              </>
            ) : null}
          </div>
          <p className="mt-3 flex items-center gap-2 text-[11px] text-muted">
            <span aria-hidden="true">▣</span>
            {slides.length > 1
              ? "Fotos del catálogo, completas. Las flechas las pasan en el mismo espacio. Verlas no cambia el precio publicado ni crea un pedido."
              : slides.length === 1
                ? "Foto del catálogo, completa. Amplía para verla mejor. Verla no cambia el precio publicado ni crea un pedido."
                : "Cuando haya foto revisada, aparece aquí."}
          </p>        </div>
      </div>

      {pieces.length > 0 ? (
        <section id="lo-especial" className="elevate-1 mt-3 scroll-mt-16 rounded-[14px] border border-line bg-card px-3 py-3" aria-label="Características y beneficios">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Beneficios</p>
          <h2 className="mt-0.5 text-base font-extrabold tracking-tight">Características y beneficios</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted">Sale del catálogo. Si falta un dato, no se inventa. Leerlas no cambia el precio publicado ni crea un pedido.</p>
          <div className="mt-2 max-w-3xl space-y-2">{renderHighlightPieces(pieces)}</div>
        </section>
      ) : null}

      {descriptionIsLong ? (
        <section id="descripcion" className="elevate-1 mt-3 scroll-mt-16 rounded-[14px] border border-line bg-card px-3 py-3" aria-label="Descripción">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Texto</p>
          <h2 className="mt-0.5 text-base font-extrabold tracking-tight">Descripción</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted">Leerla no cambia el precio publicado ni crea un pedido.</p>
          <div className="mt-2 max-w-2xl space-y-2 text-sm leading-5 text-muted">
            {descriptionParagraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
            ))}
          </div>
          <nav aria-label="Vista" className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
            <a href="#detalles" title="Ir ahí no cambia el precio publicado ni crea un pedido." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
              Ver antes de pedir
            </a>
          </nav>
          <p className="mt-1 text-xs leading-5 text-muted">Ir ahí no cambia el precio publicado ni crea un pedido.</p>
        </section>
      ) : null}

      <div className="mt-3 scroll-mt-16 space-y-3">
        <section id="detalles" className="min-w-0" aria-label="Antes de pedir">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Ficha</p>
          <h2 className="mt-0.5 text-base font-extrabold tracking-tight">Antes de pedir</h2>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Envío", "No incluido. Se acuerda con la dirección. Sin fecha prometida. No se cobra aquí."],
              ["Pago", "Pagas al recibir el precio publicado. Nadie cobra aquí. El pedido queda pendiente de confirmación."],
              ["Cambios", "Se acuerdan con la tienda. No se inventa una política aquí. No cambia el precio publicado ni crea un pedido."],
              ["Dropi", "No está conectado. Esta ficha no crea pedido en Dropi."],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[14px] border border-line bg-card px-3 py-2">
                <dt className="text-sm font-bold text-ink">{label}</dt>
                <dd className="mt-0.5 text-xs leading-5 text-muted">{value}</dd>
              </div>
            ))}
          </dl>
          {product.answers ? (
            <div className="mt-3 rounded-[14px] border border-line bg-card px-3 py-2">
              <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Respuestas</p>
              <p className="mt-0.5 text-sm font-bold text-ink">Lo que puedes saber</p>
              <p className="mt-0.5 text-xs leading-5 whitespace-pre-line text-muted">{product.answers}</p>
              <p className="mt-1 text-xs leading-5 text-muted">Leerlas no cambia el precio publicado ni crea un pedido.</p>
            </div>
          ) : null}
        </section>

        <div id="preguntas" className="elevate-1 max-w-xl rounded-[14px] border border-line bg-card px-3 py-3">
          <ProductQuestion product={product} />
        </div>
      </div>

      <nav aria-label="Vista" className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
        <a href="#contenido" title="Volver al inicio de esta ficha no registra pedido ni cobra." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
          Volver al producto
        </a>
      </nav>
      <p className="mt-2 text-xs leading-5 text-muted">Volver al inicio de esta ficha no registra pedido ni cobra.</p>

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[90vh] w-[min(860px,90vw)] rounded-[14px] border-0 bg-card p-3 shadow-2xl backdrop:bg-primary-dark/70 backdrop:backdrop-blur-sm open:flex open:flex-col"
        title="Verla así no cambia el precio publicado ni crea un pedido."
        onClose={() => setLightboxOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setLightboxOpen(false);
        }}
        aria-label="Foto ampliada"
      >
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-[10px] border-0 bg-subtle text-2xl"
            aria-label="Cerrar"
            title="Cerrarla no cambia el precio publicado ni crea un pedido."
            onClick={() => setLightboxOpen(false)}
          >
            ×
          </button>
        </div>
        {slides.length > 0 ? (
          <PhotoCarousel
            slides={slides}
            label={`Fotos de ${product.title}`}
            frameClassName="h-[min(77vh,42rem)] w-full"
            singleClassName="mx-auto max-h-[77vh] w-full object-contain"
            roundedClassName="rounded-[14px]"
            index={photo}
            onIndexChange={setPhoto}
          />
        ) : null}
        <p className="mt-2 text-xs leading-5 text-muted">Verla así no cambia el precio publicado ni crea un pedido.</p>
      </dialog>
    </article>
  );
}

const handoffInitial: SendProductQuestionState = { error: null, message: null };

function ProductQuestion({ product }: { product: PublicProduct }) {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [handoffState, handoffAction, handoffPending] = useActionState(sendProductQuestionAction, handoffInitial);
  const canAsk = Boolean(question.trim());
  const needsHandoff = Boolean(reply && productQuestionNeedsHandoff(reply));

  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAsk) return;
    setReply(answerProductQuestion(product, question));
  }

  return (
    <section aria-labelledby="pregunta-producto">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Pregunta</p>
      <h3 id="pregunta-producto" className="mt-0.5 text-sm font-semibold">
        Pregunta sobre este producto
      </h3>
      <p className="mt-1 text-xs leading-5 text-muted">
        Primero responde con lo de esta ficha. Si no alcanza, puedes enviarla a la tienda para revisión humana. No
        registra pedido y no cobra.
      </p>
      <form className="mt-2 space-y-2" onSubmit={ask}>
        <label className="block text-xs font-semibold" htmlFor="pregunta">
          Tu pregunta
          <input
            id="pregunta"
            title="Preguntar aquí responde con la ficha. Enviar a la tienda es aparte y no cobra."
            value={question}
            maxLength={200}
            onChange={(event) => {
              setQuestion(event.target.value);
              setReply(null);
            }}
            className="mt-1.5 h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-sm font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
          />
        </label>
        <nav aria-label="Consulta" className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</span>
          <button
            type="submit"
            disabled={!canAsk}
            title="Preguntar responde con la ficha. No crea pedido ni cobra."
            className="inline-flex h-9 w-full items-center justify-center sm:w-auto sm:min-w-56 rounded-[10px] border border-line bg-card px-3 text-sm font-semibold hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-55"
          >
            Preguntar
          </button>
        </nav>
      </form>
      {reply ? (
        <p role="status" className="mt-3 text-xs leading-5 whitespace-pre-line text-ink">
          {reply}
        </p>
      ) : null}
      {needsHandoff && !handoffState.message ? (
        <form action={handoffAction} className="mt-2">
          <input type="hidden" name="sku" value={product.sku} />
          <input type="hidden" name="question" value={question.trim()} />
          <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
            <button
              type="submit"
              disabled={handoffPending || question.trim().length < 8}
              title="Enviarla deja la pregunta en la bandeja de la tienda. No crea pedido ni cobra."
              className="inline-flex h-9 w-full items-center justify-center sm:w-auto sm:min-w-56 rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-55"
            >
              {handoffPending ? "…" : "Enviar a la tienda"}
            </button>
          </nav>
        </form>
      ) : null}
      {handoffState.error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {handoffState.error}
        </p>
      ) : null}
      {handoffState.message ? (
        <p role="status" className="mt-2 text-xs font-medium text-accent-strong">
          {handoffState.message}
        </p>
      ) : null}
    </section>
  );
}
