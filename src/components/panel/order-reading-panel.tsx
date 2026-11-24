import type { OrderReading } from "@/server/agent-order-reading";
import { runOrderReadingAction } from "@/server/order-agent-actions";

export function OrderReadingPanel({
  orderNumber,
  reading = null,
  policyError = null,
  enabled = true,
}: {
  orderNumber: string;
  reading?: OrderReading | null;
  policyError?: string | null;
  enabled?: boolean;
}) {
  return (
    <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="pedido-lectura">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Lectura</p>
      <h2 id="pedido-lectura" className="mt-0.5 scroll-mt-24 text-sm font-semibold">
        AG-06 · lectura del pedido
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Resume el estado con datos locales; si OpenAI responde, añade lectura corta. No cambia el pedido.
      </p>
      {!enabled ? (
        <p role="status" className="mt-2 text-sm font-medium text-coral">
          AG-06 está apagado. Actívalo en Presupuesto y activación (Centro de agentes).
        </p>
      ) : null}
      {policyError ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {policyError}
        </p>
      ) : null}

      <form action={runOrderReadingAction} className="mt-2">
        <input type="hidden" name="orderNumber" value={orderNumber} />
        <nav aria-label="Consulta" className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</span>
          <button
            type="submit"
           
            disabled={!enabled}
            className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
          >
            Leer pedido
          </button>
        </nav>
      </form>

      {reading ? (
        <div className="mt-2 rounded-[10px] border border-line bg-canvas px-3 py-2">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
            Fuente: {reading.via === "openai" ? "OpenAI" : "cifras"}
            {reading.costEstimateCop > 0 ? ` · costo est. ${reading.costEstimateCop} COP` : ""}
          </p>
          <ul className="mt-1.5 space-y-1.5 text-sm text-muted">
            {reading.bullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
