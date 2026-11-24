"use client";

import { useActionState, useState } from "react";
import { PRODUCT_QUESTION_HANDOFF_REPLY } from "@/lib/product-answers";
import { resolvePendingApprovalAction, type ResolveApprovalState } from "@/server/approval-actions";

const initial: ResolveApprovalState = { error: null, message: null };

export type QuestionReviewPreview = {
  question: string;
  autoReply: string;
  sku: string;
};

function suggestedDraft(autoReply: string) {
  const trimmed = autoReply.trim();
  if (!trimmed || trimmed === PRODUCT_QUESTION_HANDOFF_REPLY) return "";
  return trimmed.slice(0, 400);
}

export function QuestionReviewForm({
  id,
  preview,
  canApproveCatalog,
}: {
  id: string;
  preview: QuestionReviewPreview;
  canApproveCatalog: boolean;
}) {
  const [state, action, pending] = useActionState(resolvePendingApprovalAction, initial);
  const draft = suggestedDraft(preview.autoReply);
  const [answer, setAnswer] = useState(draft);

  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="kind" value="pregunta" />
      <input type="hidden" name="id" value={id} />
      <div className="rounded-[10px] border border-line bg-canvas px-3 py-2 text-xs leading-5">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Pregunta</p>
        <p className="mt-0.5 text-ink">{preview.question}</p>
        {draft ? (
          <>
            <p className="mt-2 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Borrador sugerido</p>
            <p className="mt-0.5 text-muted">Revísalo antes de anotar. El precio y la publicación no cambian.</p>
          </>
        ) : preview.autoReply ? (
          <>
            <p className="mt-2 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Auto</p>
            <p className="mt-0.5 text-muted">{preview.autoReply}</p>
          </>
        ) : null}
      </div>
      <label className="block text-xs font-semibold" htmlFor={`pregunta-respuesta-${id}`}>
        Respuesta para anotar en la ficha
        <textarea
          id={`pregunta-respuesta-${id}`}
          name="answer"
          rows={3}
          maxLength={400}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          title="Anotarla escribe en Respuestas. El precio y la publicación no cambian."
          className="mt-1.5 w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
        />
      </label>
      {!canApproveCatalog ? (
        <p role="status" className="text-sm font-medium text-coral">
          Solo el propietario puede anotar en la ficha. Puedes descartar la pregunta.
        </p>
      ) : null}
      <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
        <button
          type="submit"
          name="decision"
          value="approve"
          title="Anotarla escribe en Respuestas. El precio y la publicación no cambian. No cobra."
          disabled={pending || !canApproveCatalog || answer.trim().length < 4}
          className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
        >
          {pending ? "…" : "Anotar en ficha"}
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          title="Descartarla no escribe en la ficha ni cobra."
          disabled={pending}
          className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle disabled:opacity-55"
        >
          {pending ? "…" : "Descartar"}
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
