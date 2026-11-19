"use client";

import { useActionState } from "react";
import type { ContentDraft, ProductFacts, SavedContentDraft } from "@/server/agent-content";
import { generateContentDraftsAction } from "@/server/agent-panel-actions";
import { saveContentDraftAction, type SaveDraftState } from "@/server/content-actions";

const initial: SaveDraftState = { error: null, message: null };

export function ContentCreatorPanel({
  products,
  selectedSku,
  facts,
  drafts,
  saved,
  preserveQuery = "",
  preserveCategory = "",
  enabled = true,
  canTurnOn = false,
}: {
  products: Array<{ sku: string; title: string }>;
  selectedSku: string;
  facts: ProductFacts | null;
  drafts: ContentDraft[];
  saved: SavedContentDraft[];
  preserveQuery?: string;
  preserveCategory?: string;
  enabled?: boolean;
  canTurnOn?: boolean;
}) {
  return (
    <section className="mt-6" aria-labelledby="creador">
      <h2 id="creador" className="text-base font-bold">
        Creador de contenido (plantillas)
      </h2>
      <p className="mt-1 text-sm text-muted">
        AG-03 sin OpenAI: arma borradores con hechos del catálogo. Generar o guardar deja corrida en el
        historial. Guardar no publica ni cambia el precio de la ficha.{" "}
        {canTurnOn
          ? "El borrador espera tu aprobación para escribirse en el catálogo."
          : "No escribe el catálogo. Lo aprueba el propietario."}
      </p>
      {!enabled ? (
        <p role="status" className="mt-2 text-sm font-medium text-coral">
          {canTurnOn
            ? "AG-03 está apagado. Actívalo en Presupuesto y activación."
            : "AG-03 está apagado. Lo enciende el propietario en Presupuesto y activación."}
        </p>
      ) : null}

      <form
        action={generateContentDraftsAction}
        className="elevate-1 mt-3 grid gap-2 rounded-[14px] border border-line bg-card px-4 py-3 sm:grid-cols-[1fr_auto]"
      >
        {preserveQuery ? <input type="hidden" name="q" value={preserveQuery} /> : null}
        {preserveCategory ? <input type="hidden" name="categoria" value={preserveCategory} /> : null}
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Producto</span>
          <select
            name="sku"
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
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={!enabled}
            className="inline-flex h-10 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
          >
            Generar borradores
          </button>
        </div>
      </form>

      {!selectedSku ? (
        <p className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3 text-sm text-muted">
          Elige un producto para ver hechos y borradores plantilla.
        </p>
      ) : !facts ? (
        <p role="alert" className="mt-3 rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
          No encontré ese SKU en el catálogo local.
        </p>
      ) : (
        <>
          <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
            <h3 className="text-sm font-semibold">Hechos verificables · {facts.sku}</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              <li>
                {facts.title}
                {facts.category ? ` · ${facts.category}` : ""} · Precio de la ficha {facts.priceLabel}. No es dinero
                cobrado.
              </li>
              <li>
                {facts.published ? "Publicado" : "Sin publicar"}
                {facts.available ? "" : " · No disponible"}
                {facts.variants.length > 0 ? ` · ${facts.variants.length} variantes` : ""}
              </li>
              {facts.brandNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <p className="mt-3 text-sm text-muted">
            Estas plantillas no están guardadas. Guardar no publica ni cambia el precio.
          </p>
          <ul className="mt-3 grid gap-3 lg:grid-cols-3">
            {drafts.map((draft) => (
              <li key={draft.channel}>
                <DraftCard sku={facts.sku} draft={draft} enabled={enabled} />
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-4">
        <h3 className="text-sm font-semibold">Borradores guardados</h3>
        {saved.length === 0 ? (
          <p className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-4 py-3 text-sm text-muted">
            Aún no hay borradores guardados. Si falla al guardar, ejecuta{" "}
            <span className="font-semibold">005_content_drafts.sql</span>.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {saved.map((item) => (
              <li key={item.id} className="rounded-[14px] border border-line bg-card px-4 py-2.5 text-sm">
                <p className="font-semibold">
                  {item.productSku} · {item.channel}
                  <span className="ml-2 text-xs font-medium text-muted">{item.source}</span>
                  <span className="ml-2 text-xs font-medium text-muted">
                    ·{" "}
                    {item.reviewStatus === "approved"
                      ? "aprobado"
                      : item.reviewStatus === "rejected"
                        ? "rechazado"
                        : "pendiente"}
                  </span>
                </p>
                <p className="mt-0.5 text-muted">{item.title}</p>
                {item.reviewStatus === "approved" ? (
                  <p className="mt-0.5 text-xs text-muted">
                    Escribió el texto en el catálogo. El precio y la publicación no cambiaron.
                  </p>
                ) : item.reviewStatus === "rejected" ? null : (
                  <p className="mt-0.5 text-xs text-muted">Guardado para revisión. No se publicó. El precio no cambia.</p>
                )}
                <p className="mt-0.5 text-xs text-muted">
                  Guardó {item.authorName || "el panel"} ·{" "}
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString("es-CO", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </time>
                </p>
                {item.reviewedAt ? (
                  <p className="mt-0.5 text-xs text-muted">
                    {item.reviewStatus === "rejected" ? "Rechazó" : "Aprobó"} {item.reviewedBy || "el panel"} ·{" "}
                    <time dateTime={item.reviewedAt}>
                      {new Date(item.reviewedAt).toLocaleString("es-CO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </time>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function DraftCard({ sku, draft, enabled }: { sku: string; draft: ContentDraft; enabled: boolean }) {
  const [state, action, pending] = useActionState(saveContentDraftAction, initial);

  return (
    <article className="elevate-1 flex h-full flex-col rounded-[14px] border border-line bg-card px-4 py-3">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{draft.channel}</p>
      <h4 className="mt-1 text-sm font-semibold">{draft.title}</h4>
      <p className="mt-2 flex-1 text-sm leading-5 text-muted whitespace-pre-wrap">{draft.body}</p>
      <p className="mt-2 text-sm font-semibold">CTA: {draft.cta}</p>

      <form action={action} className="mt-3">
        <input type="hidden" name="sku" value={sku} />
        <input type="hidden" name="channel" value={draft.channel} />
        <input type="hidden" name="title" value={draft.title} />
        <input type="hidden" name="body" value={draft.body} />
        <input type="hidden" name="cta" value={draft.cta} />
        <button
          type="submit"
          disabled={pending || !enabled}
          className="inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-line bg-card px-4 text-sm font-semibold text-ink hover:bg-subtle disabled:opacity-55"
        >
          {pending ? "Guardando…" : "Guardar borrador"}
        </button>
      </form>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="mt-2 text-sm font-medium text-accent-strong">
          {state.message}
        </p>
      ) : null}
    </article>
  );
}
