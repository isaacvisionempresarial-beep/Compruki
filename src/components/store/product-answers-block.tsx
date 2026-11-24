import { formatAnswersForDisplay } from "@/lib/product-answers";

export function ProductAnswersBlock({ answers }: { answers: string }) {
  const display = formatAnswersForDisplay(answers);
  if (!display.prose && display.pairs.length === 0) return null;

  return (
    <div className="mt-3 rounded-[14px] border border-line bg-card px-3 py-2">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Respuestas</p>
      <p className="mt-0.5 text-sm font-bold text-ink">Lo que puedes saber</p>
      {display.prose ? (
        <p className="mt-0.5 text-xs leading-5 whitespace-pre-line text-muted">{display.prose}</p>
      ) : null}
      {display.pairs.length > 0 ? (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-canvas">
          {display.pairs.map((pair) => (
            <li key={`${pair.question}-${pair.answer}`} className="px-3 py-2">
              <p className="text-sm font-bold text-ink">{pair.question}</p>
              <p className="mt-0.5 text-sm leading-5 text-muted">{pair.answer}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1 text-xs leading-5 text-muted">Leerlas no cambia el precio publicado ni crea un pedido.</p>
    </div>
  );
}
