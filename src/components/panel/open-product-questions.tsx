"use client";

import { QuestionReviewForm } from "@/components/panel/question-review-form";
import type { ProductQuestionRow } from "@/server/product-questions";

export function OpenProductQuestions({
  items,
  canApproveCatalog,
}: {
  items: ProductQuestionRow[];
  canApproveCatalog: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section className="elevate-1 mb-3 rounded-[14px] border border-line bg-card px-3 py-3" aria-labelledby="preguntas-abiertas-ficha" id="preguntas-abiertas">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Bandeja</p>
      <h2 id="preguntas-abiertas-ficha" className="mt-0.5 text-sm font-semibold">
        Preguntas abiertas ({items.length})
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Las envió un comprador desde la ficha porque la respuesta automática no alcanzó. Anotar escribe en Respuestas.
        El precio y la publicación no cambian. No cobra.
      </p>
      <ul className="mt-2 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-[10px] border border-line bg-canvas px-3 py-2">
            <QuestionReviewForm
              id={item.id}
              canApproveCatalog={canApproveCatalog}
              preview={{
                question: item.question,
                autoReply: item.autoReply,
                sku: item.productSku,
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
