"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  attentionQueueOrderHref,
  attentionQueues,
  attentionRowCopyText,
  attentionSheetText,
  type CostGuide,
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

export function AttentionSheet({
  orders,
  guides,
  priceGuides = [],
  costGuides = [],
  canManageOrderMoney,
}: {
  orders: StoreOrder[];
  guides: SizeGuide[];
  priceGuides?: PriceGuide[];
  costGuides?: CostGuide[];
  canManageOrderMoney: boolean;
}) {
  const queues = useMemo(
    () => attentionQueues(orders, guides, canManageOrderMoney, costGuides),
    [orders, guides, canManageOrderMoney, costGuides],
  );
  const fullText = useMemo(
    () => attentionSheetText(orders, guides, canManageOrderMoney, priceGuides, costGuides),
    [orders, guides, canManageOrderMoney, priceGuides, costGuides],
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function copy(id: string, text: string) {
    const ok = await copyText(text);
    setCopiedId(ok ? id : null);
    setFailedId(ok ? null : id);
  }

  const totalRows = queues.reduce((sum, queue) => sum + queue.rows.length, 0);

  return (
    <section className="mt-3" aria-labelledby="hoja-atender-titulo">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Copia</p>
      <h3 id="hoja-atender-titulo" className="mt-0.5 text-sm font-semibold">
        Por atender · copiar a mano
      </h3>
      <p className="mt-0.5 text-xs leading-5 text-muted">
        Esto no es la lista de trabajo (esa está arriba). Aquí solo preparas texto para pegar en WhatsApp o Dropi.
        Copia <span className="font-semibold text-ink">un pedido</span> o, si lo necesitas, toda la cola.
        No envía mensajes ni crea el pedido en Dropi.
      </p>

      {totalRows === 0 ? (
        <div className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
          <p className="mt-0.5 text-sm text-muted">No hay pedidos esperando un dato o una herramienta.</p>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          {queues.map((queue) => (
            <div key={queue.id} className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Paso</p>
              <p className="mt-0.5 text-sm font-semibold">
                {queue.title} ({queue.rows.length})
              </p>
              <ul className="mt-2 space-y-2">
                {queue.rows.map((row) => {
                  const id = `${queue.id}:${row.order.id}`;
                  const text = attentionRowCopyText(
                    queue.title,
                    row,
                    canManageOrderMoney,
                    priceGuides,
                    costGuides,
                  );
                  return (
                    <li
                      key={id}
                      className="rounded-[12px] border border-line bg-canvas px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{row.order.number}</p>
                          <p className="mt-0.5 text-sm font-semibold">{row.order.customerName}</p>
                          <p className="mt-0.5 text-xs text-muted">
                            {[row.order.city, row.order.department].filter(Boolean).join(" · ")}
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-warning">{row.note}</p>
                          <p className="mt-1 text-xs font-semibold text-primary">Siguiente: {row.cta}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Link
                            href={attentionQueueOrderHref(queue.id, row.order.number)}
                            className="inline-flex h-9 items-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold hover:bg-subtle"
                          >
                            Abrir
                          </Link>
                          <button
                            type="button"
                            title="Copia solo este pedido. No envía ni crea Dropi."
                            className="inline-flex h-9 items-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark"
                            onClick={() => void copy(id, text)}
                          >
                            {copiedId === id ? "Copiado" : "Copiar este"}
                          </button>
                        </div>
                      </div>
                      {failedId === id ? (
                        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
                          No se pudo copiar. Intenta de nuevo.
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="elevate-1 rounded-[14px] border border-dashed border-line bg-card px-3 py-2.5">
            <p className="text-sm font-semibold">¿Necesitas pegar toda la cola de una vez?</p>
            <p className="mt-0.5 text-xs leading-5 text-muted">
              Solo si vas a pegar el listado completo en otro lado. Con muchos pedidos conviene copiar uno por uno.
            </p>
            <nav aria-label="Cola completa" className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold hover:bg-subtle"
                onClick={() => void copy("all", fullText)}
              >
                {copiedId === "all" ? "Cola completa copiada" : "Copiar cola completa"}
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
                readOnly
                rows={8}
                value={fullText}
                title="Leerlo no envía el mensaje ni cambia el total guardado."
                className="mt-2 min-h-32 w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm leading-5 text-ink focus:border-accent focus:outline-none"
              />
            ) : null}
            {failedId === "all" ? (
              <p role="alert" className="mt-2 text-sm font-semibold text-danger">
                No se pudo copiar. Intenta de nuevo.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
