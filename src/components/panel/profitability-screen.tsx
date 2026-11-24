"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog";
import { STATUS_LABEL, type Period } from "@/lib/demo-data";
import { cx } from "@/lib/cx";
import { formatCop } from "@/lib/format";
import {
  closePhrase,
  orderFocusHref,
  ordersInSpan,
  pendingSizeHoldPhrase,
  pendingSizeHolds,
  outsideCostCopyNote,
  periodCostShiftNote,
  resultDriftNote,
  resultsByProduct,
  skuCostPreviewNote,
  storedSkuLines,
  widerPeriodWithResults,
  type CloseBasis,
  type CostGuide,
  type ProductSource,
  type StoreOrder,
} from "@/lib/store-order";
import { CloseSheet } from "@/components/panel/close-sheet";
import { CloseBasisControl, PeriodControl } from "@/components/panel/period-control";
import { usePanelQuery } from "@/components/panel/panel-shell";

function outsideCopyNote(all: StoreOrder[], sku: string, guides: CostGuide[]) {
  const guide = guides.find((item) => item.sku === sku);
  if (!guide) return "";
  return outsideCostCopyNote(storedSkuLines(all, sku), guide);
}

function periodCostPreview(shown: StoreOrder[], all: StoreOrder[], sku: string, guides: CostGuide[]) {
  const guide = guides.find((item) => item.sku === sku);
  if (!guide) return "";
  const seen = new Set(shown.map((order) => order.number));
  return skuCostPreviewNote(shown, sku, guide, "este período", all.filter((order) => !seen.has(order.number)));
}

const resultGrid = "md:grid-cols-[minmax(0,1.5fr)_8.75rem_8.75rem_8.75rem]";

export function ProfitabilityScreen({
  products,
  orders,
  today,
  canManageOrderMoney = false,
}: {
  products: CatalogProduct[];
  orders: StoreOrder[];
  today: string;
  canManageOrderMoney?: boolean;
}) {
  const [storePeriod, setStorePeriod] = useState<Period>("7d");
  const [basis, setBasis] = useState<CloseBasis>("creados");
  const query = usePanelQuery().trim().toLocaleLowerCase("es");
  const guides = useMemo(
    () => products.map((product) => ({ sku: product.sku, variants: product.variants, sizeKind: product.sizeKind ?? null })),
    [products],
  );
  const priceGuides = useMemo(() => products.map((product) => ({ sku: product.sku, price: product.price })), [products]);
  const costGuides = useMemo(
    () => products.map((product) => ({ sku: product.sku, cost: product.cost, shipping: product.shipping, commissions: product.commissions })),
    [products],
  );
  const holds = useMemo(() => pendingSizeHolds(orders, guides), [orders, guides]);
  const spanOrders = useMemo(() => ordersInSpan(orders, storePeriod, today, basis), [orders, storePeriod, today, basis]);
  const periodShift = useMemo(() => {
    const seen = new Set(spanOrders.map((order) => order.number));
    return periodCostShiftNote(spanOrders, costGuides, "este período", orders.filter((order) => !seen.has(order.number)));
  }, [costGuides, orders, spanOrders]);
  const results = useMemo(() => resultsByProduct(spanOrders, guides), [spanOrders, guides]);
  const wider = results.length === 0 ? widerPeriodWithResults(orders, storePeriod, guides, today, basis) : null;
  const visible = results.filter(
    (row) =>
      !query ||
      row.title.toLocaleLowerCase("es").includes(query) ||
      row.sku.toLocaleLowerCase("es").includes(query) ||
      row.sources.some((source) => source.number.toLocaleLowerCase("es").includes(query)) ||
      resultDriftNote(spanOrders, row.sku, priceGuides, costGuides).toLocaleLowerCase("es").includes(query) ||
      periodCostPreview(spanOrders, orders, row.sku, costGuides).toLocaleLowerCase("es").includes(query) ||
      outsideCopyNote(orders, row.sku, costGuides).toLocaleLowerCase("es").includes(query),
  );

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Tienda</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Rentabilidad</h1>
      <p className="mt-1 max-w-2xl text-sm leading-5 text-muted">
        {canManageOrderMoney
          ? "Resultados. Lo que dejaron los pedidos. No es el margen del precio actual. Dropi no está conectado."
          : "Resultados. Lo que dejaron los pedidos. No es el margen del precio actual. Esta página solo lee. El flete, el costo y el cobro los guarda el propietario. Dropi no está conectado."}
      </p>

      <section className="mt-5" aria-labelledby="resultados-reales">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Cuenta</p>
        <h2 id="resultados-reales" className="mt-0.5 text-base font-bold">Qué dejaron los pedidos</h2>
        <p className="mt-0.5 max-w-2xl text-xs leading-5 text-muted">
          Cifras de {closePhrase(storePeriod, basis)}. Entran confirmados y devoluciones. Devuelto es el total guardado, no el margen. La muestra no entra.
          {basis === "movidos" ? " El total guardado es el del pedido, no lo cobrado en ese día." : ""}
        </p>
        <div className="elevate-1 mt-3 grid items-stretch gap-4 rounded-[14px] border border-line bg-card px-3 py-3 sm:grid-cols-2 sm:gap-x-6">
          <div className="flex min-w-0 flex-col">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Fecha</p>
            <p className="mt-0.5 text-xs leading-5 text-muted">
              Creados mira cuándo entró el pedido. Movidos incluye uno viejo si cambió en el período.
            </p>
            <div className="mt-3 sm:mt-auto sm:pt-3">
              <CloseBasisControl basis={basis} onChange={setBasis} name="base-resultados" wide />
            </div>
          </div>
          <div className="flex min-w-0 flex-col">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Período</p>
            <p className="mt-0.5 text-xs leading-5 text-muted">
              Solo cambia las cifras de esta página. No cobra ni cambia pedidos.
            </p>
            <div className="mt-3 sm:mt-auto sm:pt-3">
              <PeriodControl
                period={storePeriod}
                onChange={setStorePeriod}
                name="periodo-resultados"
                legend="Período de los resultados por producto"
                wide
              />
            </div>
          </div>
        </div>
        <p className="mt-4 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Productos</p>
        <h3 className="mt-0.5 text-sm font-semibold">La cuenta por producto</h3>
        <p className="mt-0.5 max-w-2xl text-xs leading-5 text-muted">
          Estimado es el margen de confirmados. Utilidad es lo entregado y marcado como cobrado. Ninguna es dinero cobrado en el sitio ni el total guardado del pedido. Si la ficha de hoy es otra, el producto muestra las dos cifras y las cuentas siguen con lo guardado. Los pedidos van bajo «Ver pedidos».{" "}
          {canManageOrderMoney ? "El precio de la ficha se cambia en Catálogo." : "El precio de la ficha lo cambia el propietario en Catálogo."}
        </p>
        <nav aria-label="Vista" className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
          <Link href="/panel/catalogo" className="inline-flex h-9 items-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle">
            Abrir catálogo
          </Link>
        </nav>
        {periodShift ? <p className="mt-3 text-sm leading-5">{periodShift}</p> : null}
            {results.length === 0 ? (
              <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2">
                <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
                <p className="mt-0.5 text-sm text-muted">
                  En este período no hay pedidos confirmados ni devueltos.
                  {wider ? ` En ${closePhrase(wider, basis)} sí hay.` : ""}
                </p>
              </div>
            ) : visible.length === 0 ? (
              <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2">
                <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
                <p className="mt-0.5 text-sm text-muted">Ningún producto coincide con la búsqueda.</p>
              </div>
            ) : (
              <div className="elevate-1 mt-3 overflow-hidden rounded-[14px] border border-line bg-card">
                <div
                  className={cx(
                    "hidden items-end gap-4 border-b border-line bg-canvas px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase md:grid",
                    resultGrid,
                  )}
                >
                  <span>Producto</span>
                  <span className="text-right">Estimado</span>
                  <span className="text-right">Utilidad</span>
                  <span className="text-right">Devuelto</span>
                </div>
                <ul className="divide-y divide-line">
                  {visible.map((row) => (
                    <li key={row.sku} className={cx("grid items-start gap-3 px-3 py-2 md:gap-4", resultGrid)}>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold">{row.title}</h3>
                        <p className="mt-0.5 text-xs text-muted">{row.sku}</p>
                        {resultDriftNote(spanOrders, row.sku, priceGuides, costGuides) ? (
                          <p className="mt-1 text-xs leading-5 text-warning">{resultDriftNote(spanOrders, row.sku, priceGuides, costGuides)}</p>
                        ) : null}
                        {periodCostPreview(spanOrders, orders, row.sku, costGuides) ? (
                          <p className="mt-1 text-xs leading-5">{periodCostPreview(spanOrders, orders, row.sku, costGuides)}</p>
                        ) : null}
                        {outsideCopyNote(orders, row.sku, costGuides) ? (
                          <p className="mt-1 text-xs leading-5">{outsideCopyNote(orders, row.sku, costGuides)}</p>
                        ) : null}
                        {row.sizes.length > 0 ? (
                          <ul className="mt-2 grid gap-1 text-sm leading-5" aria-label={`Tallas o tamaños de ${row.title}`}>
                            {row.sizes.map((size) => (
                              <li key={size.label}>
                                <span className="font-semibold">{size.label}.</span> {sizeCountPhrase(size)}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {holds.get(row.sku) ? (
                          <p className="mt-2 text-sm leading-5 text-warning">
                            {pendingSizeHoldPhrase(holds.get(row.sku)!.orders, holds.get(row.sku)!.kind)}
                          </p>
                        ) : null}
                        {row.sources.length > 0 ? (
                          <details className="mt-3">
                            <summary className="cursor-pointer">
                              <span className="block text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Fuentes</span>
                              <span className="mt-0.5 block text-sm font-semibold text-accent-strong">Ver pedidos ({row.sources.length})</span>
                            </summary>
                            <ul className="mt-2 space-y-1 text-sm leading-5">
                              {row.sources.map((source) => (
                                <li key={source.number}>
                                  <a href={orderFocusHref(source.number)} className="font-semibold text-accent-strong">
                                    {source.number}
                                  </a>
                                  <span className="text-muted">
                                    {" "}
                                    · {STATUS_LABEL[source.status]}. {sourceNote(source)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                      </div>
                      <ResultFigure
                        label="Estimado"
                        value={figureValue(row.confirmedUnits, row.estimatedMissingUnits, row.estimatedMargin)}
                        detail={`${confirmedLabel(row.confirmedUnits)}. Total guardado ${formatCop(row.confirmedAmount)}.`}
                      />
                      <ResultFigure
                        label="Utilidad"
                        value={figureValue(row.realizedUnits, row.realizedMissingUnits, row.realizedMargin)}
                        detail={
                          row.realizedUnits > 0 && row.realizedMissingUnits === row.realizedUnits
                            ? `Utilidad realizada · ${realizedLabel(row.realizedUnits)}. Sin costo, no entra. No es el total guardado.`
                            : `Utilidad realizada · ${realizedLabel(row.realizedUnits)}. No es el total guardado.`
                        }
                      />
                      <ResultFigure
                        label="Devuelto"
                        value={formatCop(row.returnedAmount)}
                        detail={
                          row.returnFreight > 0
                            ? `${unitLabel(row.returnedUnits)}. Total guardado. Flete ${formatCop(row.returnFreight)} resta de la utilidad.`
                            : `${unitLabel(row.returnedUnits)}. Total guardado. No entra a la utilidad.`
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <CloseSheet
              orders={spanOrders}
              rest={orders.filter((order) => !spanOrders.some((shown) => shown.number === order.number))}
              period={storePeriod}
              basis={basis}
              guides={guides}
              priceGuides={priceGuides}
              costGuides={costGuides}
              fieldId="cierre-resultados"
            />
      </section>
      <p className="mt-3 text-xs leading-5 text-muted">Cifras de COMPRUKI. Dropi no está conectado.</p>
    </div>
  );
}

function sourceNote(source: ProductSource) {
  const base = source.returned
    ? "Sale del margen y de la utilidad."
    : source.realized && source.missingCost
      ? "Sin costo guardado, no entra el monto en la utilidad."
      : source.realized
        ? "Entra en el margen estimado y en la utilidad realizada."
        : source.missingCost
          ? "Sin costo guardado, no suma margen."
          : "Entra en el margen estimado. Todavía no está en la utilidad realizada.";
  return `${base} No es dinero cobrado ni el total guardado.`;
}

function sizeCountPhrase(size: { confirmedUnits: number; returnedUnits: number }) {
  const parts: string[] = [];
  if (size.confirmedUnits === 1) parts.push("1 confirmada");
  else if (size.confirmedUnits > 1) parts.push(`${size.confirmedUnits} confirmadas`);
  if (size.returnedUnits === 1) parts.push("1 devuelta");
  else if (size.returnedUnits > 1) parts.push(`${size.returnedUnits} devueltas`);
  return parts.join(" · ");
}

function unitLabel(count: number) {
  return count === 1 ? "1 unidad" : `${count} unidades`;
}

function confirmedLabel(count: number) {
  return count === 1 ? "1 unidad confirmada" : `${count} unidades confirmadas`;
}

function realizedLabel(count: number) {
  return count === 1 ? "1 unidad entregada y cobrada" : `${count} unidades entregadas y cobradas`;
}

function figureValue(units: number, missing: number, amount: number) {
  if (units > 0 && missing === units) return "Sin costo guardado";
  return formatCop(amount);
}

function ResultFigure({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="md:pt-0.5 md:text-right">
      <p className="mb-1 text-[10px] font-bold tracking-[0.08em] text-muted uppercase md:sr-only">{label}</p>
      <p className="text-base font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
    </div>
  );
}
