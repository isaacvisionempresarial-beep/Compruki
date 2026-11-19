"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog";
import { STATUS_LABEL, type Period } from "@/lib/demo-data";
import { cx } from "@/lib/cx";
import { formatCop } from "@/lib/format";
import {
  orderFocusHref,
  pendingSizeHoldPhrase,
  pendingSizeHolds,
  periodPhrase,
  resultsByProduct,
  storeOrdersInPeriod,
  widerPeriodWithResults,
  type ProductSource,
  type StoreOrder,
} from "@/lib/store-order";
import { PeriodControl } from "@/components/panel/period-control";
import { usePanelQuery } from "@/components/panel/panel-shell";

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
  const query = usePanelQuery().trim().toLocaleLowerCase("es");
  const guides = useMemo(
    () => products.map((product) => ({ sku: product.sku, variants: product.variants, sizeKind: product.sizeKind ?? null })),
    [products],
  );
  const holds = useMemo(() => pendingSizeHolds(orders, guides), [orders, guides]);
  const results = useMemo(
    () => resultsByProduct(storeOrdersInPeriod(orders, storePeriod, today), guides),
    [orders, guides, storePeriod, today],
  );
  const wider = results.length === 0 ? widerPeriodWithResults(orders, storePeriod, guides, today) : null;
  const visible = results.filter(
    (row) =>
      !query ||
      row.title.toLocaleLowerCase("es").includes(query) ||
      row.sku.toLocaleLowerCase("es").includes(query) ||
      row.sources.some((source) => source.number.toLocaleLowerCase("es").includes(query)),
  );

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Resultados</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Rentabilidad</h1>
      <p className="mt-1 text-sm text-muted">
        {canManageOrderMoney
          ? "Lo que dejaron los pedidos · no es el margen del precio actual. Dropi no está conectado."
          : "Lo que dejaron los pedidos · no es el margen del precio actual. Esta página solo lee. El flete, el costo y el cobro los guarda el propietario. Dropi no está conectado."}
      </p>

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_13.5rem]">
        <div className="order-2 min-w-0 xl:order-1">
          <section aria-labelledby="resultados-reales">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="resultados-reales" className="text-base font-bold">
                  Qué dejaron los pedidos
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Cifras de {periodPhrase(storePeriod)}
                </p>
              </div>
              <PeriodControl
                period={storePeriod}
                onChange={setStorePeriod}
                name="periodo-resultados"
                legend="Período de los resultados por producto"
              />
            </div>
            {results.length === 0 ? (
              <p className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2 text-sm text-muted">
                En este período no hay pedidos confirmados ni devueltos.
                {wider ? ` En ${periodPhrase(wider)} sí hay.` : ""}
              </p>
            ) : visible.length === 0 ? (
              <p className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2 text-sm text-muted">
                Ningún producto coincide con la búsqueda.
              </p>
            ) : (
              <div className="elevate-1 mt-3 overflow-hidden rounded-[14px] border border-line bg-card">
                <div
                  className={cx(
                    "hidden items-end gap-4 border-b border-line bg-canvas px-3 py-2 text-[11px] font-semibold tracking-[0.04em] text-muted uppercase md:grid",
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
                            <summary className="cursor-pointer text-sm font-semibold text-accent-strong">
                              Ver pedidos ({row.sources.length})
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
          </section>
        </div>

        <aside className="elevate-1 order-1 rounded-[14px] border border-line bg-card px-3 py-2 xl:sticky xl:top-[3.75rem] xl:order-2">
          <h2 className="text-sm font-semibold">Cómo se lee</h2>
          <ul className="mt-2 space-y-2 text-xs leading-5">
            <li>
              <span className="font-semibold text-sm">Qué cuenta</span>
              <span className="mt-0.5 block text-muted">Confirmados y devoluciones. Devuelto es el total guardado, no el margen. La muestra no entra.</span>
            </li>
            <li>
              <span className="font-semibold text-sm">Estimado vs utilidad</span>
              <span className="mt-0.5 block text-muted">
                Estimado = margen de confirmados. Utilidad = entregado y cobrado. Ninguna es el total guardado del pedido.
              </span>
            </li>
            <li>
              <span className="font-semibold text-sm">Pedidos</span>
              <span className="mt-0.5 block text-muted">
                Bajo «Ver pedidos».{" "}
                {canManageOrderMoney ? "Precio actual en " : "El precio de la ficha lo cambia el propietario en "}
                <Link href="/panel/catalogo" className="font-semibold text-accent-strong">
                  Catálogo
                </Link>
                .
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs leading-5 text-muted">Cifras de COMPRUKI. Dropi no está conectado.</p>
        </aside>
      </div>
    </div>
  );
}

function sourceNote(source: ProductSource) {
  if (source.returned) return "Sale del margen y de la utilidad.";
  if (source.realized && source.missingCost) return "Sin costo guardado, no entra el monto en la utilidad.";
  if (source.realized) return "Entra en el margen estimado y en la utilidad realizada.";
  if (source.missingCost) return "Sin costo guardado, no suma margen.";
  return "Entra en el margen estimado. Todavía no está en la utilidad realizada.";
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
      <p className="mb-1 text-[10px] font-bold tracking-[0.06em] text-muted uppercase md:sr-only">{label}</p>
      <p className="text-base font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
    </div>
  );
}
