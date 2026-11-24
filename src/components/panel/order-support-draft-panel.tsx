"use client";

import { useState } from "react";
import type { SupportResolutionDraft } from "@/server/agent-support-draft";
import { runSupportDraftAction } from "@/server/order-agent-actions";

export function OrderSupportDraftPanel({
  orderNumber,
  draft = null,
  policyError = null,
  enabled = true,
}: {
  orderNumber: string;
  draft?: SupportResolutionDraft | null;
  policyError?: string | null;
  enabled?: boolean;
}) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  async function copyNote() {
    if (!draft?.customerNote) return;
    try {
      await navigator.clipboard.writeText(draft.customerNote);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }

  return (
    <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="pedido-posventa">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Posventa</p>
      <h2 id="pedido-posventa" className="mt-0.5 scroll-mt-24 text-sm font-semibold">
        AG-09 · borrador de resolución
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Pasos internos y aviso al cliente (OpenAI o plantilla). No resuelve la incidencia ni envía solo.
      </p>
      {!enabled ? (
        <p role="status" className="mt-2 text-sm font-medium text-coral">
          AG-09 está apagado. Actívalo en Presupuesto y activación (Centro de agentes).
        </p>
      ) : null}
      {policyError ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {policyError}
        </p>
      ) : null}

      <form action={runSupportDraftAction} className="mt-2">
        <input type="hidden" name="orderNumber" value={orderNumber} />
        <nav aria-label="Consulta" className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</span>
          <button
            type="submit"
            title="Generarlo no resuelve."
            disabled={!enabled}
            className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
          >
            Generar resolución
          </button>
        </nav>
      </form>

      {draft ? (
        <div className="mt-2 space-y-2 rounded-[10px] border border-line bg-canvas px-3 py-2">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
            Fuente: {draft.via === "openai" ? "OpenAI" : "plantilla"}
            {draft.costEstimateCop > 0 ? ` · costo est. ${draft.costEstimateCop} COP` : ""}
          </p>
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Pasos internos</p>
            <ul className="mt-1 space-y-1.5 text-sm text-muted">
              {draft.bullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Aviso al cliente</p>
            <p className="mt-1 text-sm leading-5 text-ink whitespace-pre-wrap">{draft.customerNote}</p>
          </div>
          <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
            <button
              type="button"
              title="Copiarlo no envía el mensaje."
              onClick={copyNote}
              className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle"
            >
              {copied === "ok" ? "Aviso copiado" : "Copiar aviso"}
            </button>
          </nav>
          {copied === "ok" ? (
            <p role="status" className="text-xs text-accent-strong">
              Listo para pegarlo. Desde aquí no se envía ni se resuelve.
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
