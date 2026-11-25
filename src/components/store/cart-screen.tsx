"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicProduct } from "@/server/catalog-store";
import { sizeChoiceLabel, variantFits } from "@/lib/catalog";
import { LinePhotos, ProductThumb } from "@/components/store/product-thumb";
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
      <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-3" aria-busy="true">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Estado</p>
        <p className="mt-0.5 text-sm text-muted">Cargando el carrito… No registra pedido ni cobra.</p>
      </section>
    );
  }

  return (
    <div>
      <section
        className="store-hero store-rise relative overflow-hidden rounded-[18px] border border-line px-4 py-4 sm:px-5"
        style={{ animationDelay: "40ms" }}
      >
        <p className="text-[10px] font-bold tracking-[0.1em] text-accent-strong uppercase">Este navegador</p>
        <h1 className="store-display mt-2 text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em]">Carrito</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-5 text-muted">
          Precios publicados · Pagas al recibir · Envío aparte. Todavía no es un pedido.
        </p>
      </section>

      <div className="store-rise mt-3 space-y-3" style={{ animationDelay: "120ms" }}>
        <section
          className="elevate-1 overflow-hidden rounded-[16px] border border-line bg-card"
          aria-labelledby="carrito-resumen"
        >
          <div className="flex flex-col gap-3 border-b border-line bg-gradient-to-br from-accent-tint/70 via-card to-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Resumen</p>
              <h2 id="carrito-resumen" className="sr-only">
                Resumen del carrito
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {rows.length === 0
                  ? "Sin productos aún"
                  : `${payable.length} de ${rows.length} ${rows.length === 1 ? "producto" : "productos"} listos`}
              </p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-xs font-semibold text-muted">Total al recibir</span>
                <span className="store-display text-2xl font-extrabold tracking-tight tabular-nums">{formatCop(total)}</span>
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted">Envío aparte. Confirmar en el pago no cobra.</p>
            </div>
            <div className="shrink-0 sm:text-right">
              {canContinue ? (
                <Link
                  href="/tienda/pagar"
                  title="Continuar no confirma el pedido ni cobra."
                  className="inline-flex h-10 w-full items-center justify-center rounded-[12px] bg-accent px-4 text-sm font-extrabold text-primary-dark shadow-[0_10px_24px_-14px_rgb(37_199_165/0.9)] transition-transform hover:-translate-y-0.5 sm:w-auto sm:min-w-52"
                >
                  Continuar · pagas al recibir
                </Link>
              ) : rows.length > 0 ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-[12px] bg-accent px-4 text-sm font-extrabold text-primary-dark opacity-55 sm:w-auto sm:min-w-52"
                  title="Continuar no confirma el pedido ni cobra."
                >
                  Continuar · pagas al recibir
                </button>
              ) : (
                <Link
                  href="/tienda"
                  title="Verlos no cambia los precios publicados ni crea un pedido."
                  className="inline-flex h-10 w-full items-center justify-center rounded-[12px] bg-primary px-4 text-sm font-semibold text-on-dark sm:w-auto sm:min-w-52"
                >
                  Ver productos
                </Link>
              )}
              {rows.length > 0 && !canContinue ? (
                <p className="mt-2 text-sm leading-5 text-coral-strong sm:max-w-xs sm:ml-auto">{blockedHint}</p>
              ) : (
                <p className="mt-1.5 text-[11px] leading-4 text-muted">
                  {rows.length === 0 ? "Ver productos no registra pedido ni cobra." : "Continuar no confirma el pedido ni cobra."}
                </p>
              )}
            </div>
          </div>
        </section>

        {rows.length === 0 ? (
          <section className="elevate-1 rounded-[14px] border border-dashed border-line bg-card/80 px-4 py-8 text-center">
            <p className="store-display text-base font-bold tracking-tight">Carrito vacío</p>
            <p className="mt-1 text-sm leading-5 text-muted">Agrega algo desde la tienda. Vacío no registra pedido ni cobra.</p>
          </section>
        ) : (
          <section aria-labelledby="carrito-lineas">
            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Productos</p>
                <h2 id="carrito-lineas" className="mt-0.5 text-base font-bold">
                  En este carrito
                </h2>
              </div>
              <p className="text-[11px] leading-4 text-muted">Cambiar o quitar no cobra.</p>
            </div>
            <ul className="space-y-2">
              {rows.map(({ line, product }, index) => {
                const payableLine = Boolean(product?.available && variantFits(product.variants, line.variant));
                const unit = payableLine && product ? product.price : null;
                const lineTotal = unit === null ? null : unit * line.quantity;
                return (
                  <li
                    key={`${line.sku}:${line.variant}`}
                    className="store-rise elevate-1 overflow-hidden rounded-[14px] border border-line bg-card"
                    style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
                  >
                    <LinePhotos sku={line.sku} title={product?.title ?? line.sku} images={product?.images ?? []} />
                    <div className={`flex gap-3 p-3 ${(product?.images.length ?? 0) > 1 ? "pt-2" : ""}`}>
                      <ProductThumb sku={line.sku} show={product?.images.length === 1} />
                      <div className="min-w-0 flex-1">
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
                              {unit !== null ? ` · ${formatCop(unit)} c/u` : ""}
                            </p>
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
                          <label className="mt-2 block text-xs font-semibold">
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
                              className="mt-1 h-8 w-full max-w-[12rem] rounded-[8px] border border-line bg-canvas px-2 text-sm font-semibold"
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
                          <p className="mt-2 text-sm text-coral-strong">
                            {product?.available && product.variants.length > 0
                              ? product.sizeKind === "tamano"
                                ? "Elige el tamaño para continuar."
                                : "Elige la talla para continuar."
                              : "Ya no se puede pedir. Quítalo para continuar."}
                          </p>
                        ) : null}

                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-line/80 pt-2.5">
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
                              Total línea
                            </span>
                            <span className="text-base font-extrabold tabular-nums">
                              {lineTotal === null ? "—" : formatCop(lineTotal)}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
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
      <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Cant.</span>
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
