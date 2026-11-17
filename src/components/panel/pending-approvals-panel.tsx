"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { PendingApproval } from "@/server/agent-central";
import { resolvePendingApprovalAction, type ResolveApprovalState } from "@/server/approval-actions";

const initial: ResolveApprovalState = { error: null, message: null };

export function PendingApprovalsPanel({ items }: { items: PendingApproval[] }) {
  return (
    <section className="mt-4" aria-labelledby="pendientes-humanos">
      <h2 id="pendientes-humanos" className="text-base font-bold">
        Pendientes humanos
      </h2>
      <p className="mt-1 text-sm text-muted">
        Bandeja de AG-01 · list_pending_approvals. Pedidos se atienden en Pedidos; borradores y corridas
        se aprueban o rechazan aquí. OpenAI no está conectado.
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
              {item.actionable ? <ApprovalButtons kind={item.kind} id={item.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ApprovalButtons({ kind, id }: { kind: PendingApproval["kind"]; id: string }) {
  const [state, action, pending] = useActionState(resolvePendingApprovalAction, initial);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="approve" />
          <button
            type="submit"
            disabled={pending}
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
