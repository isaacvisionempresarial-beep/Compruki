"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { QuestionReviewForm } from "@/components/panel/question-review-form";
import type { PendingApproval } from "@/server/agent-central";
import { resolvePendingApprovalAction, type ResolveApprovalState } from "@/server/approval-actions";

const initial: ResolveApprovalState = { error: null, message: null };

export function PendingApprovalsPanel({
  items,
  canApproveCatalog = false,
  productQuestionsReady = true,
  followupsReady = true,
}: {
  items: PendingApproval[];
  canApproveCatalog?: boolean;
  productQuestionsReady?: boolean;
  followupsReady?: boolean;
}) {
  return (
    <section className="mt-4" aria-labelledby="pendientes-humanos">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Bandeja</p>
      <h2 id="pendientes-humanos" className="mt-0.5 scroll-mt-24 text-base font-bold">
        Pendientes humanos
      </h2>
      <p className="mt-1 text-sm text-muted">
        Bandeja de AG-01. Solo el propietario aprueba un borrador o anota una respuesta de ficha en
        el catálogo. Un operador puede rechazar. Pedidos (preparar, despachar, entregar, cobrar,
        incidencias) se atienden en Pedidos; seguimientos CRM en Clientes.
      </p>

      {!productQuestionsReady ? (
        <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3" role="status">
          <p className="text-[10px] font-bold tracking-[0.08em] text-coral uppercase">Falta</p>
          <p className="mt-0.5 text-sm font-medium text-coral">
            Falta la tabla product_questions. Ejecuta supabase/migrations/012_product_questions.sql. Sin ella el
            handoff de la ficha falla y aquí no aparecen preguntas.
          </p>
          <nav aria-label="Vista" className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
            <Link
              href="/panel/ajustes"
              className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
            >
              Ver Configuración
            </Link>
          </nav>
        </div>
      ) : null}

      {!followupsReady ? (
        <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3" role="status">
          <p className="text-[10px] font-bold tracking-[0.08em] text-coral uppercase">Falta</p>
          <p className="mt-0.5 text-sm font-medium text-coral">
            Falta followup_tasks. Ejecuta supabase/migrations/013_followup_tasks.sql. Sin ella no entran
            seguimientos CRM a esta bandeja.
          </p>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
          <p className="mt-0.5 text-sm text-muted">
            {productQuestionsReady
              ? "No hay pendientes humanos ahora. Pedidos en cola, borradores, preguntas de ficha y seguimientos CRM entran aquí."
              : "Sin product_questions no se listan preguntas. Los pedidos, borradores y seguimientos sí pueden aparecer."}
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="elevate-1 rounded-[14px] border border-line bg-card px-4 py-2.5 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="rounded-[8px] border border-line px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
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
              ) : item.kind === "pregunta" && item.questionPreview ? (
                <QuestionReviewForm
                  id={item.id}
                  preview={item.questionPreview}
                  canApproveCatalog={canApproveCatalog}
                />
              ) : item.kind === "seguimiento" ? (
                <nav aria-label="Vista" className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
                  <Link
                    href="/panel/clientes"
                    className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
                  >
                    Abrir Clientes
                  </Link>
                </nav>
              ) : item.actionable ? (
                <ApprovalButtons kind={item.kind} id={item.id} canApproveCatalog={canApproveCatalog} />
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
  const ctaLine = resolvedCta ? `Invitación: ${resolvedCta}` : "";
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
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Comparación</p>
            <p className="mt-0.5 text-sm font-semibold">
              Antes / después → {preview.applyTarget || "catálogo"}
            </p>
          </div>
          <nav aria-label="Vista" className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex h-9 items-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle"
            >
              {open ? "Ocultar" : "Ver comparación"}
            </button>
          </nav>
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
                    <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{diff.field} · ahora</p>
                    <p className="mt-1 whitespace-pre-wrap text-muted">{clip(diff.before)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
                      {diff.field} · {canApproveCatalog ? "si apruebas" : "si el propietario aprueba"}
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
              {canApproveCatalog
                ? "«Si apruebas» sigue el texto de este formulario. Un título vacío conserva el del catálogo."
                : "El texto queda como está. Solo el propietario lo aprueba y lo escribe. Un título vacío conserva el del catálogo."}
            </p>
          </div>
        ) : null}
      </div>
      <input type="hidden" name="kind" value="borrador" />
      <input type="hidden" name="id" value={id} />
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Edición</p>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Título a escribir</span>
        <input
          name="title"
          title="Escribirlo no publica ni cobra. El precio y la publicación no cambian."
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          readOnly={!canApproveCatalog}
          className={`h-10 w-full rounded-[10px] border border-line px-3 text-sm focus:border-accent focus:outline-none ${canApproveCatalog ? "bg-card" : "bg-subtle"}`}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Cuerpo a escribir</span>
        <textarea
          name="body"
          title="Escribirlo no publica ni cobra. El precio y la publicación no cambian."
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={4000}
          rows={5}
          readOnly={!canApproveCatalog}
          className={`w-full rounded-[10px] border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none ${canApproveCatalog ? "bg-card" : "bg-subtle"}`}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Invitación</span>
        <input
          name="cta"
          title="Escribirlo no publica ni cobra. El precio y la publicación no cambian."
          value={cta}
          onChange={(event) => setCta(event.target.value)}
          maxLength={120}
          readOnly={!canApproveCatalog}
          className={`h-10 w-full rounded-[10px] border border-line px-3 text-sm focus:border-accent focus:outline-none ${canApproveCatalog ? "bg-card" : "bg-subtle"}`}
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
      <p className="text-xs leading-5 text-muted">
        {canApproveCatalog
          ? "Escribe el texto de la ficha. El precio y la publicación no cambian."
          : "Si el propietario lo aprueba, escribe ese texto. El precio y la publicación no cambian."}
      </p>
      <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
        <button
          type="submit"
          name="decision"
          value="approve"
          title="Aprobarlo escribe el texto. El precio y la publicación no cambian."
          disabled={pending || approveDisabled || !canApproveCatalog}
          className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
        >
          {pending ? "…" : "Aprobar texto"}
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          title="Rechazarlo no escribe en el catálogo ni cobra."
          disabled={pending}
          className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle disabled:opacity-55"
        >
          {pending ? "…" : "Rechazar"}
        </button>
      </nav>
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
  canApproveCatalog = false,
}: {
  kind: PendingApproval["kind"];
  id: string;
  approveDisabled?: boolean;
  canApproveCatalog?: boolean;
}) {
  const [state, action, pending] = useActionState(resolvePendingApprovalAction, initial);
  const approveBlocked = approveDisabled || !canApproveCatalog;

  return (
    <div className="mt-2">
      {approveDisabled ? (
        <p role="status" className="mb-2 text-sm font-medium text-coral">
          No se puede aprobar: el SKU no está en el catálogo local. Puedes rechazar el borrador.
        </p>
      ) : null}
      {!canApproveCatalog ? (
        <p role="status" className="mb-2 text-sm font-medium text-coral">
          Solo el propietario puede aprobar esta corrida. Puedes rechazarla.
        </p>
      ) : null}
      <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
        <form action={action} className="contents">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="approve" />
          <button
            type="submit"
           
            disabled={pending || approveBlocked}
            className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
          >
            {pending ? "…" : "Aprobar"}
          </button>
        </form>
        <form action={action} className="contents">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="reject" />
          <button
            type="submit"
           
            disabled={pending}
            className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle disabled:opacity-55"
          >
            {pending ? "…" : "Rechazar"}
          </button>
        </form>
      </nav>
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
