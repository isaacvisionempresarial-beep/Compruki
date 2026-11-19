"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePanelQuery } from "@/components/panel/panel-shell";
import { StatusPill } from "@/components/panel/status-pill";
import { cx } from "@/lib/cx";
import { formatDay } from "@/lib/format";
import {
  awaitsDropiNumber,
  canNoteDropiNumber,
  needsClosedDropiNumber,
  needsIncidenceDropiNumber,
  normalizeProviderRef,
  syncFocusHref,
  type StoreOrder,
} from "@/lib/store-order";

const syncGrid = "md:grid-cols-[6.75rem_minmax(0,1.4fr)_12.5rem_9rem_4.25rem]";

export function SyncScreen({ orders }: { orders: StoreOrder[] }) {
  const query = usePanelQuery().trim().toLocaleLowerCase("es");
  const noted = useMemo(
    () => orders.filter((order) => canNoteDropiNumber(order) && Boolean(normalizeProviderRef(order.providerRef ?? ""))),
    [orders],
  );
  const groups = [
    {
      id: "sync-crear",
      title: "Falta número Dropi",
      hint: "Confirmados, en preparación o en transporte. Un confirmado no pasa a preparación hasta anotarlo. El total guardado no cambia.",
      empty: "No hay pedidos de esa etapa sin número.",
      rows: orders.filter(awaitsDropiNumber),
      warning: (order: StoreOrder) =>
        order.status === "confirmado" ? "Sin número no pasa a preparación." : "Falta el número de Dropi.",
      cta: "Anotar número",
    },
    {
      id: "sync-incidencia",
      title: "Incidencia sin número",
      hint: "Anotar el número no resuelve la incidencia. El total guardado no cambia.",
      empty: "No hay incidencias sin ese número.",
      rows: orders.filter(needsIncidenceDropiNumber),
      warning: () => "Falta el número.",
      cta: "Anotar número",
    },
    {
      id: "sync-cerrado",
      title: "Entregado o devuelto sin número",
      hint: "Ya salieron. Anotar el número no crea otro pedido. El total guardado no cambia.",
      empty: "No hay entregados ni devueltos sin ese número.",
      rows: orders.filter((order) => needsClosedDropiNumber(order) && !awaitsDropiNumber(order)),
      warning: () => "Falta el número.",
      cta: "Anotar número",
    },
  ];

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Dropi, a mano</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Sincronización</h1>
      <p className="mt-0.5 text-sm text-muted">
        Copia la entrega y anota el número. Dropi no está conectado: no se envía desde aquí y el total guardado no cambia.
      </p>

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_13.5rem]">
        <div className="order-2 min-w-0 xl:order-1">
      {groups.map((group) => {
        const visible = group.rows.filter((order) => matchesSync(order, query));
        return (
          <section key={group.id} className="mt-3 first:mt-0" aria-labelledby={group.id}>
            <h2 id={group.id} className="text-sm font-semibold">
              {group.title} ({group.rows.length})
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-muted">{group.hint}</p>
            {visible.length === 0 ? (
              <p className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2 text-sm text-muted">
                {query && group.rows.length > 0 ? "Ningún pedido de esta lista coincide con la búsqueda." : group.empty}
              </p>
            ) : (
              <div className="elevate-1 mt-3 overflow-hidden rounded-[14px] border border-line bg-card">
                <SyncHead />
                <ul className="divide-y divide-line">
                  {visible.map((order) => (
                    <SyncRow key={order.id} order={order} note={group.warning(order)} cta={group.cta} />
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}

      <section className="mt-5" aria-labelledby="sync-anotados">
        <h2 id="sync-anotados" className="text-sm font-semibold">
          Número ya anotado ({noted.length})
        </h2>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          Ábrelos para copiar datos o corregirlo. El total guardado no cambia.
        </p>
        {noted.filter((order) => matchesSync(order, query)).length === 0 ? (
          <p className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2 text-sm text-muted">
            {query && noted.length > 0 ? "Ningún pedido de esta lista coincide con la búsqueda." : "Todavía no hay un número anotado."}
          </p>
        ) : (
          <div className="elevate-1 mt-3 overflow-hidden rounded-[14px] border border-line bg-card">
            <SyncHead />
            <ul className="divide-y divide-line">
              {noted
                .filter((order) => matchesSync(order, query))
                .map((order) => (
                  <SyncRow key={order.id} order={order} number={order.providerRef ?? ""} cta="Ver" />
                ))}
            </ul>
          </div>
        )}
      </section>
        </div>

        <aside className="elevate-1 order-1 rounded-[14px] border border-line bg-card px-3 py-2 xl:sticky xl:top-[3.75rem] xl:order-2">
          <h2 className="text-sm font-semibold">Cómo se usa</h2>
          <ul className="mt-2 space-y-2 text-xs leading-5">
            <li>
              <span className="font-semibold text-sm">Falta número</span>
              <span className="mt-0.5 block text-muted">
                Confirmados en adelante. Los pendientes se confirman en Pedidos.
              </span>
            </li>
            <li>
              <span className="font-semibold text-sm">Qué haces aquí</span>
              <span className="mt-0.5 block text-muted">Copiar entrega y anotar el número a mano. El total guardado no cambia.</span>
            </li>
          </ul>
          <p className="mt-3 text-xs leading-5 text-muted">
            Dropi no está conectado. Estado de la cuenta en{" "}
            <Link href="/panel/conexiones" className="font-semibold text-accent-strong">
              Conexiones
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}

function SyncHead() {
  return (
    <div className={cx("hidden items-end gap-4 border-b border-line bg-canvas px-3 py-2 text-[11px] font-semibold tracking-[0.04em] text-muted uppercase md:grid", syncGrid)}>
      <span>Pedido</span>
      <span>Cliente</span>
      <span>Estado</span>
      <span>Número</span>
      <span>Acción</span>
    </div>
  );
}

function SyncRow({ order, note, number, cta = "Anotar número" }: { order: StoreOrder; note?: string; number?: string; cta?: string }) {
  const written = number?.trim() ?? "";
  return (
    <li>
      <Link href={syncFocusHref(order.number)} className={cx("grid items-start gap-3 px-3 py-2 text-sm hover:bg-canvas md:gap-4", syncGrid)}>
        <span>
          <span className="text-sm font-bold">{order.number}</span>
          <span className="mt-0.5 block text-xs text-muted">{formatDay(order.createdAt.slice(0, 10))}</span>
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">{order.customerName}</span>
          <span className="mt-0.5 block text-xs text-muted">
            {order.city}
            {order.department ? ` · ${order.department}` : ""}
          </span>
          {note ? <span className="mt-1.5 block text-xs font-semibold leading-5 text-warning">{note}</span> : null}
        </span>
        <span className="md:pt-0.5">
          <span className="mb-1 block text-[10px] font-bold tracking-[0.06em] text-muted uppercase md:hidden">Estado</span>
          <StatusPill status={order.status} />
        </span>
        <span className="md:pt-0.5">
          <span className="mb-1 block text-[10px] font-bold tracking-[0.06em] text-muted uppercase md:hidden">Número</span>
          {written ? <span className="font-semibold">{written}</span> : <span className="font-semibold text-warning">Sin anotar</span>}
        </span>
        <span className="font-semibold text-primary md:pt-0.5">{cta}</span>
      </Link>
    </li>
  );
}

function matchesSync(order: StoreOrder, query: string) {
  if (!query) return true;
  return [order.number, order.customerName, order.city, order.providerRef ?? "", "dropi", ...order.lines.flatMap((line) => [line.title, line.sku])].some(
    (value) => value.toLocaleLowerCase("es").includes(query),
  );
}
