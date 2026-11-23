"use client";

import { useActionState } from "react";
import { formatCop } from "@/lib/format";
import type { AgentConfigRow, AgentMonthSpend } from "@/server/agent-gateway";
import { saveAgentConfigAction, type SaveAgentConfigState } from "@/server/agent-config-actions";

const initial: SaveAgentConfigState = { error: null, message: null };

type RoleCard = {
  id: string;
  name: string;
  job: string;
  config: AgentConfigRow | null;
};

export function AgentBudgetPanel({
  roles,
  monthSpend,
  canEdit = false,
}: {
  roles: RoleCard[];
  monthSpend: {
    periodLabel: string;
    totalCostEstimateCop: number;
    totalRuns: number;
    byAgent: AgentMonthSpend[];
  };
  canEdit?: boolean;
}) {
  const spendById = new Map(monthSpend.byAgent.map((row) => [row.agentId, row]));

  return (
    <section className="mt-6" aria-labelledby="presupuesto-ia">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Tope</p>
      <h2 id="presupuesto-ia" className="mt-0.5 text-base font-bold">
        Presupuesto y activación (P0-IA)
      </h2>
      <p className="mt-1 text-sm text-muted">
        Activación y tope mensual por rol (HU-AG05). Solo el propietario los cambia. Si un rol está
        apagado o sin presupuesto, Enrutar / Buscar / Generar / Calcular se cancelan. OpenAI no está
        conectado: el costo estimado sigue en cero. Verlo o guardarlo no cobra ni cambia pedidos. El costo estimado no es dinero cobrado.
      </p>

      <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Uso</p>
        <h3 className="mt-0.5 text-sm font-semibold">Uso en {monthSpend.periodLabel}</h3>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Corridas</dt>
            <dd className="mt-0.5 text-xl font-extrabold tracking-tight">{monthSpend.totalRuns}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Costo estimado</dt>
            <dd className="mt-0.5 text-xl font-extrabold tracking-tight">
              {formatCop(monthSpend.totalCostEstimateCop)}
            </dd>
          </div>
        </dl>
      </div>

      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {roles.map((role) => (
          <li key={role.id}>
            <AgentConfigForm
              role={role}
              spend={spendById.get(role.id) ?? { agentId: role.id, runCount: 0, costEstimateCop: 0 }}
              canEdit={canEdit}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AgentConfigForm({
  role,
  spend,
  canEdit,
}: {
  role: RoleCard;
  spend: AgentMonthSpend;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(saveAgentConfigAction, initial);
  const enabled = role.config?.enabled === true;
  const budget = role.config?.monthlyBudgetCop ?? 0;
  const notes = role.config?.notes ?? "";

  return (
    <article className="elevate-1 rounded-[14px] border border-line bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{role.id}</p>
          <h3 className="mt-0.5 text-sm font-semibold">{role.name}</h3>
        </div>
        <span className="shrink-0 rounded-[10px] border border-line px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
          {enabled ? "Activo" : "Apagado"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-5 text-muted">{role.job}</p>
      <p className="mt-2 text-xs text-muted">
        Este mes: {spend.runCount} corrida{spend.runCount === 1 ? "" : "s"} · costo {formatCop(spend.costEstimateCop)}
        {budget > 0 ? ` · tope ${formatCop(budget)}` : ""}
      </p>
      {budget > 0 ? (
        <div className="mt-2" aria-hidden="true">
          <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, Math.round((spend.costEstimateCop / budget) * 100))}%` }}
            />
          </div>
        </div>
      ) : null}

      <form action={action} className="mt-3 grid gap-2">
        <input type="hidden" name="agentId" value={role.id} />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="enabled"
            title="Marcarlo no cobra ni cambia pedidos."
            defaultChecked={enabled}
            disabled={!canEdit}
            className="h-4 w-4 accent-[var(--color-accent,#0d9488)] disabled:opacity-55"
          />
          Rol activo (bloquea herramientas si está apagado)
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Tope mensual (COP)</span>
          <input
            name="monthlyBudgetCop"
            title="Escribirlo no cobra ni cambia pedidos. El tope no es dinero cobrado."
            type="number"
            min={0}
            step={1000}
            defaultValue={budget}
            disabled={!canEdit}
            className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm focus:border-accent focus:outline-none disabled:opacity-55"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Notas</span>
          <input
            name="notes"
            title="Escribirlo no cobra ni cambia pedidos."
            defaultValue={notes}
            maxLength={500}
            placeholder="Ej. solo borradores, sin publicar"
            disabled={!canEdit}
            className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm focus:border-accent focus:outline-none disabled:opacity-55"
          />
        </label>
        {!canEdit ? (
          <p role="status" className="text-sm font-medium text-coral">
            Solo el propietario puede cambiar esta configuración. No cobra ni cambia pedidos.
          </p>
        ) : null}
        <button
          type="submit"
          title="Guardarlo no cobra ni cambia pedidos."
          disabled={pending || !canEdit}
          className="inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-card px-4 text-sm font-semibold text-ink hover:bg-subtle disabled:opacity-55"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </form>
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
    </article>
  );
}
