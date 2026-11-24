"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicProduct } from "@/server/catalog-store";
import { sizeChoiceLabel, variantFits } from "@/lib/catalog";
import { LinePhotos, ProductThumb } from "@/components/store/product-thumb";
import { useCart } from "@/components/store/cart-state";
import { cx } from "@/lib/cx";
import { formatCop } from "@/lib/format";
import { orderTotal } from "@/lib/store-order";

const cartGrid = "md:grid-cols-[minmax(0,1.5fr)_6.5rem_9.5rem_5rem]";

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
      <section className="store-hero store-rise relative overflow-hidden rounded-[18px] border border-line px-4 py-4 sm:px-5">
        <p className="text-[10px] font-bold tracking-[0.1em] text-accent-strong uppercase">Este navegador</p>
        <h1 className="store-display mt-2 text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em]">Carrito</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Precios publicados. Se guarda aquí. Abrirlo no cobra. Pagas al recibir · Envío aparte. Todavía no es un pedido.
        </p>
      </section>
      <div className="mt-3 space-y-3">
      <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-3" aria-labelledby="carrito-resumen">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Estado</p>
            <h2 id="carrito-resumen" className="mt-0.5 text-sm font-semibold">Resumen</h2>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <p className="text-xs text-muted">Total al recibir</p>
              <p className="text-lg font-extrabold tabular-nums">{formatCop(total)}</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              {rows.length === 0
                ? "Cuando agregues productos, el total al recibir aparece aquí."
                : "Pagas al recibir. Envío aparte. Todavía no es dinero cobrado."}
            </p>
            <p className="mt-1.5 text-xs leading-5 text-muted">
              El pedido se crea al confirmar en el pago y no cobra.
            </p>
            {canContinue ? (
              <>
                <nav aria-label="Herramientas" className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
                  <Link
                    href="/tienda/pagar"
                    title="Continuar no confirma el pedido ni cobra."
                    className="inline-flex h-9 sm:min-w-56 items-center justify-center rounded-[10px] bg-accent px-3 text-sm font-extrabold text-primary-dark"
                  >
                    Continuar · pagas al recibir
                  </Link>
                </nav>
                <p className="mt-2 text-xs leading-5 text-muted">Continuar no confirma el pedido ni cobra.</p>
              </>
            ) : rows.length > 0 ? (
              <div className="mt-3">
                <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
                  <button
                    type="button"
                    disabled
                    className="inline-flex h-9 sm:min-w-56 cursor-not-allowed items-center justify-center rounded-[10px] bg-accent px-3 text-sm font-extrabold text-primary-dark opacity-55"
                    title="Continuar no confirma el pedido ni cobra."
                  >
                    Continuar · pagas al recibir
                  </button>
                </nav>
                <p className="mt-2 text-sm leading-5 text-coral-strong">{blockedHint}</p>
                <p className="mt-2 text-xs leading-5 text-muted">Continuar no confirma el pedido ni cobra.</p>
              </div>
            ) : (
              <>
                <nav aria-label="Herramientas" className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
                  <Link
                    href="/tienda"
                    title="Verlos no cambia los precios publicados ni crea un pedido."
                    className="inline-flex h-9 sm:min-w-56 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark"
                  >
                    Ver productos
                  </Link>
                </nav>
                <p className="mt-2 text-xs leading-5 text-muted">Ver productos no registra pedido ni cobra.</p>
              </>
            )}

      </section>

        {rows.length === 0 ? (
          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-3">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
            <p className="mt-0.5 text-sm leading-5 text-muted">El carrito está vacío. Vacío no registra pedido ni cobra.</p>
          </section>
        ) : (
          <section aria-labelledby="carrito-lineas">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Líneas</p>
            <h2 id="carrito-lineas" className="mt-0.5 text-base font-bold">En este carrito</h2>
            <p className="mt-0.5 text-xs leading-5 text-muted">Cambiar la cantidad o quitar no registra pedido ni cobra.</p>
            <div className="elevate-1 mt-3 overflow-hidden rounded-[14px] border border-line bg-card">
            <div
              className={cx(
                "hidden items-end gap-4 border-b border-line bg-canvas px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase md:grid",
                cartGrid,
              )}
            >
              <span>Producto</span>
              <span>Cantidad</span>
              <span className="text-right">Total al recibir</span>
              <span>Quitar</span>
            </div>
            <ul className="divide-y divide-line">
              {rows.map(({ line, product }) => {
                const payableLine = Boolean(product?.available && variantFits(product.variants, line.variant));
                const lineTotal = payableLine && product ? product.price * line.quantity : null;
                return (
                  <li key={`${line.sku}:${line.variant}`} className="px-3 py-2">
                    <LinePhotos sku={line.sku} title={product?.title ?? line.sku} images={product?.images ?? []} />
                    <div className={cx("grid items-start gap-3 md:gap-4", cartGrid, (product?.images.length ?? 0) > 1 ? "mt-3" : "")}>
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          <ProductThumb sku={line.sku} show={product?.images.length === 1} />
                          <div className="min-w-0">
                            {product ? (
                              <Link
                                href={`/tienda/producto/${product.sku}`}
                                title="Abrirla no cambia el precio publicado ni crea un pedido."
                                className="font-semibold text-ink underline-offset-2 hover:text-accent-strong hover:underline"
                              >
                                {product.title}
                              </Link>
                            ) : (
                              <p className="font-semibold">Ya no está en la tienda</p>
                            )}
                            {line.variant ? (
                              <p className="text-sm font-semibold">
                                {sizeChoiceLabel(line.sizeKind ?? product?.sizeKind ?? undefined, line.variant)}
                              </p>
                            ) : null}
                            <p className="text-xs text-muted">SKU {line.sku}</p>
                          </div>
                        </div>
                        {product?.available && product.variants.length > 0 && product.sizeKind ? (
                          <label className="mt-3 block text-sm font-semibold">
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
                              className="mt-1 h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm font-semibold"
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
                            <span className="mt-1 block text-xs font-normal leading-5 text-muted">
                              {product.sizeKind === "tamano"
                                ? "Elegirlo no cambia el precio ni registra pedido."
                                : "Elegirla no cambia el precio ni registra pedido."}
                            </span>
                          </label>
                        ) : null}
                        {!payableLine ? (
                          <p className="mt-2 text-sm text-coral-strong">
                            {product?.available && product.variants.length > 0
                              ? product.sizeKind === "tamano"
                                ? "Elige el tamaño para continuar. No cambia el precio ni registra pedido."
                                : "Elige la talla para continuar. No cambia el precio ni registra pedido."
                              : "Ya no se puede pedir. Quítalo para continuar. No entra en el total al recibir ni registra pedido."}
                          </p>
                        ) : null}
                      </div>
                      <div className="md:pt-0.5">
                        <span className="mb-1 block text-[10px] font-bold tracking-[0.08em] text-muted uppercase md:hidden">
                          Cantidad
                        </span>
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
                          <p className="text-sm text-muted">—</p>
                        )}
                      </div>
                      <div className="md:pt-0.5 md:text-right">
                        <span className="mb-1 block text-[10px] font-bold tracking-[0.08em] text-muted uppercase md:hidden">
                          Total al recibir
                        </span>
                        <p className="text-base font-extrabold tabular-nums">
                          {lineTotal === null ? "—" : formatCop(lineTotal)}
                        </p>
                      </div>
                      <div className="md:pt-0.5">
                        <span className="mb-1 block text-[10px] font-bold tracking-[0.08em] text-muted uppercase md:hidden">
                          Quitar
                        </span>
                        <nav aria-label="Línea" className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Línea</span>
                          <button
                            type="button"
                            title="Quitarla no registra pedido ni cobra."
                            className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold"
                            onClick={() => cart.remove(line.sku, line.variant)}
                          >
                            Quitar
                          </button>
                        </nav>
                        <p className="mt-1 text-xs leading-5 text-muted">No registra pedido ni cobra.</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            </div>
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
    <div>
      <label className="text-sm">
        <span className="sr-only">
          Cantidad de {title}
          {variantLabel ? `, ${variantLabel}` : ""}
        </span>
        <input
          type="number"
          min={1}
          max={5}
          inputMode="numeric"
          value={draft}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            const amount = Number(next);
            if (next.trim() !== "" && Number.isInteger(amount) && amount >= 1 && amount <= 5) onQuantity(amount);
          }}
          onBlur={() => setDraft(String(quantity))}
          className="h-10 w-20 rounded-[10px] border border-line bg-card px-2 tabular-nums focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
          title="Cambiarla no registra pedido ni cobra."
        />
      </label>
      <p className="mt-1 text-xs leading-5 text-muted">Cambiarla no registra pedido ni cobra.</p>
      {valid ? null : (
        <p className="mt-2 text-sm leading-5 text-ink">De 1 a 5. Vacío o cero no quita el producto: usa Quitar.</p>
      )}
    </div>
  );
}
