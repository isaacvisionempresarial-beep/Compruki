"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { PendingApproval } from "@/server/agent-central";
import { resolvePendingApprovalAction, type ResolveApprovalState } from "@/server/approval-actions";

const initial: ResolveApprovalState = { error: null, message: null };

export function PendingApprovalsPanel({
  items,
  canApproveCatalog = false,
}: {
  items: PendingApproval[];
  canApproveCatalog?: boolean;
}) {
  return (
    <section className="mt-4" aria-labelledby="pendientes-humanos">
      <h2 id="pendientes-humanos" className="text-base font-bold">
        Pendientes humanos
      </h2>
      <p className="mt-1 text-sm text-muted">
        Bandeja de AG-01 · list_pending_approvals. Solo el propietario aprueba un borrador y lo escribe en
        el catálogo. Un operador puede rechazarlo. Pedidos se atienden en Pedidos. OpenAI no está
        conectado.
      </p>

      {items.length === 0 ? (
        <p className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3 text-sm text-muted">
          No hay pendientes humanos ahora. Al guardar un borrador del Creador entra aquí para revisión.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="elevate-1 rounded-[14px] border border-line bg-card px-4 py-2.5 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="rounded-[8px] border border-line px-1.5 py-0.5 text-[10px] font-bold tracking-[0.06em] text-muted uppercase">
                  {item.kind}
                </span>
                {item.href ? (
                  <Link href={item.href} className="font-semibold text-accent-strong">
                    {item.label}
                  </Link>
                ) : (
                  <span className="font-semibold">{item.label}</span>
                )}
              </div>
              <p className="mt-0.5 text-muted">{item.detail}</p>
              {item.kind === "borrador" && item.preview ? (
                <DraftReviewForm
                  id={item.id}
                  preview={item.preview}
                  approveDisabled={Boolean(item.preview.catalogError)}
                  canApproveCatalog={canApproveCatalog}
                />
              ) : item.actionable ? (
                <ApprovalButtons kind={item.kind} id={item.id} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function liveDiffs(
  preview: NonNullable<PendingApproval["preview"]>,
  title: string,
  body: string,
  cta: string,
) {
  const resolvedTitle = title.trim().slice(0, 200) || preview.fallbackTitle;
  const resolvedBody = body.trim().slice(0, 4000);
  const resolvedCta = cta.trim().slice(0, 120);
  const ctaLine = resolvedCta ? `CTA: ${resolvedCta}` : "";
  const before = new Map(preview.diffs.map((diff) => [diff.field, diff.before]));

  const rows: Array<{ field: string; before: string; after: string }> = [];
  if (before.has("Título")) {
    rows.push(
      { field: "Título", before: before.get("Título") ?? "(vacío)", after: show(resolvedTitle) },
      {
        field: "Descripción",
        before: before.get("Descripción") ?? "(vacío)",
        after: show([resolvedBody, ctaLine].filter(Boolean).join("\n\n")),
      },
    );
  } else if (before.has("Destacados")) {
    rows.push({
      field: "Destacados",
      before: before.get("Destacados") ?? "(vacío)",
      after: show([resolvedTitle, resolvedBody, ctaLine].filter(Boolean).join("\n")),
    });
  } else if (before.has("Respuestas / WhatsApp")) {
    rows.push({
      field: "Respuestas / WhatsApp",
      before: before.get("Respuestas / WhatsApp") ?? "(vacío)",
      after: show([resolvedTitle, resolvedBody, ctaLine].filter(Boolean).join("\n\n")),
    });
  }
  return rows.map((row) => ({ ...row, changed: row.before !== row.after }));
}

function show(value: string) {
  return value.trim() || "(vacío)";
}

function clip(text: string, max = 280) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function DraftReviewForm({
  id,
  preview,
  approveDisabled,
  canApproveCatalog,
}: {
  id: string;
  preview: NonNullable<PendingApproval["preview"]>;
  approveDisabled: boolean;
  canApproveCatalog: boolean;
}) {
  const [state, action, pending] = useActionState(resolvePendingApprovalAction, initial);
  const [title, setTitle] = useState(preview.title === "(sin título)" ? "" : preview.title);
  const [body, setBody] = useState(preview.body === "(sin cuerpo)" ? "" : preview.body);
  const [cta, setCta] = useState(preview.cta);
  const [open, setOpen] = useState(true);
  const diffs = liveDiffs(preview, title, body, cta);

  return (
    <form action={action} className="mt-2 grid gap-2">
      <div className="rounded-[10px] border border-line bg-canvas px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold tracking-[0.06em] text-muted uppercase">
            Antes / después → {preview.applyTarget || "catálogo"}
          </p>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-xs font-semibold text-accent-strong"
          >
            {open ? "Ocultar" : "Ver comparación"}
          </button>
        </div>
        {open ? (
          <div className="mt-2 space-y-3">
            {preview.catalogError ? (
              <p role="alert" className="font-medium text-danger">
                {preview.catalogError}
              </p>
            ) : (
              diffs.map((diff) => (
                <div key={diff.field} className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.06em] text-muted uppercase">{diff.field} · ahora</p>
                    <p className="mt-1 whitespace-pre-wrap text-muted">{clip(diff.before)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.06em] text-muted uppercase">
                      {diff.field} · si apruebas
                      {diff.changed ? "" : " · igual"}
                    </p>
                    <p className={`mt-1 whitespace-pre-wrap ${diff.changed ? "font-medium text-ink" : "text-muted"}`}>
                      {clip(diff.after)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <p className="border-t border-line pt-2 text-xs text-muted">
              «Si apruebas» sigue el texto de este formulario. Un título vacío conserva el del catálogo.
            </p>
          </div>
        ) : null}
      </div>
      <input type="hidden" name="kind" value="borrador" />
      <input type="hidden" name="id" value={id} />
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Título a escribir</span>
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm focus:border-accent focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Cuerpo a escribir</span>
        <textarea
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={4000}
          rows={5}
          className="w-full rounded-[10px] border border-line bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">CTA</span>
        <input
          name="cta"
          value={cta}
          onChange={(event) => setCta(event.target.value)}
          maxLength={120}
          className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm focus:border-accent focus:outline-none"
        />
      </label>
      {approveDisabled ? (
        <p role="status" className="text-sm font-medium text-coral">
          No se puede aprobar: el SKU no está en el catálogo local. Puedes rechazar el borrador.
        </p>
      ) : null}
      {!canApproveCatalog ? (
        <p role="status" className="text-sm font-medium text-coral">
          Solo el propietario puede aprobar y escribir en el catálogo. Puedes rechazar el borrador.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending || approveDisabled || !canApproveCatalog}
          className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-xs font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
        >
          {pending ? "…" : "Aprobar y escribir"}
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-xs font-semibold text-ink hover:bg-subtle disabled:opacity-55"
        >
          {pending ? "…" : "Rechazar"}
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm font-medium text-accent-strong">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function ApprovalButtons({
  kind,
  id,
  approveDisabled = false,
}: {
  kind: PendingApproval["kind"];
  id: string;
  approveDisabled?: boolean;
}) {
  const [state, action, pending] = useActionState(resolvePendingApprovalAction, initial);

  return (
    <div className="mt-2">
      {approveDisabled ? (
        <p role="status" className="mb-2 text-sm font-medium text-coral">
          No se puede aprobar: el SKU no está en el catálogo local. Puedes rechazar el borrador.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="approve" />
          <button
            type="submit"
            disabled={pending || approveDisabled}
            className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-xs font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
          >
            {pending ? "…" : "Aprobar"}
          </button>
        </form>
        <form action={action}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="reject" />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-xs font-semibold text-ink hover:bg-subtle disabled:opacity-55"
          >
            {pending ? "…" : "Rechazar"}
          </button>
        </form>
      </div>
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
    </div>
  );
}
