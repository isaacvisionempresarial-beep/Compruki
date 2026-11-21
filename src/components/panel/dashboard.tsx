"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AttentionSheet } from "@/components/panel/attention-sheet";
import { CloseSheet } from "@/components/panel/close-sheet";
import { CloseBasisControl, PeriodControl } from "@/components/panel/period-control";
import { usePanelQuery } from "@/components/panel/panel-shell";
import { CollectedPill, StatusPill } from "@/components/panel/status-pill";
import { STATUS_LABEL, type Period } from "@/lib/demo-data";
import { cx } from "@/lib/cx";
import { formatCop, formatDay } from "@/lib/format";
import { attentionQueueIsOwnerMoney, attentionQueues, awaitsDropiNumber, closePhrase, lineName, needsClosedDropiNumber, needsIncidenceDropiNumber, orderFocusHref, ordersInSpan, priceDrift, priceDriftNote, resultsByProduct, samePhoneMatches, summarizeStoreOrders, widerPeriodWithResults, type CloseBasis, type PriceGuide, type SizeGuide, type StoreOrder } from "@/lib/store-order";

const homeProductGrid = "md:grid-cols-[minmax(0,1.5fr)_8.75rem_8.75rem_8.75rem]";

export type AgentPendingSummary = {
  total: number;
  pedidos: number;
  borradores: number;
  agentes: number;
  preview: Array<{
    id: string;
    kind: "pedido" | "agente" | "borrador";
    label: string;
    detail: string;
    href: string;
  }>;
};

export function Dashboard({
  storeOrders,
  sizeGuides,
  priceGuides = [],
  today,
  greetingName,
  canManageOrderMoney = false,
  canApproveCatalog = false,
  agentPendingCount = 0,
  agentPendingSummary = null,
}: {
  storeOrders: StoreOrder[];
  sizeGuides: SizeGuide[];
  priceGuides?: PriceGuide[];
  today: string;
  greetingName: string;
  canManageOrderMoney?: boolean;
  canApproveCatalog?: boolean;
  agentPendingCount?: number;
  agentPendingSummary?: AgentPendingSummary | null;
}) {
  const [storePeriod, setStorePeriod] = useState<Period>("7d");
  const [basis, setBasis] = useState<CloseBasis>("creados");
  const query = usePanelQuery().trim().toLocaleLowerCase("es");

  const storeInPeriod = useMemo(
    () => ordersInSpan(storeOrders, storePeriod, today, basis),
    [storeOrders, storePeriod, today, basis],
  );
  const storeSummary = useMemo(() => summarizeStoreOrders(storeInPeriod), [storeInPeriod]);
  const productRows = useMemo(() => resultsByProduct(storeInPeriod, sizeGuides), [storeInPeriod, sizeGuides]);
  const widerStorePeriod =
    productRows.length === 0 ? widerPeriodWithResults(storeOrders, storePeriod, sizeGuides, today, basis) : null;
  const productResults = useMemo(() => {
    if (!query) return productRows;
    return productRows.filter((row) =>
      [row.title, row.sku, ...row.sizes.map((size) => size.label), ...row.sources.map((source) => source.number)].some((value) => value.toLocaleLowerCase("es").includes(query)),
    );
  }, [productRows, query]);
  const attention = useMemo(
    () => attentionQueues(storeOrders, sizeGuides, canManageOrderMoney),
    [storeOrders, sizeGuides, canManageOrderMoney],
  );
  const waiting = useMemo(() => {
    const rows = attention.flatMap((queue) => queue.rows.map((row) => ({ ...row, queueTitle: queue.title })));
    if (!query) return rows;
    return rows.filter((row) =>
      [
        row.queueTitle,
        row.note,
        row.cta,
        ...row.also,
        row.order.number,
        row.order.customerName,
        row.order.city,
        row.order.department ?? "",
        row.order.campaignEntry ? "campaña" : "",
        priceDrift(row.order, priceGuides).length > 0 ? "la ficha cambió" : "",
        ...row.order.lines.flatMap((line) => [line.title, line.sku, line.variant ?? ""]),
      ].some((value) => value.toLocaleLowerCase("es").includes(query)),
    );
  }, [attention, priceGuides, query]);

  const orderWork = useMemo(() => {
    let yours = 0;
    let ownerMoney = 0;
    for (const queue of attention) {
      const money = attentionQueueIsOwnerMoney(queue.id);
      if (!canManageOrderMoney && money) ownerMoney += queue.rows.length;
      else yours += queue.rows.length;
    }
    return { yours, ownerMoney };
  }, [attention, canManageOrderMoney]);
  const syncWorkCount = useMemo(
    () =>
      storeOrders.filter(
        (order) => awaitsDropiNumber(order) || needsIncidenceDropiNumber(order) || needsClosedDropiNumber(order),
      ).length,
    [storeOrders],
  );

  const storeCards = [
    { label: "Registrados", ...storeSummary.registered, hint: "Total guardado. Sin cancelados ni devueltos. No es dinero cobrado." },
    { label: "Confirmados", ...storeSummary.confirmed, hint: "Total guardado. Ya confirmados. No es dinero cobrado." },
    { label: "Entregados", ...storeSummary.delivered, hint: "Total guardado. Estado entregado. No es dinero cobrado." },
    { label: "Cobrados", ...storeSummary.collected, hint: "Total guardado de los marcados como cobrados. No es un cobro de este sitio ni la utilidad." },
  ];

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Resumen</p>
          <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">
            Hola {greetingName}, tu tienda está en modo venta
          </h1>
          <p className="mt-1 text-sm text-muted">
            {canManageOrderMoney
              ? "Cifras y pendientes de los pedidos de la tienda. Verlas no cobra ni cambia pedidos. Dropi no está conectado."
              : "Cifras de la tienda. El flete, el costo, el cobro y los precios los guarda el propietario. Verlas no cobra ni cambia pedidos. Dropi no está conectado."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={agentPendingCount > 0 ? "/panel/agentes#pendientes-humanos" : "/panel/agentes"}
            title="Abrirlo no cobra ni cambia pedidos."
            className="inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-card px-4 text-sm font-semibold text-ink hover:bg-subtle"
          >
            Centro de agentes
            {agentPendingCount > 0 ? (
              <span className="ml-2 rounded-[8px] bg-coral/15 px-2 py-0.5 text-xs font-bold text-coral">
                {agentPendingCount}
              </span>
            ) : null}
          </Link>
          <Link
            href="/panel/agentes?intent=margen%20LAM-MES-01"
            title="Abrirlo no cobra ni cambia pedidos."
            className="inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-card px-4 text-sm font-semibold text-accent-strong hover:bg-subtle"
          >
            Probar Central
          </Link>
        </div>
      </header>

      {agentPendingSummary && agentPendingSummary.total > 0 ? (
        <section
          className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3"
          aria-labelledby="pendientes-agentes-home"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="pendientes-agentes-home" className="text-sm font-semibold">
                Pendientes humanos ({agentPendingSummary.total})
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {agentPendingSummary.pedidos} pedido{agentPendingSummary.pedidos === 1 ? "" : "s"}
                {" · "}
                {agentPendingSummary.borradores} borrador{agentPendingSummary.borradores === 1 ? "" : "es"}
                {" · "}
                {agentPendingSummary.agentes} corrida{agentPendingSummary.agentes === 1 ? "" : "s"}
                {canApproveCatalog ? "" : ". Puedes rechazar. Aprobar un borrador o una corrida lo guarda el propietario."}
              </p>
            </div>
            <Link href="/panel/agentes#pendientes-humanos" title="Abrirla no cobra ni cambia pedidos." className="text-sm font-semibold text-accent-strong">
              Abrir bandeja
            </Link>
          </div>
          <ul className="mt-2 space-y-1.5">
            {agentPendingSummary.preview.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="text-sm">
                <span className="mr-2 rounded-[8px] border border-line px-1.5 py-0.5 text-[10px] font-bold tracking-[0.06em] text-muted uppercase">
                  {item.kind}
                </span>
                <Link href={item.href} title="Abrirlo no cobra ni cambia el total guardado." className="font-semibold text-accent-strong">
                  {item.label}
                </Link>
                <span className="text-muted"> · {item.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_13.5rem]">
      <div className="order-2 min-w-0 xl:order-1">
      <section aria-labelledby="tienda-titulo">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Tienda pública</p>
            <h2 id="tienda-titulo" className="mt-0.5 text-base font-bold leading-7">
              Pedidos de la tienda
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Cifras de {closePhrase(storePeriod, basis)}. Verlas no cobra ni cambia pedidos.
              {basis === "movidos" ? " El total guardado es el del pedido, no lo cobrado en ese día." : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <CloseBasisControl basis={basis} onChange={setBasis} name="base-tienda" />
            <PeriodControl
              period={storePeriod}
              onChange={setStorePeriod}
              name="periodo-tienda"
              legend="Período de los pedidos de la tienda"
            />
            <Link
              href="/panel/pedidos"
              title="Abrirlos no cobra ni cambia el total guardado."
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
                      <Link href={orderFocusHref(number)} title="Abrirlo no cobra ni cambia el total guardado." className="font-semibold text-accent-strong">
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
              Margen de confirmados. No es dinero cobrado ni el total guardado.
              <OrderListPhrase numbers={storeSummary.estimatedMargin.numbers} lead=":" />
            </dd>
            {storeSummary.estimatedMargin.missingNumbers.length > 0 ? (
              <dd className="mt-1 text-xs leading-5 text-muted">
                Sin costo{canManageOrderMoney ? "" : " · lo copia el propietario"}
                <OrderListPhrase numbers={storeSummary.estimatedMargin.missingNumbers} lead=":" />
              </dd>
            ) : null}
          </div>
          <div className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Utilidad realizada</dt>
            <dd className="mt-1 text-base font-extrabold tabular-nums">{formatCop(storeSummary.realized.amount)}</dd>
            <dd className="mt-1 text-xs leading-5 text-muted">
              Utilidad de pedidos entregados y marcados como cobrados. No es un cobro de este sitio ni el total guardado.
              <OrderListPhrase numbers={storeSummary.realized.numbers} lead=":" />
            </dd>
            {storeSummary.realized.missingNumbers.length > 0 || storeSummary.returnFreight > 0 || storeSummary.collectionCost > 0 ? (
              <dd className="mt-1 space-y-0.5 text-xs leading-5 text-muted">
                {storeSummary.realized.missingNumbers.length > 0 ? (
                  <span className="block">
                    Cobrado sin costo{canManageOrderMoney ? "" : " · lo copia el propietario"}
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
              Total guardado. No entra a la utilidad.
              <OrderListPhrase numbers={storeSummary.returned.numbers} lead=":" />
            </dd>
          </div>
        </dl>
        <h3 className="mt-3 text-sm font-semibold">Por producto ({productResults.length})</h3>
        <p className="mt-0.5 text-xs text-muted">
          Mismo período y la misma fecha · detalle en Rentabilidad
        </p>
        {productResults.length === 0 ? (
          <p className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2 text-sm text-muted">
            {productRows.length > 0
              ? "Ningún producto coincide con la búsqueda."
              : `En este período no hay pedidos confirmados ni devueltos.${widerStorePeriod ? ` En ${closePhrase(widerStorePeriod, basis)} sí hay.` : ""}`}
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
                            <Link href={orderFocusHref(source.number)} title="Abrirlo no cobra ni cambia el total guardado." className="font-semibold text-accent-strong">
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
                        ? `${row.confirmedUnits === 1 ? "1 unidad confirmada" : `${row.confirmedUnits} unidades confirmadas`}. Total guardado ${formatCop(row.confirmedAmount)}.`
                        : "Sin unidades confirmadas en este período."
                    }
                  />
                  <HomeProductFigure
                    label="Utilidad realizada"
                    value={productFigure(row.realizedUnits, row.realizedMissingUnits, row.realizedMargin)}
                    detail={
                      row.realizedUnits > 0 && row.realizedMissingUnits === row.realizedUnits
                        ? canManageOrderMoney
                          ? "Sin costo, no entra en la utilidad."
                          : "Sin costo, no entra en la utilidad. Lo copia el propietario."
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
                        ? `Total guardado. Flete de devolución ${formatCop(row.returnFreight)} que resta de la utilidad.`
                        : "Total guardado. No entra a la utilidad."
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
        <CloseSheet orders={storeInPeriod} period={storePeriod} basis={basis} guides={sizeGuides} fieldId="cierre-tienda" />
        <div className="mt-3">
          <Link href="/panel/rentabilidad" title="Verla no cobra ni cambia los pedidos." className="text-sm font-semibold text-accent-strong">
            Ver el detalle en Rentabilidad
          </Link>
        </div>
        <h3 className="mt-3 text-sm font-semibold">Por atender ({waiting.length})</h3>
        <p className="mt-0.5 text-xs text-muted">
          La misma cola que Pedidos. No se recorta por período. Buscar solo cambia esta lista.
        </p>
        {waiting.length === 0 ? (
          <p className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2 text-sm text-muted">
            {attention.length === 0
              ? "No hay pedidos esperando un dato o una acción."
              : "Ningún pedido de la cola coincide con la búsqueda."}
          </p>
        ) : (
          <ul className="elevate-1 mt-3 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-card">
            {waiting.map((row) => {
              const order = row.order;
              const phoneCount = samePhoneMatches(order, storeOrders).length;
              const place = [order.city, order.department].filter(Boolean).join(" · ");
              const products = order.lines.map((line) => `${line.quantity} × ${lineName(line)}`).join(", ");
              const driftNote = priceDriftNote(priceDrift(order, priceGuides));
              const meta = [
                place,
                products,
                order.campaignEntry ? "Campaña" : "",
                phoneCount === 1 ? "mismo celular en otro" : phoneCount > 1 ? `mismo celular en ${phoneCount} más` : "",
                row.also.length > 0 ? `También: ${row.also.join(", ")}` : "",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={order.id}>
                  <Link
                    href={orderFocusHref(order.number)}
                    title="Abrirlo no cobra ni cambia el total guardado."
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
                      <span className="mt-0.5 block text-[10px] font-bold tracking-[0.06em] text-muted uppercase">{row.queueTitle}</span>
                      <span className="block truncate text-sm font-semibold text-warning" title={row.note}>
                        {row.note}
                      </span>
                      {driftNote ? (
                        <span className="mt-0.5 block text-xs leading-5 text-warning" title={driftNote}>
                          {driftNote}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                      <span className="text-right">
                        <span className="block text-[10px] font-bold tracking-[0.06em] text-muted uppercase">Total guardado</span>
                        <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{formatCop(order.total)}</span>
                      </span>
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <StatusPill status={order.status} />
                        {order.collected ? <CollectedPill /> : null}
                      </span>
                      <span className="text-sm font-semibold whitespace-nowrap text-primary">{row.cta}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <AttentionSheet orders={storeOrders} guides={sizeGuides} priceGuides={priceGuides} canManageOrderMoney={canManageOrderMoney} />
      </section>


      <section className="mt-5" aria-labelledby="entradas">
        <h3 id="entradas" className="text-sm font-semibold">
          Dónde se trabaja
        </h3>
        <p className="mt-0.5 text-xs text-muted">
          Todos los pedidos de la tienda · buscar no cambia estas cifras. Abrirlas no cobra ni cambia pedidos.
        </p>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2">
          <li>
            <Link href="/panel/pedidos" title="Abrirlos no cobra ni cambia el total guardado." className="elevate-1 block rounded-[14px] border border-line bg-card px-3 py-2 hover:bg-canvas">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Pedidos</span>
              <span className="mt-1 block text-sm font-bold">
                {orderWork.yours} {orderWork.yours === 1 ? "pedido por atender" : "pedidos por atender"}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-muted">
                {canManageOrderMoney
                  ? "Cola «Por atender»: un pedido, un siguiente paso."
                  : orderWork.ownerMoney > 0
                    ? `${orderWork.ownerMoney === 1 ? "1 pedido con flete, costo o recaudo lo guarda el propietario." : `${orderWork.ownerMoney} pedidos con flete, costo o recaudo los guarda el propietario.`} Tú sigues estado, entrega, talla y aviso.`
                    : "Este número es lo que puedes hacer: estado, entrega, talla y aviso."}
              </span>
            </Link>
          </li>
          <li>
            <Link href="/panel/sincronizacion" title="Abrirla no cobra. El total guardado no cambia." className="elevate-1 block rounded-[14px] border border-line bg-card px-3 py-2 hover:bg-canvas">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Sincronización</span>
              <span className="mt-1 block text-sm font-bold">
                {syncWorkCount} {syncWorkCount === 1 ? "pedido sin número de Dropi" : "pedidos sin número de Dropi"}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-muted">
                Anotar el número lo concilia a mano. No se envía a Dropi y el total guardado no cambia.
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
                {canManageOrderMoney
                  ? "La misma cola que Pedidos. No se recorta por período. Copiarla no cobra ni envía el mensaje."
                  : "La misma cola que Pedidos. El flete y el costo los guarda el propietario. Copiarla no cobra ni envía el mensaje."}
              </span>
            </li>
            <li>
              <span className="font-semibold text-sm">Estimado vs utilidad</span>
              <span className="mt-0.5 block text-muted">
                Estimado = margen de pedidos confirmados. Utilidad = entregado y marcado como cobrado. Ninguna es dinero cobrado en el sitio ni el total guardado del pedido.
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs leading-5 text-muted">
            Leerlas no cobra ni cambia pedidos. Dropi no está conectado. El número se anota en{" "}
            <Link href="/panel/sincronizacion" title="Abrirla no cobra. El total guardado no cambia." className="font-semibold text-accent-strong">
              Sincronización
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
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
          <Link href={orderFocusHref(number)} title="Abrirlo no cobra ni cambia el total guardado." className="font-semibold text-accent-strong">
            {number}
          </Link>
        </span>
      ))}
    </>
  );
}

