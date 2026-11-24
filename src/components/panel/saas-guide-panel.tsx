"use client";

import { useState } from "react";
import type { SaasGuide } from "@/server/agent-saas-guide";
import { generateSaasGuideAction } from "@/server/agent-panel-actions";

export function SaasGuidePanel({
  guide = null,
  preserveQuery = "",
  preserveCategory = "",
  preserveContentSku = "",
  preserveCampaignSku = "",
  enabled = true,
  canTurnOn = false,
}: {
  guide?: SaasGuide | null;
  preserveQuery?: string;
  preserveCategory?: string;
  preserveContentSku?: string;
  preserveCampaignSku?: string;
  enabled?: boolean;
  canTurnOn?: boolean;
}) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  async function copySupport() {
    if (!guide?.supportNote) return;
    try {
      await navigator.clipboard.writeText(guide.supportNote);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }

  return (
    <section className="mt-6" aria-labelledby="saas">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">SaaS</p>
      <h2 id="saas" className="mt-0.5 scroll-mt-24 text-base font-bold">
        Asistente SaaS
      </h2>
      <p className="mt-1 text-sm text-muted">
        AG-10: guía de alta según el estado local (OpenAI o plantilla). No crea tickets reales ni cambia la
        tienda.
      </p>
      {!enabled ? (
        <p role="status" className="mt-2 text-sm font-medium text-coral">
          {canTurnOn
            ? "AG-10 está apagado. Actívalo en Presupuesto y activación."
            : "AG-10 está apagado. Lo enciende el propietario en Presupuesto y activación."}
        </p>
      ) : null}

      <form action={generateSaasGuideAction} className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</p>
        {preserveQuery ? <input type="hidden" name="q" value={preserveQuery} /> : null}
        {preserveCategory ? <input type="hidden" name="categoria" value={preserveCategory} /> : null}
        {preserveContentSku ? <input type="hidden" name="sku" value={preserveContentSku} /> : null}
        {preserveCampaignSku ? <input type="hidden" name="campanaSku" value={preserveCampaignSku} /> : null}
        <nav aria-label="Consulta" className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            title="Generarla no cambia pedidos."
            disabled={!enabled}
            className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
          >
            Generar guía
          </button>
        </nav>
      </form>

      {guide ? (
        <div className="elevate-1 mt-3 space-y-2 rounded-[14px] border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
            Fuente: {guide.via === "openai" ? "OpenAI" : "plantilla"}
            {guide.costEstimateCop > 0 ? ` · costo est. ${guide.costEstimateCop} COP` : ""}
            {" · "}
            {guide.scoreLabel}
          </p>
          <p className="text-sm text-muted">
            {guide.progress.tenantLabel} · {guide.progress.planLabel}
          </p>
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Límites del plan</p>
            <ul className="mt-1 space-y-1 text-sm text-muted">
              {guide.progress.planLimits.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Pasos</p>
            <ul className="mt-1 space-y-1.5 text-sm text-muted">
              {guide.steps.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Siguiente foco</p>
            <p className="mt-1 text-sm font-semibold text-ink">{guide.nextFocus}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Nota de soporte (borrador)</p>
            <p className="mt-1 text-sm leading-5 text-ink whitespace-pre-wrap">{guide.supportNote}</p>
          </div>
          <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
            <button
              type="button"
              title="Copiarla no abre un ticket ni cobra."
              onClick={copySupport}
              className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
            >
              {copied === "ok" ? "Nota copiada" : "Copiar nota"}
            </button>
          </nav>
          {copied === "ok" ? (
            <p role="status" className="text-xs text-accent-strong">
              Listo para pegarla. Desde aquí no se abre ticket.
            </p>
          ) : null}
          {copied === "fail" ? (
            <p role="alert" className="text-xs text-danger">
              No se pudo copiar.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
          <p className="mt-0.5 text-sm text-muted">Genera la guía para ver pasos según tu tienda.</p>
        </div>
      )}
    </section>
  );
}
