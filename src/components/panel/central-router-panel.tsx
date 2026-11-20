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
      <h2 id="central" className="text-base font-bold">
        COMPRUKI Central (sin OpenAI)
      </h2>
      <p className="mt-1 text-sm text-muted">
        AG-01 enruta con reglas a Explorador, Analista y Creador. Cada «Enrutar» deja una corrida en el
        historial y no escribe el catálogo ni cambia el precio. Enrutar no cobra ni cambia pedidos. No usa modelo ni Dropi en vivo.
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
        <div className="flex items-end">
          <button
            type="submit"
            title="Enrutar no cobra ni cambia pedidos."
            disabled={!enabled}
            className="inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55 sm:w-auto"
          >
            Enrutar
          </button>
        </div>
      </form>

      {!route ? (
        <p className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3 text-sm text-muted">
          Escribe una intención para ver el paquete coordinado.
        </p>
      ) : (
        <div className="elevate-1 mt-3 space-y-3 rounded-[14px] border border-line bg-card px-4 py-3">
          <p className="text-sm">
            <span className="font-semibold">Pedido:</span> {route.intent}
          </p>
          <p className="text-xs font-bold tracking-[0.06em] text-muted uppercase">
            OpenAI: no · Agentes: {route.agents.join(", ")}
          </p>
          <ul className="space-y-1.5 text-sm text-muted">
            {route.summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          {route.pending.length > 0 ? (
            <div>
              <p className="text-sm font-semibold">Aprobaciones pendientes</p>
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
            <div className="flex flex-wrap gap-3 text-sm font-semibold">
              {route.suggestedLinks.map((link) => (
                <Link key={link.href + link.label} href={link.href} title="Abrirlo no cobra ni cambia pedidos." className="text-accent-strong">
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
