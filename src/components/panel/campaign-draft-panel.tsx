"use client";

import { useState } from "react";
import type { CampaignDraft } from "@/server/agent-campaign-draft";
import { generateCampaignDraftAction } from "@/server/agent-panel-actions";

export function CampaignDraftPanel({
  products,
  selectedSku,
  draft = null,
  preserveQuery = "",
  preserveCategory = "",
  preserveContentSku = "",
  enabled = true,
  canTurnOn = false,
}: {
  products: Array<{ sku: string; title: string }>;
  selectedSku: string;
  draft?: CampaignDraft | null;
  preserveQuery?: string;
  preserveCategory?: string;
  preserveContentSku?: string;
  enabled?: boolean;
  canTurnOn?: boolean;
}) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  async function copyPack() {
    if (!draft) return;
    const text = [
      draft.headline,
      draft.primaryText,
      `CTA: ${draft.cta}`,
      "",
      `Hipótesis: ${draft.hypothesis}`,
      `Audiencia (pista): ${draft.audienceHint}`,
      draft.budgetNote,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }

  return (
    <section className="mt-6" aria-labelledby="publicidad">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Publicidad</p>
      <h2 id="publicidad" className="mt-0.5 scroll-mt-24 text-base font-bold">
        Especialista en publicidad
      </h2>
      <p className="mt-1 text-sm text-muted">
        AG-08: hipótesis y copy de prueba (OpenAI o plantilla) con hechos del catálogo. Generar no compra
        anuncios, no publica ni reserva presupuesto.
      </p>
      {!enabled ? (
        <p role="status" className="mt-2 text-sm font-medium text-coral">
          {canTurnOn
            ? "AG-08 está apagado. Actívalo en Presupuesto y activación."
            : "AG-08 está apagado. Lo enciende el propietario en Presupuesto y activación."}
        </p>
      ) : null}

      <form
        action={generateCampaignDraftAction}
        className="elevate-1 mt-3 grid gap-2 rounded-[14px] border border-line bg-card px-4 py-3 sm:grid-cols-[1fr_auto]"
      >
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase sm:col-span-2">Generar</p>
        {preserveQuery ? <input type="hidden" name="q" value={preserveQuery} /> : null}
        {preserveCategory ? <input type="hidden" name="categoria" value={preserveCategory} /> : null}
        {preserveContentSku ? <input type="hidden" name="sku" value={preserveContentSku} /> : null}
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Producto</span>
          <select
            name="campanaSku"
            title="Elegirlo no genera ni compra anuncios. No cobra."
            defaultValue={selectedSku}
            disabled={!enabled}
            className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm focus:border-accent focus:outline-none disabled:opacity-55"
          >
            <option value="">Elige un SKU</option>
            {products.map((product) => (
              <option key={product.sku} value={product.sku}>
                {product.title} · {product.sku}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Consulta" className="flex flex-wrap items-end gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</span>
          <button
            type="submit"
            title="Generar no compra anuncios ni cobra en la tienda."
            disabled={!enabled}
            className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
          >
            Generar campaña
          </button>
        </nav>
      </form>

      {draft ? (
        <div className="elevate-1 mt-3 space-y-2 rounded-[14px] border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
            Fuente: {draft.via === "openai" ? "OpenAI" : "plantilla"}
            {draft.costEstimateCop > 0 ? ` · costo est. ${draft.costEstimateCop} COP` : ""}
            {" · "}
            {draft.sku}
          </p>
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Hipótesis</p>
            <p className="mt-1 text-sm leading-5 text-muted">{draft.hypothesis}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Titular</p>
            <p className="mt-1 text-sm font-semibold text-ink">{draft.headline}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Texto</p>
            <p className="mt-1 text-sm leading-5 text-ink whitespace-pre-wrap">{draft.primaryText}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Audiencia (pista)</p>
            <p className="mt-1 text-sm leading-5 text-muted">{draft.audienceHint}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Presupuesto (nota)</p>
            <p className="mt-1 text-sm leading-5 text-muted">{draft.budgetNote}</p>
          </div>
          <p className="text-sm text-muted">
            CTA: <span className="font-semibold text-ink">{draft.cta}</span>
          </p>
          <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
            <button
              type="button"
              title="Copiarlo no publica ni compra anuncios."
              onClick={copyPack}
              className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
            >
              {copied === "ok" ? "Copiado" : "Copiar borrador"}
            </button>
          </nav>
          {copied === "ok" ? (
            <p role="status" className="text-xs text-accent-strong">
              Listo para pegarlo. Desde aquí no se publica ni se gasta.
            </p>
          ) : null}
          {copied === "fail" ? (
            <p role="alert" className="text-xs text-danger">
              No se pudo copiar. No cobra.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
          <p className="mt-0.5 text-sm text-muted">
            {selectedSku
              ? "No hay borrador en memoria para ese SKU. Genera uno otra vez."
              : "Elige un producto y genera el borrador de prueba."}
          </p>
        </div>
      )}
    </section>
  );
}
