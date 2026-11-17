import Link from "next/link";
import type { PendingApproval } from "@/server/agent-central";

export function PendingApprovalsPanel({ items }: { items: PendingApproval[] }) {
  return (
    <section className="mt-4" aria-labelledby="pendientes-humanos">
      <h2 id="pendientes-humanos" className="text-base font-bold">
        Pendientes humanos
      </h2>
      <p className="mt-1 text-sm text-muted">
        Bandeja de AG-01 · list_pending_approvals. Pedidos por confirmar/incidencia y corridas en
        espera de aprobación. OpenAI no está conectado.
      </p>

      {items.length === 0 ? (
        <p className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3 text-sm text-muted">
          No hay pendientes humanos ahora.
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
