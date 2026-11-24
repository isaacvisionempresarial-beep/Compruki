"use client";

import { useState } from "react";
import type { CustomerMessageDraft } from "@/server/agent-customer-draft";
import { runCustomerDraftAction } from "@/server/order-agent-actions";

export function OrderMessageDraftPanel({
  orderNumber,
  draft = null,
  policyError = null,
  enabled = true,
}: {
  orderNumber: string;
  draft?: CustomerMessageDraft | null;
  policyError?: string | null;
  enabled?: boolean;
}) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  async function copyText() {
    if (!draft?.text) return;
    try {
      await navigator.clipboard.writeText(draft.text);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }

  return (
    <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="pedido-mensaje">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Mensaje</p>
      <h2 id="pedido-mensaje" className="mt-0.5 scroll-mt-24 text-sm font-semibold">
        AG-07 · borrador para el cliente
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Arma un texto para copiar (OpenAI o plantilla). No envía WhatsApp ni cambia el pedido.
      </p>
      {!enabled ? (
        <p role="status" className="mt-2 text-sm font-medium text-coral">
          AG-07 está apagado. Actívalo en Presupuesto y activación (Centro de agentes).
        </p>
      ) : null}
      {policyError ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {policyError}
        </p>
      ) : null}

      <form action={runCustomerDraftAction} className="mt-2">
        <input type="hidden" name="orderNumber" value={orderNumber} />
        <nav aria-label="Consulta" className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</span>
          <button
            type="submit"
            title="Generarlo no envía el mensaje ni cobra."
            disabled={!enabled}
            className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
          >
            Generar borrador
          </button>
        </nav>
      </form>

      {draft ? (
        <div className="mt-2 rounded-[10px] border border-line bg-canvas px-3 py-2">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
            Fuente: {draft.via === "openai" ? "OpenAI" : "plantilla"}
            {draft.costEstimateCop > 0 ? ` · costo est. ${draft.costEstimateCop} COP` : ""}
          </p>
          <p className="mt-1.5 text-sm leading-5 text-ink whitespace-pre-wrap">{draft.text}</p>
          <nav aria-label="Herramientas" className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
            <button
              type="button"
              title="Copiarlo no envía el mensaje ni cobra."
              onClick={copyText}
              className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle"
            >
              {copied === "ok" ? "Copiado" : "Copiar borrador"}
            </button>
          </nav>
          {copied === "ok" ? (
            <p role="status" className="mt-1 text-xs text-accent-strong">
              Listo para pegarlo. Desde aquí no se envía.
            </p>
          ) : null}
          {copied === "fail" ? (
            <p role="alert" className="mt-1 text-xs text-danger">
              No se pudo copiar. No cobra.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
