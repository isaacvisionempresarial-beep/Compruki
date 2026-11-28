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
import { accountHoldNote, attentionCostAside, attentionQueueIsOwnerMoney, attentionQueues, awaitsDropiNumber, closePhrase, lineName, needsClosedDropiNumber, needsIncidenceDropiNumber, orderFocusHref, costDrift, costDriftNote, ordersInSpan, priceDrift, orderPriceStayNote, resultDriftNote, resultsByProduct, samePhoneMatches, orderCostCopyNote, outsideCostCopyNote, periodCostShiftNote, skuCostPreviewNote, storedSkuLines, summarizeStoreOrders, syncSectionHref, widerPeriodWithResults, type CloseBasis, type CostGuide, type PriceGuide, type SizeGuide, type StoreOrder } from "@/lib/store-order";
import type { OpsSnapshot } from "@/server/ops-snapshot";

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

const homeProductGrid = "md:grid-cols-[minmax(0,1.4fr)_minmax(7.5rem,1fr)_minmax(7.5rem,1fr)_minmax(7.5rem,1fr)]";

export type AgentPendingSummary = {
  total: number;
  pedidos: number;
  borradores: number;
  agentes: number;
  preguntas: number;
  seguimientos: number;
  preview: Array<{
    id: string;
    kind: "pedido" | "agente" | "borrador" | "pregunta" | "seguimiento";
    label: string;
    detail: string;
    href: string;
  }>;
};

export type AgentHomeBriefView = {
  openaiConnected: boolean;
  periodLabel: string;
  monthRuns: number;
  monthCostEstimateCop: number;
};

export function Dashboard({
  storeOrders,
  sizeGuides,
  priceGuides = [],
  costGuides = [],
  today,
  greetingName,
  canManageOrderMoney = false,
  canApproveCatalog = false,
  agentPendingCount = 0,
  agentPendingSummary = null,
  agentHome = null,
  ops = null,
}: {
  storeOrders: StoreOrder[];
  sizeGuides: SizeGuide[];
  priceGuides?: PriceGuide[];
  costGuides?: CostGuide[];
  today: string;
  greetingName: string;
  canManageOrderMoney?: boolean;
  canApproveCatalog?: boolean;
  agentPendingCount?: number;
  agentPendingSummary?: AgentPendingSummary | null;
  agentHome?: AgentHomeBriefView | null;
  ops?: OpsSnapshot | null;
}) {
  const [storePeriod, setStorePeriod] = useState<Period>("7d");
  const [basis, setBasis] = useState<CloseBasis>("creados");
  const query = usePanelQuery().trim().toLocaleLowerCase("es");

  const storeInPeriod = useMemo(
    () => ordersInSpan(storeOrders, storePeriod, today, basis),
    [storeOrders, storePeriod, today, basis],
  );
  const storeSummary = useMemo(() => summarizeStoreOrders(storeInPeriod), [storeInPeriod]);
  const periodShift = useMemo(() => {
    const seen = new Set(storeInPeriod.map((order) => order.number));
    return periodCostShiftNote(storeInPeriod, costGuides, "este período", storeOrders.filter((order) => !seen.has(order.number)));
  }, [costGuides, storeInPeriod, storeOrders]);
  const productRows = useMemo(() => resultsByProduct(storeInPeriod, sizeGuides), [storeInPeriod, sizeGuides]);
  const widerStorePeriod =
    productRows.length === 0 ? widerPeriodWithResults(storeOrders, storePeriod, sizeGuides, today, basis) : null;
  const productResults = useMemo(() => {
    if (!query) return productRows;
    return productRows.filter((row) =>
      [row.title, row.sku, resultDriftNote(storeInPeriod, row.sku, priceGuides, costGuides), periodCostPreview(storeInPeriod, storeOrders, row.sku, costGuides), outsideCopyNote(storeOrders, row.sku, costGuides), ...row.sizes.map((size) => size.label), ...row.sources.map((source) => source.number)].some((value) => value.toLocaleLowerCase("es").includes(query)),
    );
  }, [costGuides, priceGuides, productRows, query, storeInPeriod]);
  const attention = useMemo(
    () => attentionQueues(storeOrders, sizeGuides, canManageOrderMoney, costGuides),
    [storeOrders, sizeGuides, canManageOrderMoney, costGuides],
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
        orderPriceStayNote(row.order, priceGuides),
        costDriftNote(costDrift(row.order, costGuides)),
        orderCostCopyNote(row.order, costGuides),
        attentionCostAside(row.note, row.order, costGuides, canManageOrderMoney),
        priceDrift(row.order, priceGuides).length > 0 || costDrift(row.order, costGuides).length > 0 ? accountHoldNote(row.order.status) : "",
        ...row.order.lines.flatMap((line) => [line.title, line.sku, line.variant ?? ""]),
      ].some((value) => value.toLocaleLowerCase("es").includes(query)),
    );
  }, [attention, canManageOrderMoney, costGuides, priceGuides, query]);

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
    { label: "Registrados", ...storeSummary.registered, hint: "Sin cancelados ni devueltos. No es cobro." },
    { label: "Confirmados", ...storeSummary.confirmed, hint: "Ya confirmados. No es cobro." },
    { label: "Entregados", ...storeSummary.delivered, hint: "Estado entregado. No es cobro." },
    { label: "Cobrados", ...storeSummary.collected, hint: "Marcados cobrados. No es utilidad." },
  ];

  const opsCards = ops
    ? [
        {
          label: "WA sin leer",
          value: ops.unread,
          href: "/panel/inbox?f=unread",
          tone: ops.unread > 0 ? "warn" : "ok",
        },
        {
          label: "Chats libres",
          value: ops.freeChats,
          href: "/panel/inbox?f=unassigned",
          tone: ops.freeChats > 0 ? "warn" : "ok",
        },
        {
          label: "Por responder",
          value: ops.awaitingReply,
          href: "/panel/inbox?f=awaiting",
          tone: ops.awaitingReply > 0 ? "warn" : "ok",
        },
        {
          label: "Ventana <2h",
          value: ops.urgentWindow,
          href: "/panel/inbox?f=urgent",
          tone: ops.urgentWindow > 0 ? "danger" : "ok",
        },
        {
          label: "CRM abiertos",
          value: ops.openFollowups,
          href: "/panel/clientes?f=all",
          tone: "ok",
        },
        {
          label: "CRM vencidos",
          value: ops.overdueFollowups,
          href: "/panel/clientes?f=overdue",
          tone: ops.overdueFollowups > 0 ? "danger" : "ok",
        },
        {
          label: "CRM alta",
          value: ops.highFollowups,
          href: "/panel/clientes?f=high",
          tone: ops.highFollowups > 0 ? "warn" : "ok",
        },
        {
          label: "Míos CRM",
          value: ops.myFollowups,
          href: "/panel/clientes?f=mine",
          tone: "ok",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      <header className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Panel</p>
            <h1 className="mt-0.5 text-xl leading-6 font-extrabold tracking-tight sm:text-[22px]">Hola {greetingName}</h1>
            <p className="mt-0.5 text-sm text-muted">
              Atiende la cola, revisa cifras y cuentas de la tienda.
              {canManageOrderMoney ? "" : " Flete, costo y cobro los guarda el propietario."}
            </p>
          </div>
          <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
            <nav aria-label="Accesos" className="flex shrink-0 items-center gap-2">
              <Link
                href="/panel/pedidos#por-atender"
                className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3.5 text-sm font-semibold whitespace-nowrap text-on-dark hover:bg-primary-soft"
              >
                Atender
                {orderWork.yours > 0 ? (
                  <span className="ml-2 rounded-[8px] bg-on-dark/15 px-1.5 py-0.5 text-xs font-bold tabular-nums">{orderWork.yours}</span>
                ) : null}
              </Link>
              <Link
                href="/panel/inbox"
                className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold whitespace-nowrap text-ink hover:bg-subtle"
              >
                Inbox
                {ops && ops.unread > 0 ? (
                  <span className="ml-2 rounded-[8px] bg-coral/15 px-1.5 py-0.5 text-xs font-bold text-coral tabular-nums">
                    {ops.unread}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/panel/clientes"
                className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold whitespace-nowrap text-ink hover:bg-subtle"
              >
                CRM
                {ops && ops.overdueFollowups > 0 ? (
                  <span className="ml-2 rounded-[8px] bg-coral/15 px-1.5 py-0.5 text-xs font-bold text-coral tabular-nums">
                    {ops.overdueFollowups}
                  </span>
                ) : agentPendingSummary && agentPendingSummary.seguimientos > 0 ? (
                  <span className="ml-2 rounded-[8px] bg-accent-tint px-1.5 py-0.5 text-xs font-bold text-accent-strong tabular-nums">
                    {agentPendingSummary.seguimientos}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/panel/catalogo"
                className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold whitespace-nowrap text-ink hover:bg-subtle"
              >
                Catálogo
              </Link>
              {agentPendingCount > 0 ? (
                <Link
                  href="/panel/agentes#pendientes-humanos"
                  className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold whitespace-nowrap text-ink hover:bg-subtle"
                >
                  Agentes
                  <span className="ml-2 rounded-[8px] bg-coral/15 px-1.5 py-0.5 text-xs font-bold text-coral tabular-nums">{agentPendingCount}</span>
                </Link>
              ) : null}
              {syncWorkCount > 0 ? (
                <Link
                  href={syncSectionHref("sync-crear")}
                  className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold whitespace-nowrap text-ink hover:bg-subtle"
                >
                  Sync
                  <span className="ml-2 rounded-[8px] bg-accent-tint px-1.5 py-0.5 text-xs font-bold text-accent-strong tabular-nums">{syncWorkCount}</span>
                </Link>
              ) : null}
            </nav>
          </div>
        </div>
      </header>

      {opsCards.length > 0 ? (
        <section className="mt-3" aria-label="WhatsApp y CRM">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {opsCards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="elevate-1 rounded-[12px] border border-line bg-card px-3 py-2.5 hover:bg-subtle"
              >
                <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{card.label}</p>
                <p
                  className={cx(
                    "mt-1 text-xl font-extrabold tabular-nums",
                    card.tone === "danger"
                      ? "text-danger"
                      : card.tone === "warn"
                        ? "text-warning"
                        : "text-ink",
                  )}
                >
                  {card.value}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {agentHome ? (
        <section
          className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2.5 sm:px-4"
          aria-labelledby="uso-ia-home"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">IA</p>
              <h2 id="uso-ia-home" className="text-sm font-semibold">
                OpenAI {agentHome.openaiConnected ? "conectado" : "no conectado"}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {agentHome.periodLabel}: {agentHome.monthRuns} corrida{agentHome.monthRuns === 1 ? "" : "s"}
                {" · "}
                costo est. {formatCop(agentHome.monthCostEstimateCop)}. No es dinero cobrado. Dropi no está conectado.
              </p>
            </div>
            <nav aria-label="Vista" className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
              <Link
                href="/panel/agentes#corridas"
                className="inline-flex h-8 items-center rounded-[10px] border border-line bg-canvas px-2.5 text-sm font-semibold text-ink hover:bg-subtle"
              >
                Ver corridas
              </Link>
              <Link
                href="/panel/agentes#presupuesto-ia"
                className="inline-flex h-8 items-center rounded-[10px] border border-line bg-canvas px-2.5 text-sm font-semibold text-ink hover:bg-subtle"
              >
                Presupuesto
              </Link>
            </nav>
          </div>
        </section>
      ) : null}

      {agentPendingSummary && agentPendingSummary.total > 0 ? (
        <section
          className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2.5 sm:px-4"
          aria-labelledby="pendientes-agentes-home"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 id="pendientes-agentes-home" className="text-sm font-semibold">
                Bandeja · {agentPendingSummary.total} pendiente{agentPendingSummary.total === 1 ? "" : "s"}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {agentPendingSummary.pedidos} pedido{agentPendingSummary.pedidos === 1 ? "" : "s"}
                {" · "}
                {agentPendingSummary.borradores} borrador{agentPendingSummary.borradores === 1 ? "" : "es"}
                {" · "}
                {agentPendingSummary.agentes} corrida{agentPendingSummary.agentes === 1 ? "" : "s"}
                {" · "}
                {agentPendingSummary.preguntas} pregunta{agentPendingSummary.preguntas === 1 ? "" : "s"}
                {" · "}
                {agentPendingSummary.seguimientos} seguimiento
                {agentPendingSummary.seguimientos === 1 ? "" : "s"}
                {canApproveCatalog ? "" : ". Aprobar lo guarda el propietario."}
              </p>
            </div>
            <nav aria-label="Vista" className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
              <Link href="/panel/agentes#pendientes-humanos" className="inline-flex h-8 items-center rounded-[10px] border border-line bg-canvas px-2.5 text-sm font-semibold text-ink hover:bg-subtle">
                Abrir bandeja
              </Link>
              {agentPendingSummary.preguntas > 0 ? (
                <Link
                  href="/panel/catalogo?filtro=preguntas"
                  className="inline-flex h-8 items-center rounded-[10px] border border-line bg-canvas px-2.5 text-sm font-semibold text-ink hover:bg-subtle"
                >
                  Catálogo
                </Link>
              ) : null}
              {agentPendingSummary.seguimientos > 0 ? (
                <Link
                  href="/panel/clientes"
                  className="inline-flex h-8 items-center rounded-[10px] border border-line bg-canvas px-2.5 text-sm font-semibold text-ink hover:bg-subtle"
                >
                  Clientes
                </Link>
              ) : null}
            </nav>
          </div>
          <ul className="mt-2 space-y-1">
            {agentPendingSummary.preview.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="truncate text-sm">
                <span className="mr-2 rounded-[8px] border border-line px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
                  {item.kind}
                </span>
                <Link href={item.href} className="font-semibold text-accent-strong">
                  {item.label}
                </Link>
                <span className="text-muted"> · {item.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-4" aria-labelledby="tienda-titulo">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Tienda pública</p>
            <h2 id="tienda-titulo" className="mt-0.5 text-base font-bold leading-6">Pedidos de la tienda</h2>
            <p className="mt-0.5 max-w-2xl text-xs leading-5 text-muted">
              {closePhrase(storePeriod, basis)}.
              {basis === "movidos" ? " El total guardado es el del pedido, no lo cobrado ese día." : ""}
            </p>
          </div>
        </div>
        <div className="elevate-1 mt-2 grid gap-3 rounded-[14px] border border-line bg-card px-3 py-2.5 sm:grid-cols-2 sm:items-center sm:gap-x-5">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Fecha</p>
              <p className="text-[11px] leading-4 text-muted">Creados o movidos.</p>
            </div>
            <CloseBasisControl basis={basis} onChange={setBasis} name="base-tienda" wide />
          </div>
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Período</p>
              <p className="text-[11px] leading-4 text-muted">No recorta Por atender ni cobra.</p>
            </div>
            <PeriodControl
              period={storePeriod}
              onChange={setStorePeriod}
              name="periodo-tienda"
              legend="Período de los pedidos de la tienda"
              wide
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Totales</p>
            <h3 className="mt-0.5 text-sm font-semibold">Totales guardados</h3>
          </div>
          <p className="text-xs text-muted">Suma del pedido. No es cobro en el sitio.</p>
        </div>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {storeCards.map((card) => (
            <li key={card.label} className="elevate-1 rounded-[12px] border border-line bg-card px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{card.label}</p>
                <p className="text-[11px] text-muted tabular-nums">
                  {card.count} {card.count === 1 ? "pedido" : "pedidos"}
                </p>
              </div>
              <p className="mt-1 text-lg leading-5 font-extrabold tracking-tight tabular-nums">{formatCop(card.amount)}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted">{card.hint}</p>
              {card.numbers.length > 0 ? (
                <ul className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-sm leading-5">
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

        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Cuenta</p>
            <h3 className="mt-0.5 text-sm font-semibold">La cuenta</h3>
          </div>
          <p className="text-xs text-muted">Estimado ≠ utilidad ≠ cobro del sitio.</p>
        </div>
        <dl className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="elevate-1 rounded-[12px] border border-line bg-card px-3 py-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Margen estimado</dt>
            <dd className="mt-1 text-base font-extrabold tabular-nums">{formatCop(storeSummary.estimatedMargin.amount)}</dd>
            <dd className="mt-0.5 text-[11px] leading-4 text-muted">
              Confirmados
              <OrderListPhrase numbers={storeSummary.estimatedMargin.numbers} lead=":" />
            </dd>
            {storeSummary.estimatedMargin.missingNumbers.length > 0 ? (
              <dd className="mt-0.5 text-[11px] leading-4 text-muted">
                Sin costo{canManageOrderMoney ? "" : " · propietario"}
                <OrderListPhrase numbers={storeSummary.estimatedMargin.missingNumbers} lead=":" />
              </dd>
            ) : null}
          </div>
          <div className="elevate-1 rounded-[12px] border border-line bg-card px-3 py-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Utilidad realizada</dt>
            <dd className="mt-1 text-base font-extrabold tabular-nums">{formatCop(storeSummary.realized.amount)}</dd>
            <dd className="mt-0.5 text-[11px] leading-4 text-muted">
              Entregados y cobrados
              <OrderListPhrase numbers={storeSummary.realized.numbers} lead=":" />
            </dd>
            {storeSummary.realized.missingNumbers.length > 0 || storeSummary.returnFreight > 0 || storeSummary.collectionCost > 0 ? (
              <dd className="mt-0.5 space-y-0.5 text-[11px] leading-4 text-muted">
                {storeSummary.realized.missingNumbers.length > 0 ? (
                  <span className="block">
                    Cobrado sin costo{canManageOrderMoney ? "" : " · propietario"}
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
          <div className="elevate-1 rounded-[12px] border border-line bg-card px-3 py-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Devueltos</dt>
            <dd className="mt-1 text-base font-extrabold tabular-nums">{formatCop(storeSummary.returned.amount)}</dd>
            <dd className="mt-0.5 text-[11px] leading-4 text-muted">
              No entra a la utilidad
              <OrderListPhrase numbers={storeSummary.returned.numbers} lead=":" />
            </dd>
          </div>
        </dl>
        {periodShift ? <p className="mt-2 text-sm leading-5">{periodShift}</p> : null}
      </section>

      <section className="mt-4" aria-labelledby="entradas">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Entradas</p>
            <h2 id="entradas" className="mt-0.5 text-base font-bold">Dónde se trabaja</h2>
          </div>
          <p className="text-xs text-muted">No cambian con el período.</p>
        </div>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          <li>
            <Link href="/panel/pedidos#por-atender" className="elevate-1 block rounded-[12px] border border-line bg-card px-3 py-2.5 hover:bg-canvas">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Pedidos</span>
                <span className="text-sm font-extrabold tabular-nums">{orderWork.yours}</span>
              </span>
              <span className="mt-1 block text-sm font-bold">Por atender</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-muted">
                {canManageOrderMoney
                  ? "Un pedido, un siguiente paso."
                  : orderWork.ownerMoney > 0
                    ? `${orderWork.ownerMoney} con flete/costo/recaudo lo guarda el propietario.`
                    : "Estado, entrega, talla y aviso."}
              </span>
            </Link>
          </li>
          <li>
            <Link href={syncSectionHref("sync-crear")} className="elevate-1 block rounded-[12px] border border-line bg-card px-3 py-2.5 hover:bg-canvas">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Sincronización</span>
                <span className="text-sm font-extrabold tabular-nums">{syncWorkCount}</span>
              </span>
              <span className="mt-1 block text-sm font-bold">Sin número Dropi</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-muted">
                Anotar a mano. No se envía desde aquí.
              </span>
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-4" aria-labelledby="por-producto">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Productos</p>
            <h2 id="por-producto" className="mt-0.5 text-base font-bold">Por producto ({productResults.length})</h2>
            <p className="mt-0.5 text-xs text-muted">Mismo período y fecha que las cifras de arriba.</p>
          </div>
          <nav aria-label="Vista" className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
            <Link href="/panel/rentabilidad" className="inline-flex h-8 items-center rounded-[10px] border border-line bg-canvas px-2.5 text-sm font-semibold text-ink hover:bg-subtle">
              Rentabilidad
            </Link>
          </nav>
        </div>
        {productResults.length === 0 ? (
          <div className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
            <p className="mt-0.5 text-sm text-muted">
              {productRows.length > 0
                ? "Ningún producto coincide con la búsqueda."
                : `En este período no hay pedidos confirmados ni devueltos.${widerStorePeriod ? ` En ${closePhrase(widerStorePeriod, basis)} sí hay.` : ""}`}
            </p>
          </div>
        ) : (
          <div className="elevate-1 mt-3 overflow-hidden rounded-[14px] border border-line bg-card">
            <div
              className={cx(
                "hidden items-end gap-4 border-b border-line bg-canvas px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase md:grid",
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
                    {resultDriftNote(storeInPeriod, row.sku, priceGuides, costGuides) ? (
                      <p className="mt-1 text-xs leading-5 text-warning">{resultDriftNote(storeInPeriod, row.sku, priceGuides, costGuides)}</p>
                    ) : null}
                    {periodCostPreview(storeInPeriod, storeOrders, row.sku, costGuides) ? (
                      <p className="mt-1 text-xs leading-5">{periodCostPreview(storeInPeriod, storeOrders, row.sku, costGuides)}</p>
                    ) : null}
                    {outsideCopyNote(storeOrders, row.sku, costGuides) ? (
                      <p className="mt-1 text-xs leading-5">{outsideCopyNote(storeOrders, row.sku, costGuides)}</p>
                    ) : null}
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
        <CloseSheet orders={storeInPeriod} rest={storeOrders.filter((order) => !storeInPeriod.some((shown) => shown.number === order.number))} period={storePeriod} basis={basis} guides={sizeGuides} priceGuides={priceGuides} costGuides={costGuides} fieldId="cierre-tienda" />
      </section>

      <section className="mt-4" aria-labelledby="por-atender">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Cola</p>
            <h2 id="por-atender" className="mt-0.5 text-base font-bold">Por atender ({waiting.length})</h2>
          </div>
          <p className="max-w-xl text-xs text-muted">
            {canManageOrderMoney
              ? "Misma cola que Pedidos. No se recorta por período. Copiarla no envía."
              : "Misma cola que Pedidos. Flete y costo los guarda el propietario. No se recorta por período."}
          </p>
        </div>
        {waiting.length === 0 ? (
          <div className="elevate-1 mt-2 rounded-[12px] border border-line bg-card px-3 py-2">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
            <p className="mt-0.5 text-sm text-muted">
              {attention.length === 0
                ? "No hay pedidos esperando un dato o una herramienta."
                : "Ningún pedido de la cola coincide con la búsqueda."}
            </p>
          </div>
        ) : (
          <ul className="elevate-1 mt-2 divide-y divide-line overflow-hidden rounded-[12px] border border-line bg-card">
            {waiting.map((row) => {
              const order = row.order;
              const phoneCount = samePhoneMatches(order, storeOrders).length;
              const place = [order.city, order.department].filter(Boolean).join(" · ");
              const products = order.lines.map((line) => `${line.quantity} × ${lineName(line)}`).join(", ");
              const driftNote = orderPriceStayNote(order, priceGuides);
              const costNote = costDriftNote(costDrift(order, costGuides));
              const copyNote = orderCostCopyNote(order, costGuides);
              const costAside = attentionCostAside(row.note, order, costGuides, canManageOrderMoney);
              const hold = driftNote || costNote ? accountHoldNote(order.status) : "";
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
                      <span className="mt-0.5 block text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{row.queueTitle}</span>
                      <span className="block truncate text-sm font-semibold text-warning" title={row.note}>
                        {row.note}
                      </span>
                      {driftNote ? (
                        <span className="mt-0.5 block text-xs leading-5 text-warning" title={driftNote}>
                          {driftNote}
                        </span>
                      ) : null}
                      {costNote ? (
                        <span className="mt-0.5 block text-xs leading-5 text-warning" title={costNote}>
                          {costNote}
                        </span>
                      ) : null}
                      {costAside ? (
                        <span className="mt-0.5 block text-xs leading-5">{costAside}</span>
                      ) : copyNote ? (
                        <span className="mt-0.5 block text-xs leading-5">{copyNote}</span>
                      ) : null}
                      {hold ? (
                        <span className="mt-0.5 block text-xs leading-5 text-warning" title={hold}>
                          {hold}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                      <span className="text-right">
                        <span className="block text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Total guardado</span>
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
        <AttentionSheet orders={storeOrders} guides={sizeGuides} priceGuides={priceGuides} costGuides={costGuides} canManageOrderMoney={canManageOrderMoney} />
      </section>
    </div>
  );
}

function HomeProductFigure({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="md:pt-0.5 md:text-right">
      <p className="mb-1 text-[10px] font-bold tracking-[0.08em] text-muted uppercase md:sr-only">{label}</p>
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

