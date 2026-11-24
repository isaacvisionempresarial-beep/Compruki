"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { AttentionSheet } from "@/components/panel/attention-sheet";
import { CloseSheet } from "@/components/panel/close-sheet";
import { usePanelQuery } from "@/components/panel/panel-shell";
import { CollectedPill, StatusPill } from "@/components/panel/status-pill";
import { parsePesos, sizeChoiceLabel, variantFits } from "@/lib/catalog";
import { blockedDropiAnswer } from "@/lib/dropi-provider";
import { cx } from "@/lib/cx";
import { STATUS_LABEL, STATUS_SEQUENCE, type OrderStatus } from "@/lib/demo-data";
import { formatCop, formatDay } from "@/lib/format";
import {
  actionsFor,
  awaitsDropiNumber,
  canEditDelivery,
  canEditLines,
  canNoteDropiNumber,
  adoptCatalogCosts,
  catalogCostLines,
  catalogCostMix,
  previewMarginsWithCatalogCosts,
  previewMarginsWithFreight,
  catalogCostQueueNote,
  collectedWithoutCost,
  confirmQueueNote,
  confirmSizeError,
  costQueueWarning,
  applyOrderAction,
  attentionQueues,
  attentionCostAside,
  customerMessage,
  dispatchQueueNote,
  dropiHandoffText,
  storedUtilityCaveat,
  lineName,
  missingDepartmentNote,
  missingSizeNote,
  missingSizeQueueNote,
  needsCatalogCost,
  needsCustomerNotice,
  needsClosedDropiNumber,
  needsIncidenceDropiNumber,
  needsDepartment,
  needsClosedDepartment,
  needsIncidenceReason,
  needsReturnReason,
  needsReturnFreight,
  needsSize,
  prepareDropiError,
  prepareQueueNote,
  resolveIncidenceError,
  orderFocusHref,
  ordersInSpan,
  spanPhrase,
  dispatchSheetOrders,
  dispatchSheetText,
  type CloseBasis,
  type OrderSpan,
  accountHoldNote,
  costDrift,
  costDriftNote,
  priceDrift,
  orderPriceStayNote,
  payableTotalLabel,
  syncFocusHref,
  readyToConfirm,
  readyToDispatch,
  readyToPrepare,
  samePhoneMatches,
  whatsAppHref,
  needsCustomerReason,
  costShiftPhrase,
  orderCostCopyNote,
  periodCostShiftNote,
  orderMargin,
  ownerOnlyOrderIntent,
  orderRealizedMargin,
  recordedReturnFreight,
  summarizeStoreOrders,
  validateCustomerReason,
  validateDelivery,
  validateDepartment,
  type CostGuide,
  type PriceGuide,
  type StoreOrder,
  type SizeGuide,
} from "@/lib/store-order";
import type { OrderableProduct } from "@/server/catalog-store";
import { addOrderLineAction, applyCatalogCostAction, markCustomerNoticeAction, saveClosedDepartmentAction, saveDeliveryAction, saveFreightAction, saveIncidenceReasonAction, saveInternalNoteAction, saveOrderLinesAction, saveReturnReasonAction, updateOrderAction, type UpdateOrderState } from "@/server/store-actions";

const initialState: UpdateOrderState = { error: null, orderId: null };

const buttonTone = {
  primary: "bg-primary text-on-dark hover:bg-primary-soft",
  quiet: "border border-line bg-card text-ink",
  danger: "border border-danger/30 bg-danger-tint text-danger",
} as const;

function moneyStatusAction(id: string) {
  return ownerOnlyOrderIntent(id);
}

const orderGrid = "md:grid-cols-[6.75rem_minmax(0,1.5fr)_8.75rem_12.5rem_4.25rem]";
const historyGrid = "md:grid-cols-[7rem_9rem_minmax(0,1fr)]";
const queueGrid = "md:grid-cols-[6.75rem_minmax(0,1.2fr)_minmax(0,1.4fr)_4.25rem]";

const ORDER_SPANS: Array<{ id: OrderSpan; label: string }> = [
  { id: "todo", label: "Todo" },
  { id: "hoy", label: "Hoy" },
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
];

export function OrdersScreen({
  orders,
  sizeGuides,
  priceGuides = [],
  costGuides = [],
  canManageOrderMoney = false,
  today,
}: {
  orders: StoreOrder[];
  sizeGuides: SizeGuide[];
  priceGuides?: PriceGuide[];
  costGuides?: CostGuide[];
  canManageOrderMoney?: boolean;
  today: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus | "todos">("todos");
  const [span, setSpan] = useState<OrderSpan>("todo");
  const [basis, setBasis] = useState<CloseBasis>("creados");
  const query = usePanelQuery().trim().toLocaleLowerCase("es");
  const spanOrders = useMemo(() => ordersInSpan(orders, span, today, basis), [orders, span, today, basis]);
  const summary = useMemo(() => summarizeStoreOrders(spanOrders), [spanOrders]);
  const periodShift = useMemo(() => {
    const seen = new Set(spanOrders.map((order) => order.number));
    return periodCostShiftNote(spanOrders, costGuides, span === "todo" ? "" : "este período", span === "todo" ? [] : orders.filter((order) => !seen.has(order.number)));
  }, [costGuides, orders, span, spanOrders]);
  const searched = useMemo(() => spanOrders.filter((order) => matchesOrder(order, query, sizeGuides, priceGuides, costGuides)), [spanOrders, query, sizeGuides, priceGuides, costGuides]);
  const present = STATUS_SEQUENCE.filter((item) => spanOrders.some((order) => order.status === item));
  const visible = searched.filter((order) => status === "todos" || order.status === status);
  const work = workQueues(orders, sizeGuides, canManageOrderMoney, costGuides);

  useEffect(() => {
    function focusFromHash() {
      const prefix = "pedido-";
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash.startsWith(prefix)) return;
      const number = decodeURIComponent(hash.slice(prefix.length));
      router.replace(orderFocusHref(number));
    }
    focusFromHash();
    window.addEventListener("hashchange", focusFromHash);
    return () => window.removeEventListener("hashchange", focusFromHash);
  }, [router]);

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Tienda</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Pedidos recibidos</h1>
      <p className="mt-0.5 text-sm text-muted">
        {span === "todo"
          ? "Tienda pública. Las cifras y la lista son de todos los pedidos. La cola Por atender tampoco se recorta. Abrirlos no cobra ni cambia el total guardado. Dropi no está conectado."
          : basis === "movidos"
            ? `Tienda pública. Las cifras y la lista son pedidos con un movimiento en ${spanPhrase(span)}, aunque se hayan creado antes. El total guardado es el del pedido, no lo cobrado ese día. La cola Por atender no se recorta. Dropi no está conectado.`
            : `Tienda pública. Las cifras y la lista son de los creados en ${spanPhrase(span)}. La cola Por atender sigue con los que esperan, aunque sean de otro día. Cambiar el período no cobra ni cambia el total guardado. Dropi no está conectado.`}
      </p>
      <div className="elevate-1 mt-3 grid items-stretch gap-4 rounded-[14px] border border-line bg-card px-3 py-3 sm:grid-cols-2 sm:gap-x-6">
        <div className="flex min-w-0 flex-col">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Período</p>
          <p className="mt-0.5 text-xs leading-5 text-muted">
            Cambia las cifras y la lista. Por atender no se recorta. Elegir no cobra ni cambia el total guardado.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 sm:mt-auto sm:pt-3" role="radiogroup" aria-label="Período de las cifras y la lista">
            {ORDER_SPANS.map((item) => (
              <StatusFilter
                key={item.id}
                label={item.label}
                count={ordersInSpan(orders, item.id, today, basis).length}
                selected={span === item.id}
                onSelect={() => setSpan(item.id)}
              />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-col">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Fecha</p>
          <p className="mt-0.5 text-xs leading-5 text-muted">
            {span === "todo"
              ? "Con todos los pedidos no hace falta elegir fecha. El total guardado no cambia."
              : basis === "movidos"
                ? "Movidos mira el historial del pedido. El total guardado no es el dinero de ese día. Elegirlo no cobra."
                : "Creados mira solo la fecha en que entró el pedido. Elegirlo no cobra ni cambia el total guardado."}
          </p>
          {span === "todo" ? (
            <p className="mt-3 text-sm font-semibold sm:mt-auto sm:pt-3">Todos los pedidos</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2 sm:mt-auto sm:pt-3" role="radiogroup" aria-label="Qué fecha usa el período">
              <StatusFilter label="Creados" count={ordersInSpan(orders, span, today, "creados").length} selected={basis === "creados"} onSelect={() => setBasis("creados")} />
              <StatusFilter label="Movidos" count={ordersInSpan(orders, span, today, "movidos").length} selected={basis === "movidos"} onSelect={() => setBasis("movidos")} />
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">
        Dropi no está conectado. El número se anota en Sincronización. Abrirla no cobra. El total guardado no cambia.
      </p>
      <nav aria-label="Herramientas" className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
        <Link href="/panel/sincronizacion" title="Abrirla no cobra. El total guardado no cambia." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle">
          Abrir sincronización
        </Link>
      </nav>

      <section className="mt-5" aria-labelledby="cifras-periodo">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Cuenta</p>
      <h2 id="cifras-periodo" className="mt-0.5 text-base font-bold">Cifras del período</h2>
      <p className="mt-0.5 text-xs leading-5 text-muted">
        Siguen el período de arriba. Buscar o filtrar por estado solo cambia la lista de abajo. No cobra ni cambia el total guardado.
      </p>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummaryCard label="Registrados" value={formatCop(summary.registered.amount)} detail={`${countLabel(summary.registered.count)}. Total guardado.`} numbers={summary.registered.numbers} />
        <SummaryCard label="Confirmados" value={formatCop(summary.confirmed.amount)} detail={`${countLabel(summary.confirmed.count)}. Total guardado.`} numbers={summary.confirmed.numbers} />
        <SummaryCard label="Entregados" value={formatCop(summary.delivered.amount)} detail={`${countLabel(summary.delivered.count)}. Total guardado.`} numbers={summary.delivered.numbers} />
        <SummaryCard label="Cobrados" value={formatCop(summary.collected.amount)} detail={`${countLabel(summary.collected.count)}. Total guardado. No es la utilidad.`} numbers={summary.collected.numbers} />
        <SummaryCard label="Devueltos" value={formatCop(summary.returned.amount)} detail={`${countLabel(summary.returned.count)}. Total guardado. No entra a la utilidad.`} numbers={summary.returned.numbers} />
        <SummaryCard
          label="Margen estimado"
          value={formatCop(summary.estimatedMargin.amount)}
          detail="Solo ventas confirmadas, sin incidencia. No es el total guardado."
          numbers={summary.estimatedMargin.numbers}
          extra={
            summary.estimatedMargin.missingNumbers.length > 0 ? (
              <span className="text-xs leading-5 text-muted">
                No suman (sin costo):{" "}
                <OrderLinks numbers={summary.estimatedMargin.missingNumbers} lead=":" />
              </span>
            ) : null
          }
        />
        <SummaryCard
          label="Utilidad realizada"
          value={formatCop(summary.realized.amount)}
          detail={realizedDetail(summary)}
          numbers={summary.realized.numbers}
          extra={
            <span className="space-y-1 text-xs leading-5 text-muted">
              {summary.realized.missingNumbers.length > 0 ? (
                <span className="block">
                  Cobrado sin costo: <OrderLinks numbers={summary.realized.missingNumbers} lead=":" />
                </span>
              ) : null}
              {summary.returnFreight > 0 ? (
                <span className="block">
                  Flete devolución {formatCop(summary.returnFreight)}
                  <OrderLinks numbers={summary.returnFreightNumbers} lead="de" />
                </span>
              ) : null}
              {summary.collectionCost > 0 ? (
                <span className="block">
                  Recaudo real {formatCop(summary.collectionCost)}
                  <OrderLinks numbers={summary.collectionCostNumbers} lead="de" />
                </span>
              ) : null}
            </span>
          }
        />
      </dl>
      {periodShift ? <p className="mt-3 text-sm leading-5">{periodShift}</p> : null}
      <CloseSheet orders={spanOrders} rest={orders.filter((order) => !spanOrders.some((shown) => shown.number === order.number))} period={span} basis={basis} guides={sizeGuides} priceGuides={priceGuides} costGuides={costGuides} fieldId="cierre-pedidos" />
      </section>
      <section className="mt-5" aria-labelledby="por-atender">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Cola</p>
        <h2 id="por-atender" className="mt-0.5 text-base font-bold">
          Por atender
        </h2>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          Cada pedido sale una sola vez, en su siguiente paso. Ábrelo para completar el dato o la herramienta.
          {canManageOrderMoney
            ? " Ahí se confirma, se anota la entrega, el despacho y el cobro."
            : " Si puedes hacer algo, ese es el paso. El flete, el costo y el cobro quedan después y los guarda el propietario."}
        </p>
        {work.length === 0 ? (
          <div className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
            <p className="mt-0.5 text-sm text-muted">No hay pedidos esperando un dato o una herramienta.</p>
          </div>
        ) : (
          <div className="mt-2">
            {work.map((queue) => (
              <section key={queue.id} className="mt-3 first:mt-0" aria-labelledby={queue.id}>
                <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Paso</p>
                <h3 id={queue.id} className="mt-0.5 text-sm font-semibold">
                  {queue.title} ({queue.rows.length})
                </h3>
                <p className="mt-0.5 text-xs leading-5 text-muted">{queue.hint} No cobra.</p>
                <div className="elevate-1 mt-2 overflow-hidden rounded-[14px] border border-line bg-card">
                  <div
                    className={cx(
                      "hidden items-end gap-4 border-b border-line bg-canvas px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase md:grid",
                      queueGrid,
                    )}
                  >
                    <span>Pedido</span>
                    <span>Cliente</span>
                    <span>Siguiente paso</span>
                    <span>Herramienta</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {queue.rows.map((row) => (
                      <li key={row.order.id}>
                        <a
                          href={orderFocusHref(row.order.number)}
                          title="Abrirlo no cobra ni cambia el total guardado."
                          className={cx("grid items-start gap-3 px-3 py-2 text-sm hover:bg-canvas md:gap-4", queueGrid)}
                        >
                          <span>
                            <span className="text-sm font-bold">{row.order.number}</span>
                            <span className="mt-1 block text-xs text-muted">{formatDay(row.order.createdAt.slice(0, 10))}</span>
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold">{row.order.customerName}</span>
                            <span className="mt-1 block text-xs text-muted">
                              {row.order.city}
                              {row.order.department ? ` · ${row.order.department}` : ""}
                            </span>
                          </span>
                          <span className="leading-5">
                            <span className="mb-1 block text-[10px] font-bold tracking-[0.08em] text-muted uppercase md:hidden">
                              Siguiente paso
                            </span>
                            <span className="font-semibold text-warning">{row.note}</span>
                            {row.also.length > 0 ? (
                              <span className="mt-1 block text-xs text-muted">También: {row.also.join(", ")}</span>
                            ) : null}
                            {attentionCostAside(row.note, row.order, costGuides, canManageOrderMoney) ? (
                              <span className="mt-1 block text-xs leading-5 text-muted">
                                {attentionCostAside(row.note, row.order, costGuides, canManageOrderMoney)}
                              </span>
                            ) : null}
                            {orderPriceStayNote(row.order, priceGuides) ? (
                              <span className="mt-1 block text-xs leading-5 text-warning">{orderPriceStayNote(row.order, priceGuides)}</span>
                            ) : null}
                          </span>
                          <span className="font-semibold text-primary md:pt-0.5">{row.cta}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ))}
          </div>
        )}
        <AttentionSheet orders={orders} guides={sizeGuides} priceGuides={priceGuides} costGuides={costGuides} canManageOrderMoney={canManageOrderMoney} />
      </section>
      {orders.length === 0 ? (
        <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
          <p className="mt-0.5 text-sm text-muted">Todavía no entra ningún pedido de la tienda. No cobra.</p>
        </div>
      ) : (
        <>
          <DispatchSheet orders={spanOrders} moved={span !== "todo" && basis === "movidos"} />
          <section className="mt-5" aria-labelledby="lista-pedidos">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Lista</p>
          <h2 id="lista-pedidos" className="mt-0.5 text-base font-bold">
            {span === "todo" ? "Todos los pedidos" : basis === "movidos" ? `Movidos ${spanPhrase(span)}` : `Creados ${spanPhrase(span)}`}
          </h2>
          <p className="mt-0.5 text-xs leading-5 text-muted">
            Buscar o filtrar solo cambia esta lista. En cada pedido se abre la ficha. No cobra ni cambia el total guardado.
          </p>
          <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-3">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Estado</p>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Filtrar por estado">
            <StatusFilter
              label="Todos"
              count={searched.length}
              selected={status === "todos"}
              onSelect={() => setStatus("todos")}
            />
            {present.map((item) => (
              <StatusFilter
                key={item}
                label={STATUS_LABEL[item]}
                count={searched.filter((order) => order.status === item).length}
                selected={status === item}
                onSelect={() => setStatus(item)}
              />
            ))}
          </div>
          </div>
          {visible.length === 0 ? (
            <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2">
              <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
              <p className="mt-0.5 text-sm text-muted">{emptyListMessage(query, status, span)}</p>
            </div>
          ) : (
        <div className="elevate-1 mt-3 overflow-hidden rounded-[14px] border border-line bg-card">
          <div className={cx("hidden items-end gap-4 border-b border-line bg-canvas px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase md:grid", orderGrid)}>
            <span>Pedido</span>
            <span>Cliente</span>
            <span className="text-right">Total guardado</span>
            <span>Estado</span>
            <span>Abrir</span>
          </div>
          <ul className="divide-y divide-line">
          {visible.map((order) => {
            const notes = rowWarnings(order, sizeGuides, canManageOrderMoney);
            const drift = orderPriceStayNote(order, priceGuides);
            const costNote = costDriftNote(costDrift(order, costGuides));
            const copyNote = orderCostCopyNote(order, costGuides);
            const hold = drift || costNote ? accountHoldNote(order.status) : "";
            return (
              <li key={order.id}>
                <a href={orderFocusHref(order.number)} title="Abrirlo no cobra ni cambia el total guardado." className={cx("grid items-start gap-3 px-3 py-2 hover:bg-canvas md:gap-4", orderGrid)}>
                  <span>
                    <span className="text-sm font-bold">{order.number}</span>
                    <span className="mt-1 block text-xs text-muted">{formatDay(order.createdAt.slice(0, 10))}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{order.customerName}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {order.city}
                      {order.department ? ` · ${order.department}` : ""}
                    </span>
                    {notes.map((note) => (
                      <span key={note} className="mt-2 block text-sm leading-5 text-warning">{note}</span>
                    ))}
                    {drift ? <span className="mt-2 block text-sm leading-5 text-warning">{drift}</span> : null}
                    {costNote ? <span className="mt-2 block text-sm leading-5 text-warning">{costNote}</span> : null}
                    {copyNote ? <span className="mt-1 block text-sm leading-5">{copyNote}</span> : null}
                    {hold ? <span className="mt-2 block text-sm leading-5 text-warning">{hold}</span> : null}
                  </span>
                  <span className="text-sm font-semibold tabular-nums md:pt-0.5 md:text-right">
                    <span className="mb-1 block text-[10px] font-bold tracking-[0.08em] text-muted uppercase md:hidden">Total guardado</span>
                    {formatCop(order.total)}
                  </span>
                  <span className="md:pt-0.5">
                    <span className="mb-1 block text-[10px] font-bold tracking-[0.08em] text-muted uppercase md:hidden">Estado</span>
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <StatusPill status={order.status} />
                      {order.collected ? <CollectedPill /> : null}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-primary md:pt-0.5">Abrir</span>
                </a>
              </li>
            );
          })}
          </ul>
        </div>
          )}
          </section>
        </>
      )}
    </div>
  );
}


export function OrderEditor({
  order,
  orders,
  products,
  sizeGuides,
  priceGuides = [],
  costGuides,
  canManageOrderMoney = false,
}: {
  order: StoreOrder;
  orders: StoreOrder[];
  products: OrderableProduct[];
  sizeGuides: SizeGuide[];
  priceGuides?: PriceGuide[];
  costGuides: CostGuide[];
  canManageOrderMoney?: boolean;
}) {
  const [state, action, pending] = useActionState(updateOrderAction, initialState);
  const margin = orderMargin(order);
  const costNote = costDriftNote(costDrift(order, costGuides));
  const copyNote = orderCostCopyNote(order, costGuides);
  const priceStay = orderPriceStayNote(order, priceGuides);
  const actions = actionsFor(order, sizeGuides);
  const sizeConfirmError = confirmSizeError(order, sizeGuides);
  const confirmBlocked = order.status === "pendiente_confirmacion" ? sizeConfirmError : null;
  const resolveBlocked = resolveIncidenceError(order);
  const phoneMatches = samePhoneMatches(order, orders);
  const departmentNote = missingDepartmentNote(order);
  const sizeNote = missingSizeNote(order, sizeGuides);
  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      {!canManageOrderMoney ? (
        <section className="elevate-1 mb-3 rounded-[14px] border border-line bg-card px-3 py-3">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Alcance</p>
          <p className="mt-1 text-sm text-muted">
            Solo el propietario anota el flete, el recaudo, copia el costo de la ficha, cambia cantidades o productos y
            marca o quita el cobro. Puedes seguir el estado, la entrega, la talla o el tamaño y el aviso al cliente.
          </p>
        </section>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Tienda</p>
          <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">{order.number}</h1>
          <p className="mt-1 text-xs text-muted">
            {formatDay(order.createdAt.slice(0, 10))} · {order.customerName} · {order.city}
            {order.department ? ` · ${order.department}` : ""}. Abrirlo no cobra. El total guardado no cambia.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill status={order.status} />
            {order.collected ? <CollectedPill /> : null}
          </div>
        </div>
        <div className="shrink-0">
          <nav aria-label="Vista" className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
            <Link
              href="/panel/pedidos"
              title="Volver no cobra ni cambia el total guardado."
              className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold hover:bg-subtle"
            >
              Volver a pedidos
            </Link>
            {canNoteDropiNumber(order) ? (
              <Link
                href={syncFocusHref(order.number)}
                title="Abrirla no cobra. El total guardado no cambia."
                className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold hover:bg-subtle"
              >
                Sincronización
              </Link>
            ) : null}
          </nav>
          <p className="mt-2 text-xs leading-5 text-muted">Volver no cobra ni cambia el total guardado.</p>
        </div>
      </div>

<section className="elevate-1 mt-5 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="pedido-resumen">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Situación</p>
        <h2 id="pedido-resumen" className="mt-0.5 text-sm font-semibold">Estado</h2>
        <p className="mt-2 text-sm font-extrabold tabular-nums">Total guardado {formatCop(order.total)}</p>
        <p className={cx("mt-1 text-xs leading-5", collectedWithoutCost(order) ? "text-warning" : "text-muted")}>
          {moneyNote(order, margin)}
        </p>
        {priceStay ? <p className="mt-2 text-sm leading-5 text-warning">{priceStay}</p> : null}
        {costNote ? <p className="mt-2 text-sm leading-5 text-warning">{costNote}</p> : null}
        {copyNote ? <p className="mt-1 text-sm leading-5">{copyNote}</p> : null}
        {priceDrift(order, priceGuides).length > 0 || costNote ? (
          accountHoldNote(order.status) ? <p className="mt-2 text-sm leading-5 text-warning">{accountHoldNote(order.status)}</p> : null
        ) : null}
        {readyToConfirm(order, sizeGuides) ? (
          <p className="mt-2 text-xs leading-5 text-warning">{confirmQueueNote(order, sizeGuides)}</p>
        ) : departmentNote ? (
          <p className="mt-2 text-xs leading-5 text-warning">{departmentNote}</p>
        ) : null}
        {sizeNote ? <p className="mt-1 text-xs leading-5 text-warning">{sizeNote}</p> : null}
        {needsIncidenceReason(order) ? (
          <p className="mt-1 text-xs leading-5 text-warning">Falta el motivo de la incidencia. Sin él no se resuelve.</p>
        ) : null}
        {needsReturnReason(order) ? (
          <p className="mt-1 text-xs leading-5 text-warning">Falta el motivo de la devolución.</p>
        ) : null}
        {needsReturnFreight(order) ? (
          <p className="mt-1 text-xs leading-5 text-warning">
            Falta el flete de devolución. Vacío no resta.
            {canManageOrderMoney ? "" : " Lo anota el propietario."}
          </p>
        ) : null}
        {order.campaignEntry ? (
          <p className="mt-1 text-xs text-accent-strong">
            Entró por campaña. No es gasto publicitario. El total guardado es el precio publicado de ese momento.
          </p>
        ) : null}
        {awaitsDropiNumber(order) || needsIncidenceDropiNumber(order) || needsClosedDropiNumber(order) ? (
          <p className="mt-1 text-xs leading-5 text-warning">Falta número Dropi — ver Sincronización.</p>
        ) : null}
        {readyToPrepare(order) ? (
          <p className="mt-1 text-xs leading-5 text-warning">{prepareQueueNote(order)}</p>
        ) : null}
        {readyToDispatch(order) ? (
          <p className="mt-1 text-xs leading-5 text-warning">{dispatchQueueNote(order)}</p>
        ) : null}
        {state.orderId === order.id && state.error ? (
          <p role="alert" className="mt-2 text-xs font-semibold text-danger">{state.error}</p>
        ) : null}
      </section>

<section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="pedido-herramientas">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</p>
        <h2 id="pedido-herramientas" className="mt-0.5 text-sm font-semibold">Herramientas del pedido</h2>
        {actions.length > 0 || prepareDropiError(order) || resolveBlocked || confirmBlocked ? (
          <>
          {actions.some((item) => needsCustomerReason(item.id)) ? (
            <div className="mt-2 space-y-2">
              {actions
                .filter((item) => needsCustomerReason(item.id))
                .map((item) => (
                  <ReasonAction
                    key={item.id}
                    order={order}
                    item={item}
                    action={action}
                    pending={pending}
                    error={state.orderId === order.id && state.error?.includes("motivo") ? state.error : null}
                  />
                ))}
            </div>
          ) : null}
          {actions.some((item) => !needsCustomerReason(item.id)) ? (
            <FormTools className="mt-2">
              {actions
                .filter((item) => !needsCustomerReason(item.id))
                .map((item) => (
                  <form key={item.id} action={action} className="contents">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="intent" value={item.id} />
                    <button
                      type="submit"
                      title="No cambia el total guardado ni cobra en esta pantalla."
                      disabled={pending || (moneyStatusAction(item.id) && !canManageOrderMoney)}
                      className={`inline-flex h-9 items-center justify-center rounded-[10px] px-3 text-sm font-semibold ${
                        pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
                      } ${buttonTone[item.tone]}`}
                    >
                      {item.label}
                    </button>
                  </form>
                ))}
            </FormTools>
          ) : null}
          <p className="mt-2 text-xs leading-5 text-muted">
            Estas herramientas no cambian el total guardado ni el precio de las líneas. No cobran en esta pantalla.
            {actions.some((item) => item.id === "entregar")
              ? " Marcar entregado no anota el cobro ni la utilidad realizada."
              : ""}
          </p>
          {!canManageOrderMoney && actions.some((item) => moneyStatusAction(item.id)) ? (
            <p className="mt-2 text-sm leading-5 text-muted">Solo el propietario marca o quita el cobro. No cobra en esta pantalla.</p>
          ) : null}
          {confirmBlocked || prepareDropiError(order) || resolveBlocked ? (
            <details className="mt-3 rounded-[10px] border border-line bg-canvas px-3 py-2">
              <summary className="cursor-pointer" title="Abrirlo no cobra ni cambia el total guardado.">
                <span className="block text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Bloqueo</span>
                <span className="mt-0.5 block text-sm font-semibold text-muted">Herramientas bloqueadas y mensaje al cliente</span>
              </summary>
              <FormTools className="mt-2">
                {confirmBlocked ? (
                  <button
                    type="button"
                    disabled
                    title="Sigue bloqueado. No cobra ni cambia el total guardado."
                    className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-muted"
                  >
                    Confirmar pedido
                  </button>
                ) : null}
                {prepareDropiError(order) ? (
                  <button
                    type="button"
                    disabled
                    title="Sigue bloqueado. No cobra ni cambia el total guardado."
                    className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-muted"
                  >
                    Pasar a preparación
                  </button>
                ) : null}
                {resolveBlocked ? (
                  <button
                    type="button"
                    disabled
                    title="Sigue bloqueado. No cobra ni cambia el total guardado."
                    className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-muted"
                  >
                    Resolver incidencia
                  </button>
                ) : null}
              </FormTools>
              {confirmBlocked ? (
                <p className="mt-3 max-w-xl text-sm leading-5 text-ink">
                  «Confirmar pedido» sigue bloqueado. {confirmBlocked} Confirmar no cambia el total guardado. Si más adelante anotas esa elección y usas
                  el botón, el mensaje para el cliente queda así.
                  <span className="mt-1 block font-normal text-muted">
                    {customerMessage({ ...order, status: "confirmado" })}
                  </span>
                </p>
              ) : null}
              {prepareDropiError(order) ? (
                <p className="mt-3 max-w-xl text-sm leading-5 text-ink">
                  «Pasar a preparación» sigue bloqueado hasta anotar un número en Sincronización.{" "}
                  {blockedDropiAnswer("createOrder").detail} Pasar a preparación no cambia el total guardado. Si más adelante anotas ese número y usas el botón, el
                  mensaje para el cliente queda así.
                  <span className="mt-1 block font-normal text-muted">
                    {customerMessage({ ...order, status: "en_preparacion" })}
                  </span>
                </p>
              ) : null}
              {resolveBlocked ? (
                <p className="mt-3 max-w-xl text-sm leading-5 text-ink">
                  «Resolver incidencia» sigue bloqueado. {resolveBlocked} Resolverla no cobra y el total guardado no cambia. Si más adelante guardas un motivo y usas el
                  botón, el pedido vuelve a confirmado.
                  {prepareDropiError({ ...order, status: "confirmado" })
                    ? " «Pasar a preparación» seguiría bloqueado hasta anotar un número a mano."
                    : ""}{" "}
                  El mensaje para el cliente deja de hablar de la incidencia y queda así.
                  <span className="mt-1 block font-normal text-muted">
                    {customerMessage({ ...order, status: "confirmado" })}
                  </span>
                </p>
              ) : null}
            </details>
          ) : null}
          {actions.filter((item) => !needsCustomerReason(item.id)).length > 0 ? (
            <details className="mt-3 rounded-[10px] border border-line bg-canvas px-3 py-2">
              <summary className="cursor-pointer" title="Abrirlo no cobra ni cambia el total guardado.">
                <span className="block text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
                <span className="mt-0.5 block text-sm font-semibold text-muted">Si más adelante… mensaje al cliente</span>
              </summary>
              {actions
                .filter((item) => !needsCustomerReason(item.id))
                .map((item) => {
                  const next = applyOrderAction(order, item.id);
                  if (!next.order) return null;
                  const previewOrder = item.id === "resolver" ? next.order : { ...next.order, customerReason: undefined };
                  return (
                    <p key={`aviso-${item.id}`} className="mt-3 max-w-xl text-sm leading-5 text-ink">
                      Si usas «{item.label}», el mensaje para el cliente queda así. El total guardado no cambia.
                      <span className="mt-1 block font-normal text-muted">{customerMessage(previewOrder)}</span>
                    </p>
                  );
                })}
            </details>
          ) : null}
          </>
        ) : (
          <div className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
            <p className="mt-0.5 text-sm text-muted">No hay una herramienta disponible en este estado. No cobra. El total guardado no cambia.</p>
          </div>
        )}
      </section>

      <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
<section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="pedido-productos">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Líneas</p>
        <h2 id="pedido-productos" className="mt-0.5 text-sm font-semibold">Productos</h2>
        {canEditLines(order) ? (
          <>
            <LinesForm order={order} products={products} canManageOrderMoney={canManageOrderMoney} />
            {canManageOrderMoney ? (
              <AddProductForm order={order} products={products} />
            ) : (
              <p className="mt-3 text-sm text-muted">Solo el propietario agrega productos a este pedido. No cobra. No es dinero cobrado.</p>
            )}
          </>
        ) : (
          <>
            <ul className="mt-3 space-y-1 text-sm">
              {order.lines.map((line) => (
                <li key={`${line.sku}:${line.variant ?? ""}`}>
                  {line.quantity} × {lineName(line)} · precio guardado {formatCop(line.unitPrice * line.quantity)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-5 text-muted">
              Es el precio guardado en este pedido. Cambiar la ficha después no lo reescribe. No es dinero cobrado.
            </p>
          </>
        )}
        {priceStay ? <p className="mt-2 text-sm leading-5 text-warning">{priceStay}</p> : null}
        <p className="mt-2 text-sm font-extrabold tabular-nums">
          {payableTotalLabel(order.status)} {formatCop(order.total)}
        </p>
        <CatalogCostForm order={order} guides={costGuides} canManageOrderMoney={canManageOrderMoney} />
        <FreightForm order={order} canManageOrderMoney={canManageOrderMoney} />
      </section>

<section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="pedido-entrega">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Destino</p>
        <h2 id="pedido-entrega" className="mt-0.5 text-sm font-semibold">Entrega</h2>
        <p className="mt-2 text-sm text-muted">
          {order.phone}
          {order.document ? ` · Cédula ${order.document}` : ""}
          {" · "}
          {order.address}
          {order.reference ? ` · ${order.reference}` : ""}
        </p>
        {phoneMatches.length > 0 ? (
          <div className="mt-3">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">También</p>
            <p className="mt-0.5 text-sm font-semibold">Este celular también está en</p>
            <ul className="mt-1 space-y-1">
              {phoneMatches.map((item) => (
                <li key={item.id}>
                  <a href={orderFocusHref(item.number)} title="Abrirlo no cobra ni cambia el total guardado." className="text-sm font-semibold underline-offset-2 hover:underline">
                    {item.number}
                  </a>
                  <span className="text-sm text-muted"> · {STATUS_LABEL[item.status]}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {order.buyerNote ? (
          <p className="mt-3 text-sm leading-5">
            <span className="font-semibold">Aviso del cliente. </span>
            {order.buyerNote}
          </p>
        ) : null}
        {canEditDelivery(order) ? <DeliveryForm order={order} /> : null}
        {needsClosedDepartment(order) ? <ClosedDepartmentForm order={order} /> : null}
      </section>
      </div>

<section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="pedido-dropi">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Dropi</p>
        <h2 id="pedido-dropi" className="mt-0.5 text-sm font-semibold">Sincronización</h2>
        {canNoteDropiNumber(order) ? (
          <>
          <p className="mt-1.5 text-xs leading-5 text-ink">
            {order.providerRef
              ? `Número: ${order.providerRef}. `
              : "Falta el número de Dropi. "}
            No se envía desde aquí.
          </p>
          <nav aria-label="Herramientas" className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
            <Link href={syncFocusHref(order.number)} title="Abrirla no cobra. El total guardado no cambia." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
              Abrir sincronización
            </Link>
          </nav>
          <p className="mt-2 text-xs leading-5 text-muted">Abrirla no cobra. El total guardado no cambia.</p>
          </>
        ) : (
          <p className="mt-1.5 text-xs leading-5 text-muted">
            El número se anota después de confirmar. Dropi no está conectado.
          </p>
        )}
      </section>

      <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="pedido-avisos">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Notas</p>
        <h2 id="pedido-avisos" className="mt-0.5 text-sm font-semibold">Avisos y motivos</h2>
        <div className="mt-2 grid gap-3 xl:grid-cols-2">
          <InternalNoteForm order={order} />
          <IncidenceReasonForm order={order} />
          <ReturnReasonForm order={order} />
          <CustomerNote order={order} />
        </div>
      </section>

      <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="pedido-historial">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Registro</p>
        <h2 id="pedido-historial" className="mt-0.5 text-sm font-semibold">Historial</h2>
        {order.history.length > 0 ? (
          <div className="mt-2 overflow-hidden rounded-[10px] border border-line">
            {storedUtilityCaveat(order) ? (
              <p className="border-b border-line px-3 py-2 text-xs leading-5 text-warning">{storedUtilityCaveat(order)}</p>
            ) : null}
            <div className={cx("hidden items-end gap-4 border-b border-line bg-canvas px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase md:grid", historyGrid)}>
              <span>Fecha</span>
              <span>Quién</span>
              <span>Cambio</span>
            </div>
            <ol className="divide-y divide-line text-sm">
              {order.history.map((event) => (
                <li key={event.id} className={cx("grid items-start gap-1 px-3 py-2 md:gap-4", historyGrid)}>
                  <span>
                    <span className="mb-1 block text-[10px] font-bold tracking-[0.08em] text-muted uppercase md:hidden">Fecha</span>
                    {formatDay(event.at.slice(0, 10))}
                  </span>
                  <span>
                    <span className="mb-1 block text-[10px] font-bold tracking-[0.08em] text-muted uppercase md:hidden">Quién</span>
                    {event.actorName}
                  </span>
                  <span className="text-muted">
                    <span className="mb-1 block text-[10px] font-bold tracking-[0.08em] text-muted uppercase md:hidden">Cambio</span>
                    {event.summary}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="mt-2 rounded-[10px] border border-line bg-canvas px-3 py-2">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
            <p className="mt-0.5 text-sm text-muted">Todavía no hay movimientos anotados. Verlos no cobra ni cambia el total guardado.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function reasonActionStatus(intent: string): StoreOrder["status"] | null {
  if (intent === "cancelar") return "cancelado";
  if (intent === "incidencia") return "incidencia";
  if (intent === "devolver") return "devuelto";
  return null;
}

function ReasonAction({
  order,
  item,
  action,
  pending,
  error,
}: {
  order: StoreOrder;
  item: { id: string; label: string; tone: keyof typeof buttonTone };
  action: (payload: FormData) => void;
  pending: boolean;
  error: string | null;
}) {
  const [reason, setReason] = useState("");
  const spoken = reason.trim().replace(/\s+/g, " ");
  const canApply = Boolean(spoken) && spoken.length <= 160;
  const nextStatus = reasonActionStatus(item.id);
  return (
    <form action={action} className="basis-full grid gap-3 rounded-[10px] border border-line bg-canvas px-3 py-2">
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="intent" value={item.id} />
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Motivo</p>
      <label className="text-sm font-semibold" htmlFor={`motivo-${order.id}-${item.id}`}>
        Motivo para el cliente
        <textarea
          id={`motivo-${order.id}-${item.id}`}
          name="customerReason"
          title="Escribirlo no cobra. El total guardado no cambia."
          rows={3}
          maxLength={160}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 min-h-20 w-full rounded-[10px] border border-line bg-card px-3 py-2 text-sm leading-5 font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
        />
        <span className="mt-1 block text-xs font-normal leading-5 text-muted">
          Hasta 160 caracteres. Vacío bloquea el botón. No sale en Dropi. El total guardado no cambia.
          {item.id === "devolver" && order.collected ? " Se quita la marca de cobro." : ""}
        </span>
      </label>
      <MotivoMessagePreview
        order={order}
        next={spoken}
        canSave={canApply}
        status={nextStatus ?? undefined}
        lead="Si aplicas, el mensaje para el cliente queda así. El total guardado no cambia."
      />
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
        <button
          type="submit"
          title="No cambia el total guardado ni cobra en esta pantalla."
          disabled={pending || !canApply}
          className={`inline-flex h-9 items-center justify-center rounded-[10px] px-3 text-sm font-semibold ${
            pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
          } ${buttonTone[item.tone]}`}
        >
          {item.label}
        </button>
      </nav>
    </form>
  );
}

function StatusFilter({
  label,
  count,
  selected,
  onSelect,
}: {
  label: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      title="Filtrar no cobra ni cambia el total guardado."
      className={cx(
        "min-h-9 rounded-[10px] px-2.5 text-sm font-semibold",
        selected ? "bg-primary text-on-dark" : "border border-line bg-card text-muted",
      )}
      onClick={onSelect}
    >
      {label}
      <span className="ml-1 tabular-nums">{count}</span>
    </button>
  );
}

function matchesOrder(order: StoreOrder, query: string, guides: SizeGuide[], priceGuides: PriceGuide[] = [], costGuides: CostGuide[] = []) {
  if (!query) return true;
  return [orderPriceStayNote(order, priceGuides), costDriftNote(costDrift(order, costGuides)), orderCostCopyNote(order, costGuides), priceDrift(order, priceGuides).length > 0 || costDrift(order, costGuides).length > 0 ? accountHoldNote(order.status) : "", order.number, order.customerName, order.city, order.department ?? "", order.phone, order.document ?? "", order.address, order.reference, order.providerRef ?? "", order.internalNote ?? "", order.customerReason ?? "", order.buyerNote ?? "", order.customerNotifiedAt ? "avisé" : "", order.campaignEntry ? "campaña" : "", awaitsDropiNumber(order) || needsClosedDropiNumber(order) || needsIncidenceDropiNumber(order) ? "dropi" : "", needsDepartment(order) || needsClosedDepartment(order) ? "departamento" : "", missingSizeNote(order, guides), catalogCostQueueNote(order), collectedWithoutCost(order) ? "utilidad" : "", needsCustomerNotice(order) ? "avisar aviso" : "", needsIncidenceReason(order) ? "motivo incidencia" : "", needsReturnReason(order) ? "motivo devolución" : "", needsReturnFreight(order) ? "flete devolución" : "", readyToConfirm(order, guides) ? "confirmar" : "", readyToPrepare(order) ? "preparación preparar" : "", readyToDispatch(order) ? "despacho preparación" : "", ...order.lines.flatMap((line) => [line.title, line.sku, line.variant ?? ""])].some(
    (value) => value.toLocaleLowerCase("es").includes(query),
  );
}

function emptyListMessage(query: string, status: OrderStatus | "todos", span: OrderSpan) {
  if (query && status !== "todos") return "Ningún pedido de ese estado coincide con la búsqueda.";
  if (query) return "Ningún pedido coincide con la búsqueda.";
  if (span !== "todo" && status === "todos") return "No hay pedidos en este período. La cola Por atender no cambia.";
  return "No hay pedidos en este estado.";
}

function DispatchSheet({ orders, moved }: { orders: StoreOrder[]; moved: boolean }) {
  const rows = dispatchSheetOrders(orders);
  const text = dispatchSheetText(rows);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  function copy() {
    const node = document.getElementById("hoja-despacho");
    if (!(node instanceof HTMLTextAreaElement)) return;
    node.focus();
    node.select();
    let copiedByCommand = false;
    try {
      copiedByCommand = document.execCommand("copy");
    } catch {
      copiedByCommand = false;
    }
    if (copiedByCommand) {
      setCopied("ok");
      return;
    }
    void navigator.clipboard.writeText(text).then(
      () => setCopied("ok"),
      () => setCopied("fail"),
    );
  }

  return (
    <section className="mt-5" aria-labelledby="hoja-despacho-titulo">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Despacho</p>
      <h2 id="hoja-despacho-titulo" className="mt-0.5 text-base font-bold">
        Hoja para copiar ({rows.length})
      </h2>
      <p className="mt-0.5 text-xs leading-5 text-muted">
        {moved
          ? "Confirmados, en preparación o en despacho que se movieron en este período. El total guardado es el del pedido. Copiarla no crea el pedido en Dropi ni lo cambia."
          : "Confirmados, en preparación o en despacho de este período. Copiarla no crea el pedido en Dropi ni cambia el total guardado."}
      </p>
      {rows.length === 0 ? (
        <div className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
          <p className="mt-0.5 text-sm text-muted">
            En este período no hay pedidos en curso para copiar. Los pendientes siguen en Por atender.
          </p>
        </div>
      ) : (
        <div className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2">
          <label className="text-sm font-semibold" htmlFor="hoja-despacho">
            Texto de {rows.length === 1 ? "1 pedido" : `${rows.length} pedidos`}
            <textarea
              id="hoja-despacho"
              title="Leerlo no envía el pedido ni cobra. El total guardado no cambia."
              readOnly
              rows={8}
              value={text}
              className="mt-1 min-h-32 w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm leading-5 font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
            />
          </label>
          <nav aria-label="Herramientas" className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
            <button
              type="button"
              title="Copiar no crea el pedido en Dropi ni cambia el total guardado."
              className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
              onClick={copy}
            >
              {copied === "ok" ? "Hoja copiada" : "Copiar hoja"}
            </button>
          </nav>
          {copied === "ok" ? (
            <p role="status" className="mt-2 text-sm text-accent-strong">
              Lista para pegarla a mano. Copiar no cobra. Dropi no está conectado: desde aquí no se crea el pedido ni cambia el total guardado.
            </p>
          ) : null}
          {copied === "fail" ? (
            <p role="alert" className="mt-2 text-sm font-semibold text-danger">
              No se pudo copiar. El texto queda seleccionado. No cobra. El total guardado no cambia.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function moneyNote(order: StoreOrder, margin: number | null) {
  const realized = orderRealizedMargin(order);
  if (order.status === "incidencia") {
    const lead =
      margin === null
        ? "Incidencia. No suma como venta confirmada mientras dure."
        : `Margen estimado ${formatCop(margin)}. No suma como venta confirmada mientras dure la incidencia.`;
    return `${lead} El total guardado sigue en ${formatCop(order.total)}.`;
  }
  if (order.status === "cancelado") {
    const lead =
      margin === null
        ? "Cancelado. No entra en las ventas."
        : `Margen estimado ${formatCop(margin)}. No entra en las ventas.`;
    return `${lead} El total guardado sigue en ${formatCop(order.total)}.`;
  }
  if (order.status === "devuelto") {
    const base =
      margin === null
        ? "Devuelto. No suma como venta. Este pedido no tenía el costo guardado."
        : `Devuelto. El margen estimado ${formatCop(margin)} deja de contar como utilidad realizada.`;
    const freight = recordedReturnFreight(order);
    const kept = ` El total guardado sigue en ${formatCop(order.total)}.`;
    return freight > 0 ? `${base} El flete de la devolución, ${formatCop(freight)}, sí resta.${kept}` : `${base}${kept}`;
  }
  if (margin === null) {
    if (order.status === "entregado" && order.collected) {
      const notes: string[] = [];
      if (typeof order.actualShipping === "number") notes.push(`el flete real en ${formatCop(order.actualShipping)}`);
      if (typeof order.collectionCost === "number") notes.push(`el recaudo real en ${formatCop(order.collectionCost)}`);
      const joined = notes.join(" y ");
      const saved = notes.length
        ? ` ${joined.charAt(0).toUpperCase()}${joined.slice(1)} ${notes.length === 1 ? "quedó anotado" : "quedaron anotados"}.`
        : "";
      return `Ya está cobrado. Sin el costo del producto no entra en la utilidad realizada.${saved} El total guardado sigue en ${formatCop(order.total)}.`;
    }
    if (order.status === "entregado") {
      return `Entregado. Sin el costo del producto no entra en la utilidad realizada. El cobro sigue pendiente. El total guardado sigue en ${formatCop(order.total)}.`;
    }
    return `Este pedido se guardó sin costo, envío ni comisiones. El margen no entra en el estimado ni en la utilidad. El total guardado sigue en ${formatCop(order.total)}.`;
  }
  if (order.status === "entregado" && order.collected && realized !== null && realized !== margin) {
    const because: string[] = [];
    if (typeof order.actualShipping === "number") because.push(`el flete real en ${formatCop(order.actualShipping)}`);
    if (typeof order.collectionCost === "number") {
      because.push(`el recaudo real en ${formatCop(order.collectionCost)}, en lugar de las comisiones estimadas`);
    }
    const why = because.length ? ` Con ${because.join(" y ")},` : "";
    return `Margen estimado ${formatCop(margin)}.${why} la utilidad de este pedido es ${formatCop(realized)}. El total guardado sigue en ${formatCop(order.total)}.`;
  }
  if (order.status === "entregado" && order.collected) {
    return `Margen estimado ${formatCop(margin)}. Cuenta como utilidad realizada. El total guardado sigue en ${formatCop(order.total)}.`;
  }
  if (order.status === "entregado") {
    return `Margen estimado ${formatCop(margin)}. La entrega ya está anotada. La utilidad realizada espera el cobro. El total guardado sigue en ${formatCop(order.total)}.`;
  }
  if (order.status === "pendiente_confirmacion") {
    return `Margen estimado ${formatCop(margin)}. Cuenta como estimado cuando el pedido esté confirmado y sin incidencia. No es utilidad realizada. El total guardado sigue en ${formatCop(order.total)}.`;
  }
  return `Margen estimado ${formatCop(margin)}. La utilidad realizada espera la entrega y el cobro. El total guardado sigue en ${formatCop(order.total)}.`;
}

function CatalogCostForm({
  order,
  guides,
  canManageOrderMoney,
}: {
  order: StoreOrder;
  guides: CostGuide[];
  canManageOrderMoney: boolean;
}) {
  const [costState, costAction, costPending] = useActionState(applyCatalogCostAction, initialState);
  const adopted = adoptCatalogCosts(order, guides);
  const rows = catalogCostLines(order, guides);
  const mix = catalogCostMix(order.lines, adopted.lines);
  const mixed = mix.filled && mix.replaced;
  const replacing = adopted.mode === "reemplazar";
  if (adopted.mode === "igual" && !adopted.error && rows.length === 0) return null;
  const ready = !adopted.error && adopted.mode !== "igual";
  const canSave = ready;
  const copyNote = orderCostCopyNote(order, guides);
  const preview = ready
    ? {
        beforeEstimated: orderMargin(order),
        estimated: orderMargin({ ...order, lines: adopted.lines }),
        beforeRealized: orderRealizedMargin(order),
        realized: orderRealizedMargin({ ...order, lines: adopted.lines }),
      }
    : null;

  return (
    <form
      action={canManageOrderMoney ? costAction : undefined}
      onSubmit={canManageOrderMoney ? undefined : (event) => event.preventDefault()}
      className="mt-3 grid gap-2 rounded-[10px] border border-line bg-canvas px-3 py-2"
    >
      <input type="hidden" name="orderId" value={order.id} />
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Cifras</p>
      <p className="mt-0.5 text-sm font-semibold">{replacing ? "Costo de la ficha de hoy" : "Costo de la ficha"}</p>
      <ul className="space-y-1 text-sm leading-5">
        {costDrift(order, guides).map((drift) => (
          <li key={`hoy:${drift.sku}`}>
            {drift.title}: hoy {drift.fields.map((field) => `${field.label} ${formatCop(field.current)}`).join(", ")}. Guardado: {drift.fields.map((field) => `${field.label} ${formatCop(field.stored)}`).join(", ")}.
          </li>
        ))}
        {rows.map((row, index) => (
          <li key={`${row.sku}:${index}`}>
            {row.ready
              ? `${row.title}: costo ${formatCop(row.cost)}, envío estimado ${formatCop(row.shipping)}, comisiones estimadas ${formatCop(row.commissions)}.`
              : `${row.title}: la ficha ya no tiene esas cifras.`}
          </li>
        ))}
      </ul>
      <p className="text-sm leading-5 text-muted">
        {mixed
          ? "Estas cifras anotan lo que falta y reemplazan lo que ya no coincide. El precio no cambia. El total guardado no cambia. No es dinero cobrado."
          : replacing
            ? "Estas cifras reemplazan el costo guardado de este pedido. El precio no cambia. El total guardado no cambia. No es dinero cobrado."
            : "El precio de este pedido no cambia. El total guardado no cambia. Siguen siendo cifras estimadas. Al usarlas se anotan en este pedido; no es un guardado vacío."}
      </p>
      {copyNote ? (
        <p className="text-sm leading-5 text-ink">{copyNote}</p>
      ) : preview && preview.estimated !== null ? (
        <p className="text-sm leading-5 text-ink">
          Si las usas, el margen estimado de este pedido {costShiftPhrase(preview.beforeEstimated, preview.estimated)}. No es dinero cobrado. El
          total guardado no cambia.
        </p>
      ) : null}
      {copyNote ? null : order.status === "entregado" && order.collected && ready ? (
        <p className="text-sm leading-5 text-muted">
          Este pedido ya está cobrado.
          {preview && preview.realized !== null
            ? ` Si las usas, la utilidad realizada de este pedido ${costShiftPhrase(preview.beforeRealized, preview.realized)}, con el flete y el recaudo que ya están anotados. El total guardado no cambia.`
            : " Si las usas, la utilidad realizada pasa a contarlas, con el flete y el recaudo que ya están anotados. El total guardado no cambia."}
        </p>
      ) : null}
      {costState.orderId === order.id && costState.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {costState.error}
        </p>
      ) : null}
      <p className="text-sm leading-5 text-muted">
        {canManageOrderMoney
          ? canSave
            ? mixed
              ? "Copia lo que falta y reemplaza lo que ya no coincide. El precio y el total guardado no cambian."
              : replacing
                ? "Copia el costo de hoy a este pedido. El precio y el total guardado no cambian."
                : "Copia el costo, el envío y las comisiones de la ficha a este pedido. El total guardado no cambia."
            : "Sin las cifras de la ficha el botón queda bloqueado."
          : "Solo el propietario copia estas cifras. El total guardado no cambia."}
      </p>
      {canManageOrderMoney ? (
        <FormTools>
          <button
            type="submit"
            title="El total guardado no cambia. No es dinero cobrado."
            disabled={costPending || !canSave}
            className={`inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold ${
              costPending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
            }`}
          >
            {costPending ? "Guardando…" : mixed ? "Anotar y usar las cifras de hoy" : replacing ? "Usar las cifras de hoy" : "Usar las cifras de la ficha"}
          </button>
        </FormTools>
      ) : null}
    </form>
  );
}

function FreightForm({ order, canManageOrderMoney }: { order: StoreOrder; canManageOrderMoney: boolean }) {
  const showShipping = order.status === "entregado";
  const showCollection = order.status === "entregado" && order.collected;
  const showReturn = order.status === "devuelto";
  const [shipping, setShipping] = useState(typeof order.actualShipping === "number" ? String(order.actualShipping) : "");
  const [returning, setReturning] = useState(typeof order.returnFreight === "number" ? String(order.returnFreight) : "");
  const [collection, setCollection] = useState(typeof order.collectionCost === "number" ? String(order.collectionCost) : "");
  const freightKey = `${order.actualShipping ?? ""}|${order.returnFreight ?? ""}|${order.collectionCost ?? ""}`;
  const [syncedFreight, setSyncedFreight] = useState(freightKey);
  if (freightKey !== syncedFreight) {
    setSyncedFreight(freightKey);
    setShipping(typeof order.actualShipping === "number" ? String(order.actualShipping) : "");
    setReturning(typeof order.returnFreight === "number" ? String(order.returnFreight) : "");
    setCollection(typeof order.collectionCost === "number" ? String(order.collectionCost) : "");
  }
  const [freightState, freightAction, freightPending] = useActionState(saveFreightAction, initialState);

  if (!showShipping && !showReturn) return null;

  const withoutCost = collectedWithoutCost(order);
  const returnAmount = parsePesos(returning);
  const currentReturn = typeof order.returnFreight === "number" ? order.returnFreight : null;
  const returnReady = returnAmount !== null && returnAmount <= 5_000_000;
  const canSaveReturn = showReturn && returnReady && returnAmount !== currentReturn;

  const shipAmount = shipping.trim() ? parsePesos(shipping) : null;
  const collectionAmount = collection.trim() ? parsePesos(collection) : null;
  const currentShip = typeof order.actualShipping === "number" ? order.actualShipping : null;
  const currentCollection = typeof order.collectionCost === "number" ? order.collectionCost : null;
  const shipInvalid = Boolean(shipping.trim()) && (shipAmount === null || shipAmount > 5_000_000);
  const collectionInvalid = showCollection && Boolean(collection.trim()) && (collectionAmount === null || collectionAmount > 5_000_000);
  const shipChanged = shipAmount !== currentShip;
  const collectionChanged = showCollection && collectionAmount !== currentCollection;
  const canSaveDelivered = showShipping && !shipInvalid && !collectionInvalid && (shipChanged || collectionChanged);
  const canSave = showReturn ? canSaveReturn : canSaveDelivered;

  const currentRealized = orderRealizedMargin(order);
  const draftFreight =
    showReturn && canSaveReturn
      ? previewMarginsWithFreight(order, { returnFreight: returnAmount })
      : showShipping && canSaveDelivered
        ? previewMarginsWithFreight(order, {
            actualShipping: shipAmount,
            ...(showCollection ? { collectionCost: collectionAmount } : {}),
          })
        : null;
  const returnPreview =
    showReturn && canSaveReturn && returnAmount !== null
      ? `Si anotas, el flete de la devolución resta ${formatCop(returnAmount)} de la utilidad realizada. El total guardado no cambia.`
      : null;
  const realizedPreview =
    showShipping &&
    canSaveDelivered &&
    !withoutCost &&
    draftFreight &&
    draftFreight.realized !== null &&
    draftFreight.realized !== currentRealized
      ? `Si anotas, la utilidad realizada de este pedido queda en ${formatCop(draftFreight.realized)}. El margen estimado no cambia. El total guardado no cambia.`
      : null;

  return (
    <form
      action={canManageOrderMoney ? freightAction : undefined}
      onSubmit={canManageOrderMoney ? undefined : (event) => event.preventDefault()}
      className="mt-3 grid gap-3 rounded-[10px] border border-line bg-canvas px-3 py-2"
    >
      <input type="hidden" name="orderId" value={order.id} />
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Dinero</p>
      {showShipping ? (
        <label className="text-sm font-semibold" htmlFor={`flete-${order.id}`}>
          Flete real del envío
          <input
            id={`flete-${order.id}`}
            title="Escribirlo no cobra. El total guardado no cambia."
            name="actualShipping"
            inputMode="numeric"
            value={shipping}
            readOnly={!canManageOrderMoney}
            onChange={(event) => setShipping(event.target.value)}
            className={moneyInput(canManageOrderMoney)}
          />
          <span className="mt-1 block font-normal leading-5 text-muted">
            {canManageOrderMoney
              ? withoutCost
                ? "Ya está cobrado. Sin el costo del producto, este flete no entra en la utilidad realizada. El margen estimado no cambia. Sin un cambio válido el botón queda bloqueado. El total guardado no cambia."
                : "Vacío: la utilidad usa el flete estimado. El margen estimado no cambia. Sin un cambio válido el botón queda bloqueado. El total guardado no cambia."
              : "Lo anota el propietario. El margen estimado no cambia. El total guardado no cambia."}
          </span>
        </label>
      ) : (
        <input type="hidden" name="actualShipping" value="" />
      )}
      {showCollection ? (
        <label className="text-sm font-semibold" htmlFor={`recaudo-${order.id}`}>
          Recaudo real
          <input
            id={`recaudo-${order.id}`}
            title="Escribirlo no cobra. El total guardado no cambia."
            name="collectionCost"
            inputMode="numeric"
            value={collection}
            readOnly={!canManageOrderMoney}
            onChange={(event) => setCollection(event.target.value)}
            className={moneyInput(canManageOrderMoney)}
          />
          <span className="mt-1 block font-normal leading-5 text-muted">
            {canManageOrderMoney
              ? withoutCost
                ? "Ya está cobrado. Sin el costo del producto, este recaudo no entra en la utilidad realizada. El margen estimado no cambia. El total guardado no cambia."
                : "Lo cobrado por recaudar el contraentrega. Reemplaza las comisiones estimadas en la utilidad. Vacío: siguen las estimadas. El margen estimado no cambia. El total guardado no cambia."
              : "Lo anota el propietario. El margen estimado no cambia. El total guardado no cambia."}
          </span>
        </label>
      ) : null}
      {showReturn ? (
        <label className="text-sm font-semibold" htmlFor={`devolucion-${order.id}`}>
          Flete de la devolución
          <input
            id={`devolucion-${order.id}`}
            title="Escribirlo no cobra. El total guardado no cambia."
            name="returnFreight"
            inputMode="numeric"
            value={returning}
            readOnly={!canManageOrderMoney}
            onChange={(event) => setReturning(event.target.value)}
            className={moneyInput(canManageOrderMoney)}
          />
          <span className="mt-1 block font-normal leading-5 text-muted">
            {canManageOrderMoney
              ? canSaveReturn
                ? "Es un gasto. Resta de la utilidad realizada. El total guardado no cambia."
                : returnReady
                  ? "Es el mismo valor ya anotado: el botón queda bloqueado hasta que lo cambies. El total guardado no cambia."
                  : "Vacío no resta nada y no queda decidido: el botón queda bloqueado. Si no hubo flete, anota 0. El total guardado no cambia."
              : "Lo anota el propietario. Vacío no resta. El total guardado no cambia."}
          </span>
        </label>
      ) : (
        <input type="hidden" name="returnFreight" value="" />
      )}
      {returnPreview || realizedPreview ? (
        <p className="text-sm leading-5 text-ink">{returnPreview ?? realizedPreview}</p>
      ) : null}
      {freightState.orderId === order.id && freightState.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {freightState.error}
        </p>
      ) : null}
      {canManageOrderMoney ? (
        <FormTools>
          <button
            type="submit"
            title="El total guardado no cambia. No es dinero cobrado."
            disabled={freightPending || !canSave}
            className={`inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold ${
              freightPending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
            }`}
          >
            {showCollection ? "Guardar flete y recaudo" : "Guardar flete"}
          </button>
        </FormTools>
      ) : (
        <p className="text-sm leading-5 text-muted">Solo el propietario guarda el flete y el recaudo. No cobra.</p>
      )}
    </form>
  );
}

function AddProductForm({ order, products }: { order: StoreOrder; products: OrderableProduct[] }) {
  const [sku, setSku] = useState("");
  const [variant, setVariant] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [addState, addAction, addPending] = useActionState(addOrderLineAction, initialState);
  const chosen = products.find((product) => product.sku === sku);
  const nextVariant = chosen && chosen.variants.length > 0 ? variant.trim() : "";
  const needsChoice = Boolean(chosen && chosen.variants.length > 0 && !nextVariant);
  const qty = Number(quantity);
  const quantityReady = Number.isInteger(qty) && qty >= 1 && qty <= 5;
  const alreadyOnOrder = Boolean(
    chosen && order.lines.some((line) => line.sku === chosen.sku && (line.variant ?? "") === nextVariant),
  );
  const canAdd = Boolean(sku) && !needsChoice && quantityReady && !alreadyOnOrder;
  const preview = canAdd && chosen ? order.total + chosen.price * qty : null;

  if (products.length === 0) {
    return (
      <div className="mt-3 rounded-[10px] border border-line bg-canvas px-3 py-2">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
        <p className="mt-0.5 text-sm text-muted">No hay productos publicados y disponibles para agregar. No cobra. El total guardado no cambia.</p>
      </div>
    );
  }

  return (
    <form action={addAction} className="mt-3 grid gap-3 rounded-[10px] border border-line bg-canvas px-3 py-2">
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="variant" value={nextVariant} />
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Alta</p>
      <label className="text-sm font-semibold" htmlFor={`agregar-${order.id}`}>
        Agregar producto
        <select
          id={`agregar-${order.id}`}
          title="Elegirlo no agrega el producto ni cobra."
          name="sku"
          value={sku}
          onChange={(event) => {
            setSku(event.target.value);
            setVariant("");
          }}
          className={freightInput}
        >
          <option value="">Elige un producto</option>
          {products.map((product) => (
            <option key={product.sku} value={product.sku}>
              {product.title} · precio de la ficha {formatCop(product.price)}
            </option>
          ))}
        </select>
      </label>
      {chosen && chosen.variants.length > 0 ? (
        <label className="text-sm font-semibold" htmlFor={`variante-${order.id}`}>
          {chosen.sizeKind === "tamano" ? "Tamaño" : "Talla"}
          <select
            id={`variante-${order.id}`}
            title={chosen.sizeKind === "tamano" ? "Elegirlo no agrega el producto ni cobra." : "Elegirla no agrega el producto ni cobra."}
            value={variant}
            onChange={(event) => setVariant(event.target.value)}
            className={freightInput}
          >
            <option value="">{chosen.sizeKind === "tamano" ? "Elige el tamaño" : "Elige la talla"}</option>
            {chosen.variants.map((name) => (
              <option key={name} value={name}>
                {chosen.sizeKind === "tamano" ? `Tamaño ${name}` : `Talla ${name}`}
              </option>
            ))}
          </select>
          <span className="mt-1 block font-normal leading-5 text-muted">
            Sin esta elección no se agrega. El servidor también lo rechaza.
          </span>
        </label>
      ) : null}
      <label className="text-sm font-semibold" htmlFor={`agregar-cantidad-${order.id}`}>
        Cantidad
        <input
          id={`agregar-cantidad-${order.id}`}
          title="Escribirla no agrega el producto ni cobra."
          name="quantity"
          inputMode="numeric"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className={freightInput}
        />
        <span className="mt-1 block font-normal leading-5 text-muted">
          De 1 a 5. Se copia el precio de la ficha de hoy a este pedido. No cambia el catálogo. Si ya está en el pedido, cambia la cantidad, la talla o el tamaño
          de arriba. Sin producto, talla o cantidad válida el botón queda bloqueado. Guardar aquí no cambia nada en
          Dropi. No es dinero cobrado.
          {quantityReady ? "" : " Vacío, cero o más de 5 no se agrega: el botón queda bloqueado."}
          {alreadyOnOrder ? " Ese producto ya está en el pedido: el botón queda bloqueado." : ""}
          {preview !== null ? ` Al agregar, el total de productos queda en ${formatCop(preview)}.` : ""}
        </span>
      </label>
      {addState.orderId === order.id && addState.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {addState.error}
        </p>
      ) : null}
      <FormTools>
        <button
          type="submit"
          title="Agregarlo puede cambiar el total guardado. No es dinero cobrado."
          disabled={addPending || !canAdd}
          className={`inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold ${
            addPending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
          }`}
        >
          Agregar producto
        </button>
      </FormTools>
    </form>
  );
}

function LinesForm({
  order,
  products,
  canManageOrderMoney,
}: {
  order: StoreOrder;
  products: OrderableProduct[];
  canManageOrderMoney: boolean;
}) {
  const [lines, setLines] = useState(() =>
    order.lines.map((line) => ({ ...line, sourceVariant: line.variant ?? "", quantity: String(line.quantity) })),
  );
  const [linesState, linesAction, linesPending] = useActionState(saveOrderLinesAction, initialState);
  const [choiceEpoch, setChoiceEpoch] = useState(0);
  const signature = order.lines.map((line) => `${line.sku}:${line.variant ?? ""}:${line.sizeKind ?? ""}:${line.quantity}`).join("|");
  const [syncedSignature, setSyncedSignature] = useState(signature);
  if (signature !== syncedSignature) {
    setSyncedSignature(signature);
    setLines(order.lines.map((line) => ({ ...line, sourceVariant: line.variant ?? "", quantity: String(line.quantity) })));
  }
  const errorToken = linesState.orderId === order.id && linesState.error ? String(linesState.error) : "";
  const [syncedError, setSyncedError] = useState(errorToken);
  if (errorToken !== syncedError) {
    setSyncedError(errorToken);
    if (errorToken) setChoiceEpoch((value) => value + 1);
  }

  const preview = lines.reduce((sum, line) => {
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) return Number.NaN;
    return sum + line.unitPrice * quantity;
  }, 0);
  const sizeHold = lines.some((line) => {
    const product = products.find((item) => item.sku === line.sku);
    return Boolean(product?.sizeKind && product.variants.length > 0 && !variantFits(product.variants, line.variant ?? ""));
  });
  const draftSignature = lines
    .map((line) => `${line.sku}:${line.variant ?? ""}:${line.sizeKind ?? ""}:${line.quantity}`)
    .join("|");
  const unchanged = draftSignature === signature;
  const moneyTouched =
    lines.length !== order.lines.length ||
    lines.some((line) => {
      const previous = order.lines.find((item) => item.sku === line.sku && (item.variant ?? "") === line.sourceVariant);
      return previous !== undefined && String(previous.quantity) !== line.quantity.trim();
    });
  const canSave = !sizeHold && !unchanged && Number.isFinite(preview) && (canManageOrderMoney || !moneyTouched);
  const quantityInvalid = !Number.isFinite(preview);
  const draftLines = Number.isFinite(preview)
    ? lines.map((line) => ({
        sku: line.sku,
        title: line.title,
        unitPrice: line.unitPrice,
        quantity: Number(line.quantity),
        variant: line.variant,
        ...(line.sizeKind ? { sizeKind: line.sizeKind } : {}),
        ...(typeof line.unitCost === "number" ? { unitCost: line.unitCost } : {}),
        ...(typeof line.unitShipping === "number" ? { unitShipping: line.unitShipping } : {}),
        ...(typeof line.unitCommissions === "number" ? { unitCommissions: line.unitCommissions } : {}),
      }))
    : null;
  const marginDraft =
    draftLines && !sizeHold ? orderMargin({ ...order, lines: draftLines, total: preview }) : null;
  const currentMargin = orderMargin(order);

  return (
    <form action={linesAction} className="mt-3 grid gap-3 rounded-[10px] border border-line bg-canvas px-3 py-2">
      <input type="hidden" name="orderId" value={order.id} />
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(
          lines.map((line) => ({
            sku: line.sku,
            variant: line.sourceVariant,
            nextVariant: line.variant ?? "",
            quantity: Number(line.quantity),
          })),
        )}
      />
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Líneas</p>
      <p className="mt-0.5 text-sm font-semibold">Productos del pedido</p>
      <ul className="mt-2 grid gap-3">
        {lines.map((line, index) => {
          const product = products.find((item) => item.sku === line.sku);
          const sized = Boolean(product?.sizeKind && product.variants.length > 0);
          return (
            <li key={`${line.sku}:${line.sourceVariant}:${index}`} className="grid gap-2">
              <p className="text-sm">
                {lineName(line)}
                <span className="mt-1 block text-muted">Precio guardado {formatCop(line.unitPrice)} cada uno. No es dinero cobrado.</span>
              </p>
              {sized && product?.sizeKind ? (
                <label className="text-sm font-semibold" htmlFor={`talla-${order.id}-${index}`}>
                  {product.sizeKind === "tamano" ? "Tamaño" : "Talla"}
                  <select
                    id={`talla-${order.id}-${index}`}
                    title={product.sizeKind === "tamano" ? "Elegirlo no cambia el precio guardado de la línea." : "Elegirla no cambia el precio guardado de la línea."}
                    key={`${choiceEpoch}:${line.sourceVariant}:${line.variant ?? ""}`}
                    value={line.variant ?? ""}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((item, position) =>
                          position === index
                            ? {
                                ...item,
                                variant: event.target.value,
                                sizeKind: event.target.value ? product.sizeKind ?? undefined : undefined,
                              }
                            : item,
                        ),
                      )
                    }
                    className={freightInput}
                  >
                    {line.sourceVariant === "" || !product.variants.includes(line.variant ?? "") ? (
                      <option value="">{product.sizeKind === "tamano" ? "Sin tamaño anotado" : "Sin talla anotada"}</option>
                    ) : null}
                    {product.variants.map((name) => (
                      <option key={name} value={name}>
                        {sizeChoiceLabel(product.sizeKind ?? undefined, name)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="flex items-end gap-2">
                <label className="w-28 shrink-0 text-sm font-semibold" htmlFor={`cantidad-${order.id}-${index}`}>
                  Cantidad
                  <input
                    id={`cantidad-${order.id}-${index}`}
                    title="Escribirla no guarda sola. No es dinero cobrado."
                    inputMode="numeric"
                    value={line.quantity}
                    readOnly={!canManageOrderMoney}
                    onChange={(event) =>
                      setLines((current) => current.map((item, position) => (position === index ? { ...item, quantity: event.target.value } : item)))
                    }
                    className={moneyInput(canManageOrderMoney)}
                  />
                </label>
                {canManageOrderMoney && lines.length > 1 ? (
                  <nav aria-label="Línea" className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Línea</span>
                    <button
                      type="button"
                      title="Quitarla de esta lista no guarda sola. No es dinero cobrado."
                      className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold"
                      onClick={() => setLines((current) => current.filter((_, position) => position !== index))}
                    >
                      Quitar
                    </button>
                  </nav>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm leading-5 text-muted">
        De 1 a 5 por producto. Ese precio es el guardado en el pedido: la talla, el tamaño y un cambio posterior de la
        ficha no lo reescriben. No es dinero cobrado. Si tiene tallas o tamaños, eliges uno antes de guardar. Sin eso el
        botón queda bloqueado y el pedido no se confirma. Sin un cambio el botón queda bloqueado. Para anular el pedido
        completo, usa Cancelar. Guardar aquí no cambia nada en Dropi.
        {canManageOrderMoney ? "" : " La cantidad y quitar un producto los guarda el propietario. La talla o el tamaño sí."}
        {quantityInvalid ? " Vacío, cero o más de 5 no se guarda: el botón queda bloqueado." : ""}
        {Number.isFinite(preview) && preview !== order.total
          ? ` Al guardar, el total de productos queda en ${formatCop(preview)}.`
          : Number.isFinite(preview) && !unchanged
            ? " Al guardar, el total no cambia."
            : ""}
        {marginDraft !== null && marginDraft !== currentMargin
          ? ` Al guardar, el margen estimado queda en ${formatCop(marginDraft)}. No es dinero cobrado.`
          : !unchanged && preview === order.total && marginDraft === currentMargin
            ? " El margen estimado no cambia."
            : ""}
      </p>
      {linesState.orderId === order.id && linesState.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {linesState.error}
        </p>
      ) : null}
      <FormTools>
        <button
          type="submit"
          title="Guardarlas puede cambiar el total guardado. No es dinero cobrado."
          disabled={linesPending || !canSave}
          className={`inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold ${
            linesPending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
          }`}
        >
          Guardar productos
        </button>
      </FormTools>
      <p className="text-xs leading-5 text-muted">
        Guardar no es dinero cobrado. Si cambia la cantidad o quitas un producto, el total guardado sí puede cambiar.
      </p>
    </form>
  );
}

function ClosedDepartmentForm({ order }: { order: StoreOrder }) {
  const [department, setDepartment] = useState("");
  const [departmentState, departmentAction, departmentPending] = useActionState(saveClosedDepartmentAction, initialState);
  const canSave = validateDepartment(department, true) === null;
  const nextDepartment = canSave ? department.trim().replace(/\s+/g, " ") : "";
  const previewText = canSave ? dropiHandoffText({ ...order, department: nextDepartment }) : null;

  return (
    <form action={departmentAction} className="mt-3 grid gap-3 rounded-[10px] border border-line bg-canvas px-3 py-2">
      <input type="hidden" name="orderId" value={order.id} />
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Cerrado</p>
      <label className="text-sm font-semibold" htmlFor={`departamento-cerrado-${order.id}`}>
        Departamento
        <input
          id={`departamento-cerrado-${order.id}`}
          title="Escribirlo no cobra. El total guardado no cambia."
          name="department"
          autoComplete="address-level1"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          className={freightInput}
        />
        <span className="mt-1 block font-normal leading-5 text-muted">
          No es la ciudad. Vacío no se guarda: el botón queda bloqueado. Sale en el texto para Dropi. No cambia el estado
          ni el cobro. El total guardado no cambia.
        </span>
      </label>
      {previewText ? (
        <p className="text-sm leading-5 text-ink">
          Si anotas el departamento, el texto para Dropi queda así. Dropi no está conectado: no crea el pedido ahí. El total guardado no cambia.
          <span className="mt-1 block whitespace-pre-line font-normal text-muted">{previewText}</span>
        </p>
      ) : null}
      {departmentState.orderId === order.id && departmentState.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {departmentState.error}
        </p>
      ) : null}
      <FormTools>
        <button
          type="submit"
          title="Anotarlo no cobra. El total guardado no cambia."
          disabled={departmentPending || !canSave}
          className={`inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold ${
            departmentPending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
          }`}
        >
          Anotar departamento
        </button>
      </FormTools>
    </form>
  );
}

function DeliveryForm({ order }: { order: StoreOrder }) {
  const [name, setName] = useState(order.customerName);
  const [phone, setPhone] = useState(order.phone);
  const [documentId, setDocumentId] = useState(order.document ?? "");
  const [city, setCity] = useState(order.city);
  const [department, setDepartment] = useState(order.department ?? "");
  const [address, setAddress] = useState(order.address);
  const [reference, setReference] = useState(order.reference);
  const deliveryKey = `${order.customerName}|${order.phone}|${order.document ?? ""}|${order.city}|${order.department ?? ""}|${order.address}|${order.reference}`;
  const [syncedDelivery, setSyncedDelivery] = useState(deliveryKey);
  if (deliveryKey !== syncedDelivery) {
    setSyncedDelivery(deliveryKey);
    setName(order.customerName);
    setPhone(order.phone);
    setDocumentId(order.document ?? "");
    setCity(order.city);
    setDepartment(order.department ?? "");
    setAddress(order.address);
    setReference(order.reference);
  }
  const [deliveryState, deliveryAction, deliveryPending] = useActionState(saveDeliveryAction, initialState);

  const checked = validateDelivery({
    customerName: name,
    phone,
    city,
    department,
    address,
    reference,
    document: documentId,
  });
  const draft = checked.value;
  const unchanged =
    Boolean(draft) &&
    draft!.customerName === order.customerName &&
    draft!.phone === order.phone &&
    draft!.city === order.city &&
    draft!.department === (order.department ?? "") &&
    draft!.address === order.address &&
    draft!.reference === order.reference &&
    draft!.document === (order.document ?? "");
  const canSave = Boolean(draft) && !unchanged;
  const previewText =
    canSave && draft
      ? dropiHandoffText({
          ...order,
          customerName: draft.customerName,
          phone: draft.phone,
          document: draft.document || undefined,
          department: draft.department || undefined,
          city: draft.city,
          address: draft.address,
          reference: draft.reference,
        })
      : null;

  return (
    <form action={deliveryAction} className="mt-3 grid gap-3 rounded-[10px] border border-line bg-canvas px-3 py-2">
      <input type="hidden" name="orderId" value={order.id} />
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Corrección</p>
      <p className="mt-0.5 text-sm font-semibold">Corregir entrega</p>
      <label className="text-sm font-semibold" htmlFor={`entrega-nombre-${order.id}`}>
        Nombre de quien recibe
        <input id={`entrega-nombre-${order.id}`} name="customerName" title="Escribirlo no cobra. El total guardado no cambia." value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className={freightInput} />
        <span className="mt-1 block font-normal leading-5 text-muted">Guardarlo no cobra. El total guardado no cambia.</span>
      </label>
      <label className="text-sm font-semibold" htmlFor={`entrega-celular-${order.id}`}>
        Celular
        <input id={`entrega-celular-${order.id}`} name="phone" title="Escribirlo no cobra. El total guardado no cambia." inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={freightInput} />
        <span className="mt-1 block font-normal leading-5 text-muted">Guardarlo no cobra. El total guardado no cambia.</span>
      </label>
      <label className="text-sm font-semibold" htmlFor={`entrega-cedula-${order.id}`}>
        Cédula de quien recibe
        <input id={`entrega-cedula-${order.id}`} name="document" title="Escribirlo no cobra. El total guardado no cambia." inputMode="numeric" autoComplete="off" value={documentId} onChange={(event) => setDocumentId(event.target.value)} className={freightInput} />
        <span className="mt-1 block font-normal leading-5 text-muted">
          Opcional. De 6 a 10 dígitos, sin puntos. Vacío: se quita. Sale en el texto para Dropi y en la confirmación. No va en el mensaje de estado. El total guardado no cambia.
        </span>
      </label>
      <label className="text-sm font-semibold" htmlFor={`entrega-departamento-${order.id}`}>
        Departamento
        <input id={`entrega-departamento-${order.id}`} name="department" title="Escribirlo no cobra. El total guardado no cambia." autoComplete="address-level1" value={department} onChange={(event) => setDepartment(event.target.value)} className={freightInput} />
        <span className="mt-1 block font-normal leading-5 text-muted">
          Opcional si el pedido entró sin él. Vacío: no se agrega. En un pedido nuevo la tienda lo pide. El total guardado no cambia.
        </span>
      </label>
      <label className="text-sm font-semibold" htmlFor={`entrega-ciudad-${order.id}`}>
        Ciudad
        <input id={`entrega-ciudad-${order.id}`} name="city" title="Escribirlo no cobra. El total guardado no cambia." autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} className={freightInput} />
        <span className="mt-1 block font-normal leading-5 text-muted">Guardarla no cobra. El total guardado no cambia.</span>
      </label>
      <label className="text-sm font-semibold" htmlFor={`entrega-direccion-${order.id}`}>
        Dirección
        <input id={`entrega-direccion-${order.id}`} name="address" title="Escribirlo no cobra. El total guardado no cambia." autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} className={freightInput} />
        <span className="mt-1 block font-normal leading-5 text-muted">Guardarla no cobra. El total guardado no cambia.</span>
      </label>
      <label className="text-sm font-semibold" htmlFor={`entrega-referencia-${order.id}`}>
        Barrio o referencia
        <input id={`entrega-referencia-${order.id}`} name="reference" title="Escribirlo no cobra. El total guardado no cambia." autoComplete="off" value={reference} onChange={(event) => setReference(event.target.value)} className={freightInput} />
        <span className="mt-1 block font-normal leading-5 text-muted">
          Opcional. Vacío: se quita. El cliente ve estos datos en su confirmación. Guardar aquí no cambia nada en Dropi.
          El total guardado no cambia.
          {order.providerRef ? " Si ya lo creaste allá, corrige también esa orden." : ""} Sin un cambio válido el botón
          queda bloqueado.
        </span>
      </label>
      {previewText ? (
        <p className="text-sm leading-5 text-ink">
          Si guardas, el texto para Dropi queda así. Dropi no está conectado: no crea el pedido ahí. El total guardado no cambia.
          <span className="mt-1 block whitespace-pre-line font-normal text-muted">{previewText}</span>
        </p>
      ) : null}
      {deliveryState.orderId === order.id && deliveryState.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {deliveryState.error}
        </p>
      ) : null}
      <FormTools>
        <button
          type="submit"
          title="Guardarla no cobra. El total guardado no cambia."
          disabled={deliveryPending || !canSave}
          className={`inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold ${
            deliveryPending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
          }`}
        >
          {deliveryPending ? "Guardando…" : "Guardar entrega · no cobra"}
        </button>
      </FormTools>
    </form>
  );
}

function MotivoMessagePreview({
  order,
  next,
  canSave,
  status,
  lead = "Si guardas, el mensaje para el cliente queda así. El total guardado no cambia.",
}: {
  order: StoreOrder;
  next: string;
  canSave: boolean;
  status?: StoreOrder["status"];
  lead?: string;
}) {
  if (!canSave || !next) return null;
  const text = customerMessage({ ...order, customerReason: next, ...(status ? { status } : {}) });
  return (
    <p className="text-sm leading-5 text-ink">
      {lead}
      <span className="mt-1 block font-normal text-muted">{text}</span>
    </p>
  );
}

function ReturnReasonForm({ order }: { order: StoreOrder }) {
  const [reasonState, reasonAction, reasonPending] = useActionState(saveReturnReasonAction, initialState);
  const [reason, setReason] = useState(order.customerReason ?? "");
  const [syncedReason, setSyncedReason] = useState(order.customerReason);
  if (order.customerReason !== syncedReason) {
    setSyncedReason(order.customerReason);
    setReason(order.customerReason ?? "");
  }
  const next = validateCustomerReason(reason).value ?? "";
  const current = (order.customerReason ?? "").trim().replace(/\s+/g, " ");
  const canSave = Boolean(next) && next !== current;

  if (order.status !== "devuelto") return null;

  return (
    <form action={reasonAction} className="grid gap-3 rounded-[10px] border border-line bg-canvas px-3 py-2">
      <input type="hidden" name="orderId" value={order.id} />
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Devolución</p>
      <label className="text-sm font-semibold" htmlFor={`motivo-devolucion-${order.id}`}>
        Motivo de la devolución
        <textarea
          id={`motivo-devolucion-${order.id}`}
          name="customerReason"
          title="Escribirlo no cobra. El total guardado no cambia."
          rows={3}
          maxLength={160}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 min-h-20 w-full rounded-[10px] border border-line bg-card px-3 py-2 text-sm leading-5 font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
        />
        <span className="mt-1 block font-normal leading-5 text-muted">
          Lo ve en su pedido y en el mensaje. Vacío o sin un cambio: el botón queda bloqueado. No cambia el estado ni
          sale en el texto para Dropi. El total guardado no cambia.
        </span>
      </label>
      <MotivoMessagePreview order={order} next={next} canSave={canSave} />
      {reasonState.orderId === order.id && reasonState.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {reasonState.error}
        </p>
      ) : null}
      <FormTools>
        <button
          type="submit"
          title="Guardarlo no cobra. El total guardado no cambia."
          disabled={reasonPending || !canSave}
          className={`inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold ${
            reasonPending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
          }`}
        >
          {reasonPending ? "Guardando…" : "Guardar motivo"}
        </button>
      </FormTools>
    </form>
  );
}

function IncidenceReasonForm({ order }: { order: StoreOrder }) {
  const [reasonState, reasonAction, reasonPending] = useActionState(saveIncidenceReasonAction, initialState);
  const [reason, setReason] = useState(order.customerReason ?? "");
  const [syncedReason, setSyncedReason] = useState(order.customerReason);
  if (order.customerReason !== syncedReason) {
    setSyncedReason(order.customerReason);
    setReason(order.customerReason ?? "");
  }
  const next = validateCustomerReason(reason).value ?? "";
  const current = (order.customerReason ?? "").trim().replace(/\s+/g, " ");
  const canSave = Boolean(next) && next !== current;

  if (order.status !== "incidencia") return null;

  return (
    <form action={reasonAction} className="grid gap-3 rounded-[10px] border border-line bg-canvas px-3 py-2">
      <input type="hidden" name="orderId" value={order.id} />
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Incidencia</p>
      <label className="text-sm font-semibold" htmlFor={`motivo-incidencia-${order.id}`}>
        Motivo de la incidencia
        <textarea
          id={`motivo-incidencia-${order.id}`}
          name="customerReason"
          title="Escribirlo no cobra. El total guardado no cambia."
          rows={3}
          maxLength={160}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 min-h-20 w-full rounded-[10px] border border-line bg-card px-3 py-2 text-sm leading-5 font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
        />
        <span className="mt-1 block font-normal leading-5 text-muted">
          Lo ve en su pedido y en el mensaje. Vacío o sin un cambio: el botón queda bloqueado. Sin este motivo no se
          resuelve. Anotarlo no la resuelve ni sale en el texto para Dropi. El total guardado no cambia.
        </span>
      </label>
      <MotivoMessagePreview order={order} next={next} canSave={canSave} />
      {reasonState.orderId === order.id && reasonState.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {reasonState.error}
        </p>
      ) : null}
      <FormTools>
        <button
          type="submit"
          title="Anotarlo no cobra. El total guardado no cambia."
          disabled={reasonPending || !canSave}
          className={`inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold ${
            reasonPending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
          }`}
        >
          {reasonPending ? "Guardando…" : "Guardar motivo"}
        </button>
      </FormTools>
    </form>
  );
}

function InternalNoteForm({ order }: { order: StoreOrder }) {
  const [value, setValue] = useState(order.internalNote ?? "");
  const [syncedNote, setSyncedNote] = useState(order.internalNote);
  if (order.internalNote !== syncedNote) {
    setSyncedNote(order.internalNote);
    setValue(order.internalNote ?? "");
  }
  const [noteState, noteAction, notePending] = useActionState(saveInternalNoteAction, initialState);
  const nextNote = value.trim();
  const currentNote = (order.internalNote ?? "").trim();
  const canSave = nextNote.length <= 280 && nextNote !== currentNote;

  return (
    <form action={noteAction} className="grid gap-3 rounded-[10px] border border-line bg-canvas px-3 py-2">
      <input type="hidden" name="orderId" value={order.id} />
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Interna</p>
      <label className="text-sm font-semibold" htmlFor={`nota-${order.id}`}>
        Nota interna
        <textarea
          id={`nota-${order.id}`}
          title="Escribirla no cobra. El total guardado no cambia."
          name="internalNote"
          rows={3}
          maxLength={280}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="mt-1 min-h-20 w-full rounded-[10px] border border-line bg-card px-3 py-2 text-sm leading-5 font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
        />
        <span className="mt-1 block font-normal leading-5 text-muted">
          Solo la ves tú, hasta 280 caracteres. No sale en el mensaje al cliente ni en el texto para Dropi. Vacío: se
          quita. Sin un cambio el botón queda bloqueado. El total guardado no cambia.
        </span>
      </label>
      {canSave ? (
        <p className="text-sm leading-5 text-ink">
          {nextNote
            ? "Si guardas, solo tú ves esta nota. No sale en el mensaje al cliente ni en el texto para Dropi. El total guardado no cambia."
            : "Si guardas, se quita la nota. Dejas de verla aquí. El total guardado no cambia."}
          {nextNote ? <span className="mt-1 block font-normal whitespace-pre-wrap text-muted">{nextNote}</span> : null}
        </p>
      ) : null}
      {noteState.orderId === order.id && noteState.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {noteState.error}
        </p>
      ) : null}
      <FormTools>
        <button
          type="submit"
          title="Guardarla no cobra. El total guardado no cambia."
          disabled={notePending || !canSave}
          className={`inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold ${
            notePending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
          }`}
        >
          Guardar nota
        </button>
      </FormTools>
    </form>
  );
}

function CustomerNote({ order }: { order: StoreOrder }) {
  const text = customerMessage(order);
  const href = whatsAppHref(order.phone, text);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  function copy() {
    const node = document.getElementById(`mensaje-${order.id}`);
    if (!(node instanceof HTMLTextAreaElement)) return;
    node.focus();
    node.select();
    let copiedByCommand = false;
    try {
      copiedByCommand = document.execCommand("copy");
    } catch {
      copiedByCommand = false;
    }
    if (copiedByCommand) {
      setCopied("ok");
      return;
    }
    void navigator.clipboard.writeText(text).then(
      () => setCopied("ok"),
      () => setCopied("fail"),
    );
  }

  return (
    <div className="grid gap-3 rounded-[10px] border border-line bg-canvas px-3 py-2">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Cliente</p>
      <label className="text-sm font-semibold" htmlFor={`mensaje-${order.id}`}>
        Mensaje para el cliente
        <textarea
          id={`mensaje-${order.id}`}
          title="Leerlo no envía el mensaje ni cobra. El total guardado no cambia."
          readOnly
          rows={4}
          value={text}
          className="mt-1 min-h-24 w-full rounded-[10px] border border-line bg-card px-3 py-2 text-sm leading-5 font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
        />
        <span className="mt-1 block font-normal leading-5 text-muted">
          Sale del estado del pedido. Lo envías tú. Copiarlo o abrir WhatsApp no lo envía, no cobra y el total guardado no cambia.
        </span>
      </label>
      <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle"
          aria-label={`Copiar mensaje de ${order.number}`}
          title="Copiarlo no cobra. El total guardado no cambia."
          onClick={copy}
        >
          {copied === "ok" ? "Mensaje copiado" : "Copiar mensaje"}
        </button>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            title="Abrirlo no envía el mensaje ni cobra. El total guardado no cambia."
            className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle"
          >
            Abrir en WhatsApp
          </a>
        ) : null}
      </nav>
      {copied === "ok" ? (
        <p role="status" className="text-sm text-accent-strong">
          Listo para pegarlo. Desde aquí no se envía ni cambia el total guardado.
        </p>
      ) : null}
      {copied === "fail" ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          No se pudo copiar. El mensaje queda seleccionado para copiarlo a mano.
        </p>
      ) : null}
      <CustomerNotice order={order} />
    </div>
  );
}

function CustomerNotice({ order }: { order: StoreOrder }) {
  const [noticeState, noticeAction, noticePending] = useActionState(markCustomerNoticeAction, initialState);
  const marked = Boolean(order.customerNotifiedAt);
  return (
    <form action={noticeAction} className="grid gap-2">
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="intent" value={marked ? "quitar" : "avisar"} />
      {marked ? (
        <p className="text-sm leading-5 text-ink">
          Avisaste al cliente el {formatDay(order.customerNotifiedAt?.slice(0, 10) ?? "")}. Desde aquí no se envió. Si
          quitas la marca, vuelve a la lista de los que faltan por avisar. No envía el mensaje ni abre WhatsApp. El
          total guardado no cambia.
        </p>
      ) : (
        <p className="text-sm leading-5 text-ink">
          Si marcas, queda anotado que avisaste. El estado del pedido no cambia. No envía el mensaje ni abre WhatsApp.
          El total guardado no cambia.
        </p>
      )}
      {noticeState.orderId === order.id && noticeState.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {noticeState.error}
        </p>
      ) : null}
      <FormTools>
        <button
          type="submit"
          title="No envía el mensaje ni cobra. El total guardado no cambia."
          disabled={noticePending}
          className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold disabled:cursor-wait"
        >
          {marked ? "Quitar aviso" : "Ya avisé al cliente"}
        </button>
      </FormTools>
    </form>
  );
}

const freightInput =
  "mt-1 h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none";

function FormTools({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <nav aria-label="Herramientas" className={`flex flex-wrap items-center gap-2${className ? ` ${className}` : ""}`}>
      <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
      {children}
    </nav>
  );
}

function moneyInput(canEdit: boolean) {
  return canEdit ? freightInput : freightInput.replace(" bg-card ", " bg-subtle ");
}

function workQueues(orders: StoreOrder[], guides: SizeGuide[], canManageOrderMoney: boolean, costGuides: CostGuide[] = []) {
  return attentionQueues(orders, guides, canManageOrderMoney, costGuides);
}

function rowWarnings(order: StoreOrder, guides: SizeGuide[], canManageOrderMoney = true) {
  const notes: string[] = [];
  const confirm = confirmQueueNote(order, guides);
  if (confirm) notes.push(confirm);
  const size = missingSizeNote(order, guides);
  if (size) notes.push(size);
  if (needsIncidenceReason(order)) notes.push("Falta el motivo de la incidencia. El total guardado no cambia.");
  if (needsReturnReason(order)) notes.push("Falta el motivo de la devolución. El total guardado no cambia.");
  if (needsReturnFreight(order)) {
    notes.push(
      canManageOrderMoney
        ? "Falta el flete de la devolución. El total guardado no cambia."
        : "Falta el flete de la devolución. Lo anota el propietario. El total guardado no cambia.",
    );
  }
  const department = missingDepartmentNote(order);
  if (department && !confirm) notes.push(department);
  if (readyToPrepare(order)) notes.push(prepareQueueNote(order));
  if (readyToDispatch(order)) notes.push(dispatchQueueNote(order));
  if (needsCustomerNotice(order)) notes.push("Falta avisarle al cliente. El total guardado no cambia.");
  if (needsCatalogCost(order) && notes.length < 2) {
    notes.push(canManageOrderMoney ? costQueueWarning(order) : "Falta el costo en el pedido. Lo copia el propietario. El total guardado no cambia.");
  }
  return notes.slice(0, 2);
}

function realizedDetail(summary: ReturnType<typeof summarizeStoreOrders>) {
  const notes: string[] = [];
  if (summary.returnFreight > 0) notes.push(`resta ${formatCop(summary.returnFreight)} de flete de devolución`);
  if (summary.collectionCost > 0) {
    notes.push(`usa ${formatCop(summary.collectionCost)} de recaudo real en lugar de las comisiones estimadas`);
  }
  if (notes.length === 0) return "Entregado y cobrado, menos fletes de devolución anotados. No es el total guardado.";
  return `Ya ${notes.join(" y ")}. No es el total guardado.`;
}

function countLabel(count: number) {
  return count === 1 ? "1 pedido" : `${count} pedidos`;
}

function SummaryCard({
  label,
  value,
  detail,
  numbers = [],
  extra,
}: {
  label: string;
  value: string;
  detail: string;
  numbers?: string[];
  extra?: ReactNode;
}) {
  return (
    <div className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2">
      <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{label}</dt>
      <dd className="mt-1 text-lg font-extrabold tabular-nums">{value}</dd>
      <dd className="mt-0.5 text-xs leading-5 text-muted">{detail}</dd>
      {numbers.length > 0 ? (
        <dd>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {numbers.map((number) => (
              <li key={number}>
                <Link href={orderFocusHref(number)} title="Abrirlo no cobra ni cambia el total guardado." className="text-sm font-semibold text-accent-strong">
                  {number}
                </Link>
              </li>
            ))}
          </ul>
        </dd>
      ) : null}
      {extra ? <dd className="mt-2">{extra}</dd> : null}
    </div>
  );
}

function OrderLinks({ numbers, lead }: { numbers: string[]; lead: "de" | ":" }) {
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

