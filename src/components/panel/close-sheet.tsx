"use client";

import { useMemo, useState } from "react";
import { formatCop } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/demo-data";
import {
  closeSheetText,
  closeSpanPhrase,
  costDrift,
  periodCostShiftNote,
  priceDrift,
  resultDriftNote,
  resultsByProduct,
  summarizeStoreOrders,
  type CloseBasis,
  type CostGuide,
  type OrderSpan,
  type PriceGuide,
  type SizeGuide,
  type StoreOrder,
} from "@/lib/store-order";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

function Metric({
  label,
  amount,
  count,
  numbers,
  hint,
}: {
  label: string;
  amount: string;
  count?: string;
  numbers?: string[];
  hint: string;
}) {
  return (
    <li className="rounded-[12px] border border-line bg-canvas px-3 py-2.5">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{label}</p>
      <p className="mt-1 text-base font-extrabold tabular-nums">{amount}</p>
      {count ? <p className="mt-0.5 text-xs font-semibold text-muted">{count}</p> : null}
      {numbers && numbers.length > 0 ? (
        <p className="mt-1 break-words text-xs leading-4 text-muted">{numbers.join(", ")}</p>
      ) : null}
      <p className="mt-1.5 text-[11px] leading-4 text-muted">{hint}</p>
    </li>
  );
}

export function CloseSheet({
  orders,
  rest = [],
  period,
  basis,
  guides = [],
  priceGuides = [],
  costGuides = [],
  fieldId,
}: {
  orders: StoreOrder[];
  rest?: StoreOrder[];
  period: OrderSpan;
  basis: CloseBasis;
  guides?: SizeGuide[];
  priceGuides?: PriceGuide[];
  costGuides?: CostGuide[];
  fieldId: string;
}) {
  const text = useMemo(
    () => closeSheetText(orders, period, basis, guides, priceGuides, costGuides, rest),
    [orders, period, basis, guides, priceGuides, costGuides, rest],
  );
  const summary = useMemo(() => summarizeStoreOrders(orders), [orders]);
  const products = useMemo(() => resultsByProduct(orders, guides), [orders, guides]);
  const periodShift = useMemo(
    () => periodCostShiftNote(orders, costGuides, period === "todo" ? "" : "este período", period === "todo" ? [] : rest),
    [orders, costGuides, period, rest],
  );
  const drifted = orders.some((order) => priceDrift(order, priceGuides).length > 0);
  const costDrifted = orders.some((order) => costDrift(order, costGuides).length > 0);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function copy() {
    const ok = await copyText(text);
    setCopied(ok ? "ok" : "fail");
  }

  function orderCountLabel(count: number) {
    return count === 1 ? "1 pedido" : `${count} pedidos`;
  }

  return (
    <section className="mt-3" aria-labelledby={`${fieldId}-titulo`}>
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Copia</p>
      <h3 id={`${fieldId}-titulo`} className="mt-0.5 text-sm font-semibold">
        Cierre · resumen para copiar
      </h3>
      <p className="mt-0.5 text-xs leading-5 text-muted">
        Resumen de {closeSpanPhrase(period, basis)}. Sirve para pegarlo en un chat o cuaderno a mano.{" "}
        <span className="font-semibold text-ink">No cobra</span>, no cambia pedidos y no crea nada en Dropi.
        {period !== "todo" && basis === "movidos"
          ? " El total guardado es el del pedido, no lo cobrado ese día."
          : ""}
      </p>
      {drifted ? (
        <p className="mt-2 text-sm leading-5 text-warning">
          Hay pedidos con otro precio en la ficha de hoy. El cierre sigue con el total guardado.
        </p>
      ) : null}
      {costDrifted ? (
        <p className="mt-2 text-sm leading-5 text-warning">
          Hay pedidos con otro costo en la ficha de hoy. El cierre sigue con el costo y el total guardados.
        </p>
      ) : null}
      {periodShift ? <p className="mt-2 text-sm leading-5 text-muted">{periodShift}</p> : null}

      <div className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-3">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Totales</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Metric
            label="Registrados"
            amount={formatCop(summary.registered.amount)}
            count={orderCountLabel(summary.registered.count)}
            numbers={summary.registered.numbers}
            hint="Total guardado. Sin cancelados ni devueltos."
          />
          <Metric
            label="Confirmados"
            amount={formatCop(summary.confirmed.amount)}
            count={orderCountLabel(summary.confirmed.count)}
            numbers={summary.confirmed.numbers}
            hint="Ya confirmados. No es dinero cobrado."
          />
          <Metric
            label="Entregados"
            amount={formatCop(summary.delivered.amount)}
            count={orderCountLabel(summary.delivered.count)}
            numbers={summary.delivered.numbers}
            hint="Estado entregado. No es dinero cobrado."
          />
          <Metric
            label="Cobrados"
            amount={formatCop(summary.collected.amount)}
            count={orderCountLabel(summary.collected.count)}
            numbers={summary.collected.numbers}
            hint="Marcados como cobrados. No es un cobro de este sitio."
          />
          <Metric
            label="Margen estimado"
            amount={formatCop(summary.estimatedMargin.amount)}
            numbers={summary.estimatedMargin.numbers}
            hint="De confirmados. No es utilidad realizada."
          />
          <Metric
            label="Utilidad realizada"
            amount={formatCop(summary.realized.amount)}
            numbers={summary.realized.numbers}
            hint="Entregados y cobrados. No es el total guardado."
          />
          <Metric
            label="Devueltos"
            amount={formatCop(summary.returned.amount)}
            count={orderCountLabel(summary.returned.count)}
            numbers={summary.returned.numbers}
            hint="No entra a la utilidad."
          />
          {summary.returnFreight > 0 ? (
            <Metric
              label="Flete devolución"
              amount={formatCop(summary.returnFreight)}
              numbers={summary.returnFreightNumbers}
              hint="Resta de la utilidad."
            />
          ) : null}
          {summary.collectionCost > 0 ? (
            <Metric
              label="Recaudo real"
              amount={formatCop(summary.collectionCost)}
              numbers={summary.collectionCostNumbers}
              hint="No es el total guardado."
            />
          ) : null}
        </ul>
        {summary.estimatedMargin.missingNumbers.length > 0 ? (
          <p className="mt-2 text-xs leading-5 text-warning">
            Sin costo (no entran al margen): {summary.estimatedMargin.missingNumbers.join(", ")}
          </p>
        ) : null}
        {summary.realized.missingNumbers.length > 0 ? (
          <p className="mt-1 text-xs leading-5 text-warning">
            Cobrado sin costo (no entran a utilidad): {summary.realized.missingNumbers.join(", ")}
          </p>
        ) : null}
      </div>

      <div className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-3">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Por producto</p>
        {products.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {period === "todo"
              ? "No hay pedidos confirmados ni devueltos."
              : "En este período no hay pedidos confirmados ni devueltos."}
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {products.map((row) => {
              const sources = row.sources
                .map((source) => `${source.number} ${STATUS_LABEL[source.status]}`)
                .join(" · ");
              const drift = resultDriftNote(orders, row.sku, priceGuides, costGuides);
              return (
                <li key={row.sku} className="rounded-[12px] border border-line bg-canvas px-3 py-2.5">
                  <p className="text-sm font-semibold">{row.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{row.sku}</p>
                  {sources ? <p className="mt-1 text-xs text-muted">{sources}</p> : null}
                  <dl className="mt-2 grid gap-1.5 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="font-bold tracking-[0.06em] text-muted uppercase">Margen est.</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">
                        {row.confirmedUnits > 0 ? formatCop(row.estimatedMargin) : "—"}
                      </dd>
                      <dd className="text-muted">
                        {row.confirmedUnits > 0
                          ? `${row.confirmedUnits} u. · total ${formatCop(row.confirmedAmount)}`
                          : "Sin confirmadas"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold tracking-[0.06em] text-muted uppercase">Utilidad</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">
                        {row.realizedUnits > 0 && row.realizedMissingUnits === row.realizedUnits
                          ? "Sin costo"
                          : row.realizedUnits > 0
                            ? formatCop(row.realizedMargin)
                            : "—"}
                      </dd>
                      <dd className="text-muted">
                        {row.realizedUnits > 0
                          ? `${row.realizedUnits} u. entregada${row.realizedUnits === 1 ? "" : "s"} cobrada${row.realizedUnits === 1 ? "" : "s"}`
                          : "Todavía no entra"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold tracking-[0.06em] text-muted uppercase">Devuelto</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">{formatCop(row.returnedAmount)}</dd>
                      <dd className="text-muted">
                        {row.returnFreight > 0
                          ? `Flete ${formatCop(row.returnFreight)}`
                          : "No entra a utilidad"}
                      </dd>
                    </div>
                  </dl>
                  {drift ? <p className="mt-2 text-xs leading-5 text-warning">{drift}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="elevate-1 mt-2 rounded-[14px] border border-dashed border-line bg-card px-3 py-2.5">
        <p className="text-sm font-semibold">¿Pegar el cierre completo?</p>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          Opcional. El resumen de arriba ya se puede leer. Usa esto solo si lo vas a pegar en otro lado.
        </p>
        <nav aria-label="Consulta" className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            title="No crea el pedido en Dropi."
            className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
            onClick={() => void copy()}
          >
            {copied === "ok" ? "Cierre copiado" : "Copiar cierre completo"}
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-[10px] px-3 text-sm font-semibold text-muted underline-offset-2 hover:underline"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll ? "Ocultar texto" : "Ver texto completo"}
          </button>
        </nav>
        {showAll ? (
          <textarea
            id={fieldId}
            readOnly
            rows={8}
            value={text}
            className="mt-2 min-h-32 w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm leading-5 text-ink focus:border-accent focus:outline-none"
          />
        ) : (
          <textarea id={fieldId} readOnly hidden value={text} aria-hidden="true" tabIndex={-1} />
        )}
        {copied === "ok" ? (
          <p role="status" className="mt-2 text-sm text-accent-strong">
            Listo para pegarlo a mano. No cambia pedidos ni crea Dropi.
          </p>
        ) : null}
        {copied === "fail" ? (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger">
            No se pudo copiar. Intenta de nuevo.
          </p>
        ) : null}
      </div>
    </section>
  );
}
