import Link from "next/link";
import type { CentralRouteResult } from "@/server/agent-central";
import { routeCentralAction } from "@/server/central-actions";

export function CentralRouterPanel({
  route,
  defaultIntent = "",
  enabled = true,
  canTurnOn = false,
}: {
  route: CentralRouteResult | null;
  defaultIntent?: string;
  enabled?: boolean;
  canTurnOn?: boolean;
}) {
  return (
    <section className="mt-4" aria-labelledby="central">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Enrutar</p>
      <h2 id="central" className="mt-0.5 text-base font-bold">
        COMPRUKI Central
      </h2>
      <p className="mt-1 text-sm text-muted">
        AG-01: si OpenAI responde, interpreta la intención; si no, usa reglas. Llama a Explorador, Analista y
        Creador (plantillas). Cada «Enrutar» deja una corrida y no escribe el catálogo ni cambia el precio.
        Enrutar no cobra ni cambia pedidos. Sin Dropi en vivo.
      </p>
      {!enabled ? (
        <p role="status" className="mt-2 text-sm font-medium text-coral">
          {canTurnOn
            ? "AG-01 está apagado. Actívalo en Presupuesto y activación."
            : "AG-01 está apagado. Lo enciende el propietario en Presupuesto y activación."}
        </p>
      ) : null}

      <form
        action={routeCentralAction}
        className="elevate-1 mt-3 grid gap-2 rounded-[14px] border border-line bg-card px-4 py-3 sm:grid-cols-[1fr_auto]"
      >
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase sm:col-span-2">Consulta</p>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Intención o SKU</span>
          <input
            name="intent"
            title="Escribirlo no cobra ni cambia pedidos."
            defaultValue={defaultIntent}
            disabled={!enabled}
            placeholder="Ej. margen LAM-MES-01, borrador faja, buscar ropa"
            className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm focus:border-accent focus:outline-none disabled:opacity-55"
          />
        </label>
        <nav aria-label="Consulta" className="flex flex-wrap items-end gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</span>
          <button
            type="submit"
            title="Enrutar no cobra ni cambia pedidos."
            disabled={!enabled}
            className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
          >
            Enrutar
          </button>
        </nav>
      </form>

      {!route ? (
        <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
          <p className="mt-0.5 text-sm text-muted">Escribe una intención para ver el paquete coordinado.</p>
        </div>
      ) : (
        <div className="elevate-1 mt-3 space-y-3 rounded-[14px] border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Resultado</p>
          <p className="mt-0.5 text-sm">
            <span className="font-semibold">Pedido:</span> {route.intent}
          </p>
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
            Fuente: {route.via === "openai" ? "OpenAI" : "reglas"}
            {route.costEstimateCop > 0 ? ` · costo est. ${route.costEstimateCop} COP` : ""} · Agentes:{" "}
            {route.agents.join(", ")}
          </p>
          <ul className="space-y-1.5 text-sm text-muted">
            {route.summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          {route.pending.length > 0 ? (
            <div>
              <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Pendiente</p>
              <p className="mt-0.5 text-sm font-semibold">Aprobaciones pendientes</p>
              <ul className="mt-1 space-y-1 text-sm">
                {route.pending.map((item) => (
                  <li key={item.id}>
                    {item.href ? (
                      <Link href={item.href} title="Abrirlo no cobra ni cambia pedidos." className="font-semibold text-accent-strong">
                        {item.label}
                      </Link>
                    ) : (
                      <span className="font-semibold">{item.label}</span>
                    )}
                    <span className="text-muted"> · {item.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {route.suggestedLinks.length > 0 ? (
            <nav aria-label="Vista" className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
              {route.suggestedLinks.map((link) => (
                <Link key={link.href + link.label} href={link.href} title="Abrirlo no cobra ni cambia pedidos." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      )}
    </section>
  );
}
