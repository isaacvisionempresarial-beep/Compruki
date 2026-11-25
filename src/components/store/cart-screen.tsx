"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicProduct } from "@/server/catalog-store";
import { sizeChoiceLabel, variantFits } from "@/lib/catalog";
import { CatalogPhoto } from "@/components/store/product-thumb";
import { useCart } from "@/components/store/cart-state";
import { formatCop } from "@/lib/format";
import { orderTotal } from "@/lib/store-order";

export function CartScreen({ products }: { products: PublicProduct[] }) {
  const cart = useCart();
  const rows = cart.lines.map((line) => {
    const product = products.find((item) => item.sku === line.sku) ?? null;
    return { line, product };
  });
  const payable = rows.filter((row) => row.product?.available && variantFits(row.product.variants, row.line.variant));
  const total = orderTotal(
    payable.map((row) => ({ unitPrice: row.product?.price ?? 0, quantity: row.line.quantity })),
  );
  const sizeGaps = rows.filter(
    ({ line, product }) =>
      Boolean(product?.available && product.variants.length > 0 && product.sizeKind && !variantFits(product.variants, line.variant)),
  );
  const sizeKinds = new Set(sizeGaps.map(({ product }) => product!.sizeKind));
  const canContinue = payable.length === rows.length && payable.length > 0;
  const visualProducts = rows
    .map(({ product }) => product)
    .filter((product): product is PublicProduct => Boolean(product?.images.length));
  const blockedHint =
    sizeGaps.length > 0
      ? sizeKinds.size === 1 && sizeKinds.has("tamano")
        ? "Elige el tamaño para continuar. No cambia el precio ni registra pedido."
        : sizeKinds.size === 1 && sizeKinds.has("talla")
          ? "Elige la talla para continuar. No cambia el precio ni registra pedido."
          : "Elige la talla o el tamaño para continuar. No cambia el precio ni registra pedido."
      : "Quita lo que ya no se puede pedir para continuar. No entra en el total al recibir ni registra pedido.";

  if (!cart.ready) {
    return (
      <section className="elevate-1 mx-auto max-w-5xl rounded-[14px] border border-line bg-card px-3 py-3" aria-busy="true">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Estado</p>
        <p className="mt-0.5 text-sm text-muted">Cargando el carrito… No registra pedido ni cobra.</p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <section
        className="store-hero store-rise relative overflow-hidden rounded-[20px] border border-line"
        style={{ animationDelay: "40ms" }}
      >
        <div className="absolute inset-0">
          {visualProducts[0] ? (
            <CatalogPhoto
              sku={visualProducts[0].sku}
              alt=""
              query={visualProducts[0].images[0] ? `m=${visualProducts[0].images[0].id}` : undefined}
              frameClassName="h-full w-full"
              imgClassName="store-hero-photo store-hero-photo-live h-full w-full object-cover opacity-35"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary via-[#2a3148] to-accent/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card/92 to-card/55" />
        </div>
        <div className="relative z-10 flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="min-w-0 max-w-md">
            <p className="text-[10px] font-bold tracking-[0.1em] text-accent-strong uppercase">Tu selección</p>
            <h1 className="store-display mt-1.5 text-[1.85rem] leading-tight font-extrabold tracking-[-0.03em]">Carrito</h1>
            <p className="mt-1.5 text-sm leading-5 text-muted">
              Precios publicados · Pagas al recibir · Envío aparte. Todavía no es un pedido.
            </p>
          </div>
          {visualProducts.length > 0 ? (
            <div className="flex -space-x-3" aria-hidden="true">
              {visualProducts.slice(0, 4).map((product, index) => (
                <CatalogPhoto
                  key={`${product.sku}:${index}`}
                  sku={product.sku}
                  alt=""
                  query={product.images[0] ? `m=${product.images[0].id}` : undefined}
                  frameClassName="h-14 w-14 rounded-[14px] border-2 border-card shadow-[0_10px_24px_-12px_rgb(23_26_40/0.45)]"
                  imgClassName="h-full w-full object-cover"
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="store-rise mt-4" style={{ animationDelay: "110ms" }}>
        <div className="mb-2 hidden items-end justify-between gap-3 lg:grid lg:grid-cols-[minmax(15rem,17.5rem)_minmax(0,1fr)]">
          <div className="px-0.5">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Resumen</p>
            <p className="mt-0.5 text-base font-bold">Lo que llevas</p>
          </div>
          <div className="flex items-end justify-between gap-2 px-0.5">
            <div>
              <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Productos</p>
              <h2 className="mt-0.5 text-base font-bold">En este carrito</h2>
            </div>
            <p className="text-[11px] leading-4 text-muted">Cambiar o quitar no cobra.</p>
          </div>
        </div>

        <div className="mb-2 flex items-end justify-between gap-2 px-0.5 lg:hidden">
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Carrito</p>
            <h2 className="mt-0.5 text-base font-bold">Resumen y productos</h2>
          </div>
          <p className="text-[11px] leading-4 text-muted">Cambiar o quitar no cobra.</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(15rem,17.5rem)_minmax(0,1fr)] lg:items-start">
          <aside
            className="elevate-1 overflow-hidden rounded-[18px] border border-line bg-card lg:sticky lg:top-20"
            aria-label="Resumen de lo que llevas"
          >
            <div className="border-b border-line bg-gradient-to-br from-accent-tint via-card to-card px-3.5 py-3.5">
              <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase lg:sr-only">Resumen</p>
              <p className="text-sm font-semibold text-muted lg:sr-only">Lo que llevas</p>
              <p className="text-xs text-muted lg:mt-0">
                {rows.length === 0
                  ? "Sin productos aún"
                  : `${payable.length} de ${rows.length} ${rows.length === 1 ? "producto listo" : "productos listos"}`}
              </p>
              <p className="mt-3 text-[11px] font-semibold tracking-[0.04em] text-muted uppercase">Total al recibir</p>
              <p className="store-display mt-0.5 text-[1.85rem] leading-none font-extrabold tracking-tight tabular-nums">
                {formatCop(total)}
              </p>
              <p className="mt-2 text-[11px] leading-4 text-muted">Envío aparte. Confirmar en el pago no cobra.</p>
            </div>
            <div className="space-y-2 px-3.5 py-3">
              {canContinue ? (
                <Link
                  href="/tienda/pagar"
                  title="Continuar no confirma el pedido ni cobra."
                  className="inline-flex h-10 w-full items-center justify-center rounded-[12px] bg-accent px-3 text-sm font-extrabold text-primary-dark shadow-[0_12px_28px_-16px_rgb(37_199_165/0.95)] transition-transform hover:-translate-y-0.5"
                >
                  Continuar · pagas al recibir
                </Link>
              ) : rows.length > 0 ? (
                <>
                  <button
                    type="button"
                    disabled
                    className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-[12px] bg-accent px-3 text-sm font-extrabold text-primary-dark opacity-55"
                    title="Continuar no confirma el pedido ni cobra."
                  >
                    Continuar · pagas al recibir
                  </button>
                  <p className="text-sm leading-5 text-coral-strong">{blockedHint}</p>
                </>
              ) : (
                <Link
                  href="/tienda"
                  title="Verlos no cambia los precios publicados ni crea un pedido."
                  className="inline-flex h-10 w-full items-center justify-center rounded-[12px] bg-primary px-3 text-sm font-semibold text-on-dark"
                >
                  Ver productos
                </Link>
              )}
              <p className="text-[11px] leading-4 text-muted">
                {rows.length === 0 ? "Ver productos no registra pedido ni cobra." : "Continuar no confirma el pedido ni cobra."}
              </p>
              <Link
                href="/tienda"
                title="Seguir viendo no cambia precios ni crea pedido."
                className="inline-flex text-xs font-semibold text-accent-strong hover:underline"
              >
                Seguir mirando la tienda
              </Link>
            </div>
          </aside>

          <section aria-label="Productos en este carrito" className="min-w-0">
          {rows.length === 0 ? (
            <div className="elevate-1 rounded-[18px] border border-dashed border-line bg-card/80 px-4 py-10 text-center">
              <p className="store-display text-base font-bold tracking-tight">Carrito vacío</p>
              <p className="mt-1 text-sm leading-5 text-muted">Agrega algo desde la tienda. Vacío no registra pedido ni cobra.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {rows.map(({ line, product }, index) => {
                const payableLine = Boolean(product?.available && variantFits(product.variants, line.variant));
                const unit = payableLine && product ? product.price : null;
                const lineTotal = unit === null ? null : unit * line.quantity;
                const primaryImage = product?.images[0];
                return (
                  <li
                    key={`${line.sku}:${line.variant}`}
                    className="store-rise elevate-1 overflow-hidden rounded-[18px] border border-line bg-card"
                    style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
                  >
                    <div className="flex flex-col sm:flex-row">
                      <CatalogPhoto
                        sku={line.sku}
                        alt={product?.title ?? ""}
                        query={primaryImage ? `m=${primaryImage.id}` : undefined}
                        note="Sin foto en el catálogo."
                        frameClassName="h-36 w-full shrink-0 bg-subtle sm:h-auto sm:w-36 lg:w-40"
                        imgClassName="h-full w-full object-cover sm:min-h-[9.5rem]"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {product ? (
                              <Link
                                href={`/tienda/producto/${product.sku}`}
                                title="Abrirla no cambia el precio publicado ni crea un pedido."
                                className="text-sm font-bold text-ink underline-offset-2 hover:text-accent-strong hover:underline"
                              >
                                {product.title}
                              </Link>
                            ) : (
                              <p className="text-sm font-bold">Ya no está en la tienda</p>
                            )}
                            <p className="mt-0.5 text-[11px] text-muted">
                              SKU {line.sku}
                              {line.variant
                                ? ` · ${sizeChoiceLabel(line.sizeKind ?? product?.sizeKind ?? undefined, line.variant)}`
                                : ""}
                            </p>
                            {unit !== null ? (
                              <p className="mt-1 text-xs font-semibold tabular-nums text-ink">
                                Precio publicado: {formatCop(unit)}
                                <span className="font-normal text-muted"> c/u</span>
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            title="Quitarla no registra pedido ni cobra."
                            className="shrink-0 rounded-[8px] px-2 py-1 text-xs font-semibold text-muted hover:bg-subtle hover:text-danger"
                            onClick={() => cart.remove(line.sku, line.variant)}
                          >
                            Quitar
                          </button>
                        </div>

                        {product?.available && product.variants.length > 0 && product.sizeKind ? (
                          <label className="block text-xs font-semibold">
                            {product.sizeKind === "tamano" ? "Tamaño" : "Talla"}
                            <select
                              value={product.variants.includes(line.variant) ? line.variant : ""}
                              title={
                                product.sizeKind === "tamano"
                                  ? "Elegirlo no cambia el precio ni registra pedido."
                                  : "Elegirla no cambia el precio ni registra pedido."
                              }
                              onChange={(event) =>
                                cart.setVariant(line.sku, line.variant, event.target.value, product.sizeKind ?? undefined)
                              }
                              className="mt-1 h-8 w-full max-w-[13rem] rounded-[8px] border border-line bg-canvas px-2 text-sm font-semibold"
                            >
                              {product.variants.includes(line.variant) ? null : (
                                <option value="">{product.sizeKind === "tamano" ? "Elige el tamaño" : "Elige la talla"}</option>
                              )}
                              {product.variants.map((name) => (
                                <option key={name} value={name}>
                                  {sizeChoiceLabel(product.sizeKind ?? undefined, name)}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}

                        {!payableLine ? (
                          <p className="text-sm text-coral-strong">
                            {product?.available && product.variants.length > 0
                              ? product.sizeKind === "tamano"
                                ? "Elige el tamaño para continuar."
                                : "Elige la talla para continuar."
                              : "Ya no se puede pedir. Quítalo para continuar."}
                          </p>
                        ) : null}

                        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-line/80 pt-2.5">
                          {payableLine && product ? (
                            <CartQuantity
                              title={product.title}
                              variantLabel={
                                line.variant
                                  ? sizeChoiceLabel(line.sizeKind ?? product.sizeKind ?? undefined, line.variant)
                                  : ""
                              }
                              quantity={line.quantity}
                              onQuantity={(amount) => cart.setQuantity(line.sku, line.variant, amount)}
                            />
                          ) : (
                            <p className="text-sm text-muted">Cantidad —</p>
                          )}
                          <p className="text-right">
                            <span className="block text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
                              A pagar por este
                            </span>
                            <span className="store-display text-lg font-extrabold tabular-nums">
                              {lineTotal === null ? "—" : formatCop(lineTotal)}
                            </span>
                            {unit !== null && line.quantity > 1 ? (
                              <span className="mt-0.5 block text-[11px] text-muted">
                                {line.quantity} × {formatCop(unit)}
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          </section>
        </div>
      </div>
    </div>
  );
}

function CartQuantity({
  title,
  variantLabel,
  quantity,
  onQuantity,
}: {
  title: string;
  variantLabel: string;
  quantity: number;
  onQuantity: (amount: number) => void;
}) {
  const [draft, setDraft] = useState(String(quantity));
  const [syncedQuantity, setSyncedQuantity] = useState(quantity);
  if (quantity !== syncedQuantity) {
    setSyncedQuantity(quantity);
    setDraft(String(quantity));
  }
  const parsed = Number(draft);
  const valid = draft.trim() !== "" && Number.isInteger(parsed) && parsed >= 1 && parsed <= 5;

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Cantidad</span>
      <div className="inline-flex h-8 items-stretch overflow-hidden rounded-[8px] border border-line bg-canvas">
        <button
          type="button"
          className="inline-flex w-8 items-center justify-center text-sm text-muted hover:bg-accent-tint"
          aria-label={`Disminuir cantidad de ${title}${variantLabel ? `, ${variantLabel}` : ""}`}
          title="Cambiarla no registra pedido ni cobra."
          onClick={() => onQuantity(Math.max(1, quantity - 1))}
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[1-5]"
          autoComplete="off"
          value={draft}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, 1);
            setDraft(next);
            const amount = Number(next);
            if (next !== "" && Number.isInteger(amount) && amount >= 1 && amount <= 5) onQuantity(amount);
          }}
          onBlur={() => setDraft(String(quantity))}
          className="w-8 border-0 bg-transparent text-center text-sm font-bold tabular-nums outline-none"
          title="Cambiarla no registra pedido ni cobra."
          aria-label={`Cantidad de ${title}${variantLabel ? `, ${variantLabel}` : ""}`}
        />
        <button
          type="button"
          className="inline-flex w-8 items-center justify-center text-sm text-muted hover:bg-accent-tint"
          aria-label={`Aumentar cantidad de ${title}${variantLabel ? `, ${variantLabel}` : ""}`}
          title="Cambiarla no registra pedido ni cobra."
          onClick={() => onQuantity(Math.min(5, quantity + 1))}
        >
          +
        </button>
      </div>
      {valid ? null : <span className="text-[11px] text-muted">1 a 5</span>}
    </div>
  );
}
