"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { PublicProduct } from "@/server/catalog-store";
import { useCart } from "@/components/store/cart-state";
import { formatCop } from "@/lib/format";
import { rememberCampaignSku } from "@/lib/campaign";
import { sizeChoiceSentence } from "@/lib/catalog";
import { answerProductQuestion } from "@/lib/product-answers";
import { PhotoCarousel, type PhotoSlide } from "@/components/photo-carousel";

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
        <Link href="/tienda" className="font-semibold hover:text-accent-strong">
          Inicio
        </Link>
        <span aria-hidden="true">/</span>
        {product.category ? (
          <>
            <span>{product.category}</span>
            <span aria-hidden="true">/</span>
          </>
        ) : null}
        <strong className="truncate font-bold text-ink">{product.title}</strong>
      </nav>

      <section className="mt-2 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]" aria-label="Información principal del producto">
        <div className="order-2 min-w-0 xl:order-1">
          <div className="grid gap-3">
            {slides.length === 0 ? (
              <div className="grid min-h-36 place-items-center rounded-[14px] border border-line bg-subtle px-4 text-center">
                <div>
                  <p className="text-sm font-semibold text-muted">Sin foto publicada</p>
                  <p className="mt-1 text-xs text-muted">La ficha muestra solo lo revisado en el catálogo.</p>
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
              <video controls preload="metadata" className="max-h-[70vh] w-full rounded-[14px] bg-subtle" src={`/tienda/video/${product.sku}`}>
                Tu navegador no reproduce este video.
              </video>
            ) : null}
          </div>
          <p className="mt-3 flex items-center gap-2 text-[11px] text-muted">
            <span aria-hidden="true">▣</span>
            {slides.length > 1
              ? "Fotos del catálogo, completas. Las flechas las pasan en el mismo espacio."
              : slides.length === 1
                ? "Foto del catálogo, completa. Amplía para verla mejor."
                : "Cuando haya foto revisada, aparece aquí."}
          </p>
        </div>

        <aside className="elevate-1 store-hero order-1 rounded-[14px] border border-line px-3 py-2 xl:sticky xl:top-[3rem] xl:order-2">
          <p className="text-[10px] font-bold tracking-[0.08em] text-accent-strong uppercase">
            Tienda piloto
            {product.category ? ` · ${product.category}` : ""}
          </p>
          <h1 className="mt-1 text-[24px] leading-7 font-extrabold tracking-tight">{product.title}</h1>
          <p className="mt-1 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">SKU {product.sku}</p>
          {descriptionParagraphs.length > 0 ? (
            <p className="mt-2 text-sm leading-5 text-muted">
              {descriptionIsLong ? descriptionParagraphs[0] : product.description.trim()}
              {descriptionIsLong ? (
                <>
                  {" "}
                  <a href="#descripcion" className="font-semibold text-accent-strong">
                    Leer la descripción completa
                  </a>
                </>
              ) : null}
            </p>
          ) : null}

          <div className="mt-2 border-y border-line py-2">
            <p className="text-[11px] font-semibold text-muted">Precio publicado</p>
            <p className="text-lg font-extrabold tracking-tight tabular-nums">{formatCop(product.price)}</p>
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
                  <div className="flex items-baseline justify-between gap-3">
                    <legend className="text-sm font-bold">
                      {sizeLabelCap}:{" "}
                      <span className="font-semibold text-muted">{variant || "elige uno"}</span>
                    </legend>
                    <span className="text-[11px] text-muted">El precio no cambia</span>
                  </div>
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
                      ? `Elige ${product.sizeKind === "tamano" ? "el tamaño" : "la talla"} para poder pedir.`
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
                      onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    >
                      −
                    </button>
                    <input
                      id="cantidad"
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
                      onClick={() => setQuantity((current) => Math.min(5, current + 1))}
                    >
                      +
                    </button>
                  </div>
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

              <button
                type="button"
                disabled={!canBuy}
                className="flex h-10 w-full items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-extrabold text-on-dark transition-colors enabled:hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-55"
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
                className="flex h-10 w-full items-center justify-center rounded-[10px] border border-line bg-canvas text-sm font-semibold text-ink transition-colors enabled:hover:border-accent enabled:hover:bg-accent-tint disabled:cursor-not-allowed disabled:opacity-55"
              >
                Agregar al carrito
              </button>
              {added ? (
                <p className="text-sm text-accent-strong" role="status">
                  Quedó en el carrito. No registra pedido ni es dinero cobrado.
                </p>
              ) : null}
            </form>
          ) : (
            <p className="mt-3 rounded-[10px] bg-coral-tint px-3 py-2 text-sm font-semibold text-coral-strong">
              Este producto está publicado, pero ahora no se puede pedir.
            </p>
          )}

          <ul className="mt-2 space-y-2 border-t border-line pt-2 text-sm leading-5">
            <li>
              <span className="font-semibold">Pagas al recibir</span>
              <span className="mt-0.5 block text-xs text-muted">Es el precio publicado. Nadie cobra aquí. El envío se acuerda aparte.</span>
            </li>
            <li>
              <span className="font-semibold">Información clara</span>
              <span className="mt-0.5 block text-xs text-muted">Solo lo escrito en esta ficha. Dropi no está conectado.</span>
            </li>
          </ul>
        </aside>
      </section>

      {pieces.length > 0 ? (
        <section id="lo-especial" className="scroll-mt-16 border-t border-line pt-3 pb-2" aria-label="Características y beneficios">
          <h2 className="text-base font-extrabold tracking-tight">Características y beneficios</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted">Sale del catálogo. Si falta un dato, no se inventa.</p>
          <div className="mt-2 max-w-3xl space-y-2">{renderHighlightPieces(pieces)}</div>
        </section>
      ) : null}

      {descriptionIsLong ? (
        <section id="descripcion" className="scroll-mt-16 border-t border-line pt-3 pb-2" aria-label="Descripción">
          <h2 className="text-base font-extrabold tracking-tight">Descripción</h2>
          <div className="mt-2 max-w-2xl space-y-2 text-sm leading-5 text-muted">
            {descriptionParagraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
            ))}
          </div>
          <a href="#detalles" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-accent-strong hover:underline">
            Ver antes de comprar <span aria-hidden="true">→</span>
          </a>
        </section>
      ) : null}

      <div className="scroll-mt-16 grid items-start gap-3 border-t border-line pt-3 pb-2 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <section id="detalles" className="min-w-0" aria-label="Antes de comprar">
          <h2 className="text-base font-extrabold tracking-tight">Antes de comprar</h2>
          <dl className="mt-2 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-card">
            {[
              ["Envío", "No incluido. Se acuerda con la dirección. Sin fecha prometida. No se cobra aquí."],
              ["Pago", "Pagas al recibir el precio publicado. Nadie cobra aquí. El pedido queda pendiente de confirmación."],
              ["Cambios", "Se acuerdan con la tienda. No se inventa una política aquí."],
              ["Dropi", "No está conectado. Esta ficha no crea pedido en Dropi."],
            ].map(([label, value]) => (
              <div key={label} className="px-3 py-2">
                <dt className="text-sm font-bold text-ink">{label}</dt>
                <dd className="mt-0.5 text-xs leading-5 text-muted">{value}</dd>
              </div>
            ))}
            {product.answers ? (
              <div className="px-3 py-2">
                <dt className="text-sm font-bold text-ink">Lo que puedes saber</dt>
                <dd className="mt-0.5 text-xs leading-5 whitespace-pre-line text-muted">{product.answers}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <div id="preguntas" className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2 xl:sticky xl:top-[3rem]">
          <ProductQuestion product={product} />
        </div>
      </div>

      <a href="#contenido" className="mt-3 inline-flex text-sm font-semibold text-accent-strong hover:underline">
        Volver al producto <span className="ml-1" aria-hidden="true">↑</span>
      </a>

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[90vh] w-[min(860px,90vw)] rounded-[14px] border-0 bg-card p-3 shadow-2xl backdrop:bg-primary-dark/70 backdrop:backdrop-blur-sm open:flex open:flex-col"
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
      </dialog>
    </article>
  );
}

function ProductQuestion({ product }: { product: PublicProduct }) {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const canAsk = Boolean(question.trim());

  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAsk) return;
    setReply(answerProductQuestion(product, question));
  }

  return (
    <section aria-labelledby="pregunta-producto">
      <h3 id="pregunta-producto" className="text-sm font-semibold">
        Pregunta sobre este producto
      </h3>
      <p className="mt-1 text-xs leading-5 text-muted">Solo responde con lo de esta ficha.</p>
      <form className="mt-2 space-y-2" onSubmit={ask}>
        <label className="block text-xs font-semibold" htmlFor="pregunta">
          Tu pregunta
          <input
            id="pregunta"
            value={question}
            maxLength={200}
            onChange={(event) => setQuestion(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-sm font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={!canAsk}
          className="inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-line bg-card px-4 text-sm font-semibold hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-55"
        >
          Preguntar
        </button>
      </form>
      {reply ? (
        <p role="status" className="mt-3 text-xs leading-5 whitespace-pre-line text-ink">
          {reply}
        </p>
      ) : null}
    </section>
  );
}
