"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PeriodControl } from "@/components/panel/period-control";
import { usePanelQuery } from "@/components/panel/panel-shell";
import { CollectedPill, StatusPill } from "@/components/panel/status-pill";
import { STATUS_LABEL, type Period } from "@/lib/demo-data";
import { cx } from "@/lib/cx";
import { formatCop, formatDay } from "@/lib/format";
import { awaitsDropiNumber, confirmQueueNote, lineName, missingSizeNote, needsCatalogCost, needsClosedDropiNumber, needsCustomerNotice, needsDepartment, needsClosedDepartment, needsIncidenceDropiNumber, needsIncidenceReason, needsReturnReason, needsReturnFreight, needsSize, orderFocusHref, readyToConfirm, readyToDispatch, readyToPrepare, periodPhrase, resultsByProduct, samePhoneMatches, storeOrdersInPeriod, summarizeStoreOrders, widerPeriodWithResults, type SizeGuide, type StoreOrder } from "@/lib/store-order";

const homeProductGrid = "md:grid-cols-[minmax(0,1.5fr)_8.75rem_8.75rem_8.75rem]";

export function Dashboard({
  storeOrders,
  sizeGuides,
  today,
  greetingName,
}: {
  storeOrders: StoreOrder[];
  sizeGuides: SizeGuide[];
  today: string;
  greetingName: string;
}) {
  const [storePeriod, setStorePeriod] = useState<Period>("7d");
  const query = usePanelQuery().trim().toLocaleLowerCase("es");

  const storeInPeriod = useMemo(
    () => storeOrdersInPeriod(storeOrders, storePeriod, today),
    [storeOrders, storePeriod, today],
  );
  const storeSummary = useMemo(() => summarizeStoreOrders(storeInPeriod), [storeInPeriod]);
  const productRows = useMemo(() => resultsByProduct(storeInPeriod, sizeGuides), [storeInPeriod, sizeGuides]);
  const widerStorePeriod =
    productRows.length === 0 ? widerPeriodWithResults(storeOrders, storePeriod, sizeGuides, today) : null;
  const productResults = useMemo(() => {
    if (!query) return productRows;
    return productRows.filter((row) =>
      [row.title, row.sku, ...row.sizes.map((size) => size.label), ...row.sources.map((source) => source.number)].some((value) => value.toLocaleLowerCase("es").includes(query)),
    );
  }, [productRows, query]);
  const waiting = useMemo(() => {
    const pending = storeOrders.filter(
      (order) => order.status === "pendiente_confirmacion" || order.status === "incidencia",
    );
    if (!query) return pending;
    return pending.filter((order) =>
      [order.number, order.customerName, order.city, order.campaignEntry ? "campaña" : "", missingSizeNote(order, sizeGuides), ...order.lines.flatMap((line) => [line.title, line.sku, line.variant ?? ""])].some(
        (value) => value.toLocaleLowerCase("es").includes(query),
      ),
    );
  }, [storeOrders, sizeGuides, query]);

  const orderWorkCount = useMemo(
    () =>
      storeOrders.filter(
        (order) =>
          readyToConfirm(order, sizeGuides) ||
          needsSize(order, sizeGuides) ||
          needsDepartment(order) ||
          needsClosedDepartment(order) ||
          readyToPrepare(order) ||
          readyToDispatch(order) ||
          needsIncidenceReason(order) ||
          needsReturnReason(order) ||
          needsReturnFreight(order) ||
          needsCatalogCost(order) ||
          needsCustomerNotice(order),
      ).length,
    [storeOrders, sizeGuides],
  );
  const syncWorkCount = useMemo(
    () =>
      storeOrders.filter(
        (order) => awaitsDropiNumber(order) || needsIncidenceDropiNumber(order) || needsClosedDropiNumber(order),
      ).length,
    [storeOrders],
  );

  const storeCards = [
    { label: "Registrados", ...storeSummary.registered, hint: "Sin cancelados ni devueltos" },
    { label: "Confirmados", ...storeSummary.confirmed, hint: "Ya confirmados" },
    { label: "Entregados", ...storeSummary.delivered, hint: "Estado entregado" },
    { label: "Cobrados", ...storeSummary.collected, hint: "Dinero que ya entró" },
  ];

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Resumen</p>
          <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">
            Hola {greetingName}, tu tienda está en modo venta
          </h1>
          <p className="mt-1 text-sm text-muted">
            Cifras y pendientes de los pedidos de la tienda. Dropi no está conectado.
          </p>
        </div>
      </header>

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_13.5rem]">
      <div className="order-2 min-w-0 xl:order-1">
      <section aria-labelledby="tienda-titulo">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Tienda pública</p>
            <h2 id="tienda-titulo" className="mt-0.5 text-base font-bold leading-7">
              Pedidos de la tienda
            </h2>
            <p className="mt-0.5 text-xs text-muted">Cifras de {periodPhrase(storePeriod)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <PeriodControl
              period={storePeriod}
              onChange={setStorePeriod}
              name="periodo-tienda"
              legend="Período de los pedidos de la tienda"
            />
            <Link
              href="/panel/pedidos"
              className="inline-flex h-10 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft"
            >
              Atender pedidos
            </Link>
          </div>
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {storeCards.map((card) => (
            <li key={card.label} className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2">
              <p className="text-[10px] font-bold tracking-[0.06em] text-muted uppercase">{card.label}</p>
              <p className="mt-1 text-lg leading-5 font-extrabold tracking-tight tabular-nums">{formatCop(card.amount)}</p>
              <p className="mt-0.5 text-xs text-muted">
                {card.count} {card.count === 1 ? "pedido" : "pedidos"} · {card.hint}
              </p>
              {card.numbers.length > 0 ? (
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm leading-5">
                  {card.numbers.map((number) => (
                    <li key={number}>
                      <Link href={orderFocusHref(number)} className="font-semibold text-accent-strong">
                        {number}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Margen estimado</dt>
            <dd className="mt-1 text-base font-extrabold tabular-nums">{formatCop(storeSummary.estimatedMargin.amount)}</dd>
            <dd className="mt-1 text-xs leading-5 text-muted">
              Confirmados · estimado
              <OrderListPhrase numbers={storeSummary.estimatedMargin.numbers} lead=":" />
            </dd>
            {storeSummary.estimatedMargin.missingNumbers.length > 0 ? (
              <dd className="mt-1 text-xs leading-5 text-muted">
                Sin costo: <OrderListPhrase numbers={storeSummary.estimatedMargin.missingNumbers} lead=":" />
              </dd>
            ) : null}
          </div>
          <div className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Utilidad realizada</dt>
            <dd className="mt-1 text-base font-extrabold tabular-nums">{formatCop(storeSummary.realized.amount)}</dd>
            <dd className="mt-1 text-xs leading-5 text-muted">
              Ya cobrado
              <OrderListPhrase numbers={storeSummary.realized.numbers} lead=":" />
            </dd>
            {storeSummary.realized.missingNumbers.length > 0 || storeSummary.returnFreight > 0 || storeSummary.collectionCost > 0 ? (
              <dd className="mt-1 space-y-0.5 text-xs leading-5 text-muted">
                {storeSummary.realized.missingNumbers.length > 0 ? (
                  <span className="block">
                    Cobrado sin costo
                    <OrderListPhrase numbers={storeSummary.realized.missingNumbers} lead=":" />
                  </span>
                ) : null}
                {storeSummary.returnFreight > 0 ? (
                  <span className="block">
                    Flete devolución {formatCop(storeSummary.returnFreight)}
                    <OrderListPhrase numbers={storeSummary.returnFreightNumbers} lead="de" />
                  </span>
                ) : null}
                {storeSummary.collectionCost > 0 ? (
                  <span className="block">
                    Recaudo real {formatCop(storeSummary.collectionCost)}
                    <OrderListPhrase numbers={storeSummary.collectionCostNumbers} lead="de" />
                  </span>
                ) : null}
              </dd>
            ) : null}
          </div>
          <div className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Devueltos</dt>
            <dd className="mt-1 text-base font-extrabold tabular-nums">{formatCop(storeSummary.returned.amount)}</dd>
            <dd className="mt-1 text-xs leading-5 text-muted">
              No entra a la utilidad
              <OrderListPhrase numbers={storeSummary.returned.numbers} lead=":" />
            </dd>
          </div>
        </dl>
        <h3 className="mt-3 text-sm font-semibold">Por producto ({productResults.length})</h3>
        <p className="mt-0.5 text-xs text-muted">
          Mismo período · detalle en Rentabilidad
        </p>
        {productResults.length === 0 ? (
          <p className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2 text-sm text-muted">
            {productRows.length > 0
              ? "Ningún producto coincide con la búsqueda."
              : `En este período no hay pedidos confirmados ni devueltos.${widerStorePeriod ? ` En ${periodPhrase(widerStorePeriod)} sí hay.` : ""}`}
          </p>
        ) : (
          <div className="elevate-1 mt-3 overflow-hidden rounded-[14px] border border-line bg-card">
            <div
              className={cx(
                "hidden items-end gap-4 border-b border-line bg-canvas px-3 py-2 text-[11px] font-semibold tracking-[0.04em] text-muted uppercase md:grid",
                homeProductGrid,
              )}
            >
              <span>Producto</span>
              <span className="text-right">Margen estimado</span>
              <span className="text-right">Utilidad realizada</span>
              <span className="text-right">Devuelto</span>
            </div>
            <ul className="divide-y divide-line">
              {productResults.map((row) => (
                <li key={row.sku} className={cx("grid items-start gap-3 px-3 py-2 md:gap-4", homeProductGrid)}>
                  <div className="min-w-0">
                    <p className="text-base font-bold">{row.title}</p>
                    <p className="mt-1 text-xs text-muted">{row.sku}</p>
                    {row.sources.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-sm leading-5">
                        {row.sources.map((source) => (
                          <li key={source.number}>
                            <Link href={orderFocusHref(source.number)} className="font-semibold text-accent-strong">
                              {source.number}
                            </Link>
                            <span className="text-muted"> · {STATUS_LABEL[source.status]}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <HomeProductFigure
                    label="Margen estimado"
                    value={productFigure(row.confirmedUnits, row.estimatedMissingUnits, row.estimatedMargin)}
                    detail={
                      row.confirmedUnits > 0
                        ? `${row.confirmedUnits === 1 ? "1 unidad confirmada" : `${row.confirmedUnits} unidades confirmadas`} · ${formatCop(row.confirmedAmount)}`
                        : "Sin unidades confirmadas en este período."
                    }
                  />
                  <HomeProductFigure
                    label="Utilidad realizada"
                    value={productFigure(row.realizedUnits, row.realizedMissingUnits, row.realizedMargin)}
                    detail={
                      row.realizedUnits > 0 && row.realizedMissingUnits === row.realizedUnits
                        ? "Sin costo, no entra en la utilidad."
                        : row.realizedUnits > 0
                          ? `${row.realizedUnits === 1 ? "1 unidad entregada y cobrada" : `${row.realizedUnits} unidades entregadas y cobradas`}`
                          : "Todavía no entra en la utilidad."
                    }
                  />
                  <HomeProductFigure
                    label="Devuelto"
                    value={formatCop(row.returnedAmount)}
                    detail={
                      row.returnFreight > 0
                        ? `Flete de devolución ${formatCop(row.returnFreight)} que resta.`
                        : "No entra a la utilidad."
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-3">
          <Link href="/panel/rentabilidad" className="text-sm font-semibold text-accent-strong">
            Ver el detalle en Rentabilidad
          </Link>
        </div>
        <h3 className="mt-3 text-sm font-semibold">Pendientes e incidencias ({waiting.length})</h3>
        <p className="mt-0.5 text-xs text-muted">
          Siguiente paso aquí · cola completa en Pedidos → Por atender
        </p>
        {waiting.length === 0 ? (
          <p className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2 text-sm text-muted">
            {storeOrders.some((order) => order.status === "pendiente_confirmacion" || order.status === "incidencia")
              ? "Ningún pedido de la tienda coincide con la búsqueda."
              : "No hay pedidos pendientes ni con incidencia."}
          </p>
        ) : (
          <ul className="elevate-1 mt-3 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-card">
            {waiting.map((order) => {
              const step = waitingNextStep(order, sizeGuides);
              const phoneCount = samePhoneMatches(order, storeOrders).length;
              const place = [order.city, order.department].filter(Boolean).join(" · ");
              const products = order.lines.map((line) => `${line.quantity} × ${lineName(line)}`).join(", ");
              const meta = [
                place,
                products,
                order.campaignEntry ? "Campaña" : "",
                phoneCount === 1 ? "mismo celular en otro" : phoneCount > 1 ? `mismo celular en ${phoneCount} más` : "",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={order.id}>
                  <Link
                    href={orderFocusHref(order.number)}
                    className="flex flex-col gap-2 px-3 py-2 hover:bg-canvas sm:flex-row sm:items-center sm:gap-3"
                  >
                    <span className="w-[4.75rem] shrink-0">
                      <span className="block text-sm font-bold">{order.number}</span>
                      <span className="block text-xs text-muted">{formatDay(order.createdAt.slice(0, 10))}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{order.customerName}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted" title={meta}>
                        {meta}
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-semibold text-warning" title={step.note}>
                        {step.note}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                      <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{formatCop(order.total)}</span>
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <StatusPill status={order.status} />
                        {order.collected ? <CollectedPill /> : null}
                      </span>
                      <span className="text-sm font-semibold whitespace-nowrap text-primary">{step.cta}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>


      <section className="mt-5" aria-labelledby="entradas">
        <h3 id="entradas" className="text-sm font-semibold">
          Dónde se trabaja
        </h3>
        <p className="mt-0.5 text-xs text-muted">
          Todos los pedidos de la tienda · buscar no cambia estas cifras
        </p>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2">
          <li>
            <Link href="/panel/pedidos" className="elevate-1 block rounded-[14px] border border-line bg-card px-3 py-2 hover:bg-canvas">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Pedidos</span>
              <span className="mt-1 block text-sm font-bold">
                {orderWorkCount} {orderWorkCount === 1 ? "pedido por atender" : "pedidos por atender"}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-muted">
                Cola «Por atender»: un pedido, un siguiente paso.
              </span>
            </Link>
          </li>
          <li>
            <Link href="/panel/sincronizacion" className="elevate-1 block rounded-[14px] border border-line bg-card px-3 py-2 hover:bg-canvas">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Sincronización</span>
              <span className="mt-1 block text-sm font-bold">
                {syncWorkCount} {syncWorkCount === 1 ? "pedido sin número de Dropi" : "pedidos sin número de Dropi"}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-muted">
                Copiar entrega y anotar el número a mano.
              </span>
            </Link>
          </li>
        </ul>
      </section>

      </div>

        <aside className="elevate-1 order-1 rounded-[14px] border border-line bg-card px-3 py-2 xl:sticky xl:top-[3.75rem] xl:order-2">
          <h2 className="text-sm font-semibold">Cómo se lee</h2>
          <ul className="mt-2 space-y-2 text-xs leading-5">
            <li>
              <span className="font-semibold text-sm">Cifras</span>
              <span className="mt-0.5 block text-muted">
                Pedidos reales de la tienda en el período elegido.
              </span>
            </li>
            <li>
              <span className="font-semibold text-sm">Siguiente paso</span>
              <span className="mt-0.5 block text-muted">
                Pendientes aquí; la cola completa en Pedidos → Por atender.
              </span>
            </li>
            <li>
              <span className="font-semibold text-sm">Estimado vs cobrado</span>
              <span className="mt-0.5 block text-muted">
                Estimado = confirmados. Utilidad = entregado y cobrado.
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs leading-5 text-muted">
            Dropi no está conectado. El número se anota en{" "}
            <Link href="/panel/sincronizacion" className="font-semibold text-accent-strong">
              Sincronización
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}

function waitingNextStep(order: StoreOrder, guides: SizeGuide[]) {
  if (order.status === "incidencia") {
    if (needsIncidenceReason(order)) {
      return { note: "Falta el motivo de la incidencia.", cta: "Anotar motivo" };
    }
    return { note: "Incidencia abierta.", cta: "Ver pedido" };
  }
  if (needsSize(order, guides)) {
    return { note: "Falta la talla o el tamaño.", cta: "Anotar talla" };
  }
  if (readyToConfirm(order, guides)) {
    const confirm = confirmQueueNote(order, guides);
    return { note: confirm && confirm.length < 60 ? confirm : "Listo para confirmar.", cta: "Confirmar" };
  }
  if (needsDepartment(order)) {
    return { note: "Falta el departamento.", cta: "Anotar departamento" };
  }
  return { note: "Pendiente de confirmación.", cta: "Ver pedido" };
}

function HomeProductFigure({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="md:pt-0.5 md:text-right">
      <p className="mb-1 text-[10px] font-bold tracking-[0.06em] text-muted uppercase md:sr-only">{label}</p>
      <p className="text-base font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
    </div>
  );
}

function productFigure(units: number, missing: number, amount: number) {
  if (units === 0) return formatCop(0);
  if (missing === units) return "sin costo guardado";
  return formatCop(amount);
}

function OrderListPhrase({ numbers, lead }: { numbers: string[]; lead: "de" | ":" }) {
  if (numbers.length === 0) return null;
  return (
    <>
      {lead === "de" ? " de " : ": "}
      {numbers.map((number, index) => (
        <span key={number}>
          {index === 0 ? "" : index === numbers.length - 1 ? " y " : ", "}
          <Link href={orderFocusHref(number)} className="font-semibold text-accent-strong">
            {number}
          </Link>
        </span>
      ))}
    </>
  );
}

