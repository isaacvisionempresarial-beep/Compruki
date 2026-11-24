"use client";

import { useState } from "react";
import type { OrderPreparePack } from "@/server/agent-order-prepare";
import { runOrderPrepareAction } from "@/server/order-agent-actions";

export function OrderPreparePanel({
  orderNumber,
  pack = null,
  policyError = null,
  enabled = true,
}: {
  orderNumber: string;
  pack?: OrderPreparePack | null;
  policyError?: string | null;
  enabled?: boolean;
}) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  async function copyHandoff() {
    if (!pack?.handoffText) return;
    try {
      await navigator.clipboard.writeText(pack.handoffText);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }

  return (
    <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="pedido-preparar">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Preparación</p>
      <h2 id="pedido-preparar" className="mt-0.5 scroll-mt-24 text-sm font-semibold">
        AG-06 · preparar envío
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Checklist y texto para sync a mano (OpenAI o plantilla). No cambia el estado ni crea el pedido en el
        proveedor.
      </p>
      {!enabled ? (
        <p role="status" className="mt-2 text-sm font-medium text-coral">
          AG-06 está apagado. Actívalo en Presupuesto y activación (Centro de agentes).
        </p>
      ) : null}
      {policyError ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {policyError}
        </p>
      ) : null}

      <form action={runOrderPrepareAction} className="mt-2">
        <input type="hidden" name="orderNumber" value={orderNumber} />
        <nav aria-label="Consulta" className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</span>
          <button
            type="submit"
            title="Prepararlo no cambia el estado ni envía."
            disabled={!enabled}
            className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
          >
            Preparar paquete
          </button>
        </nav>
      </form>

      {pack ? (
        <div className="mt-2 space-y-2 rounded-[10px] border border-line bg-canvas px-3 py-2">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
            Fuente: {pack.via === "openai" ? "OpenAI" : "plantilla"}
            {pack.costEstimateCop > 0 ? ` · costo est. ${pack.costEstimateCop} COP` : ""}
            {" · "}
            {pack.ready ? "sin bloqueos locales" : "con bloqueos"}
          </p>
          {pack.blockers.length > 0 ? (
            <div>
              <p className="text-[10px] font-bold tracking-[0.08em] text-warning uppercase">Bloqueos</p>
              <ul className="mt-1 space-y-1 text-sm text-warning">
                {pack.blockers.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Checklist</p>
            <ul className="mt-1 space-y-1.5 text-sm text-muted">
              {pack.checklist.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Texto para sync</p>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-[8px] border border-line bg-card px-2 py-1.5 text-xs leading-5 text-ink">
              {pack.handoffText}
            </pre>
          </div>
          <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
            <button
              type="button"
              title="Copiarlo no crea el pedido en el proveedor."
              onClick={copyHandoff}
              className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle"
            >
              {copied === "ok" ? "Texto copiado" : "Copiar texto"}
            </button>
          </nav>
          {copied === "ok" ? (
            <p role="status" className="text-xs text-accent-strong">
              Listo para pegarlo a mano. Desde aquí no se crea el pedido afuera.
            </p>
          ) : null}
          {copied === "fail" ? (
            <p role="alert" className="text-xs text-danger">
              No se pudo copiar.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
