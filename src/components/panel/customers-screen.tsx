"use client";

import Link from "next/link";
import type { CrmContact } from "@/lib/crm-contacts";
import {
  FOLLOWUP_OPEN_STAGES,
  followupStageLabel,
  groupFollowupsByStage,
  nextFollowupStages,
  type FollowupStageId,
} from "@/lib/crm-pipeline";
import { formatDay } from "@/lib/format";
import { orderFocusHref, whatsAppHref } from "@/lib/store-order";
import type { FollowupPriority } from "@/server/agent-followup-priority";
import type { RegisteredStoreAccount } from "@/server/customer-auth";
import type { FollowupTask } from "@/server/followups";
import {
  createFollowupAction,
  createSuggestedFollowupAction,
  moveFollowupStageAction,
  prioritizeFollowupsAction,
  resolveFollowupAction,
} from "@/server/followup-actions";

export function CustomersScreen({
  accounts = [],
  contacts,
  openTasks,
  tableReady,
  pipelineReady = true,
  priority = null,
  ag07Enabled = true,
  flash = null,
  error = null,
  policyError = null,
}: {
  accounts?: RegisteredStoreAccount[];
  contacts: CrmContact[];
  openTasks: FollowupTask[];
  tableReady: boolean;
  pipelineReady?: boolean;
  priority?: FollowupPriority | null;
  ag07Enabled?: boolean;
  flash?: string | null;
  error?: string | null;
  policyError?: string | null;
}) {
  const byStage = groupFollowupsByStage(openTasks);

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Operación</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Clientes</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Cuentas registradas en la tienda (con o sin pedido) y CRM lite de seguimientos. Abrir WhatsApp es a mano;
        Compruki no envía.
      </p>

      {!tableReady ? (
        <p role="status" className="mt-3 rounded-[10px] bg-warning-tint px-3 py-2 text-sm text-warning">
          Falta followup_tasks. Ejecuta supabase/migrations/013_followup_tasks.sql. La lista de contactos sigue
          visible.
        </p>
      ) : null}

      {tableReady && !pipelineReady ? (
        <p role="status" className="mt-3 rounded-[10px] bg-warning-tint px-3 py-2 text-sm text-warning">
          Falta la columna stage. Ejecuta supabase/migrations/014_followup_pipeline.sql para mover tarjetas entre
          etapas.
        </p>
      ) : null}

      {flash ? (
        <p role="status" className="mt-3 text-sm font-medium text-accent-strong">
          {flash}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      {policyError ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {policyError}
        </p>
      ) : null}

      <section className="mt-5" aria-labelledby="cuentas-tienda">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Tienda</p>
        <h2 id="cuentas-tienda" className="mt-0.5 text-base font-bold">
          Cuentas registradas
        </h2>
        <p className="mt-1 text-sm text-muted">
          {accounts.length} cuenta{accounts.length === 1 ? "" : "s"} · incluye quien solo se registró y aún no pidió.
        </p>
        {accounts.length === 0 ? (
          <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
            <p className="mt-0.5 text-sm text-muted">Todavía no hay compradores registrados en la tienda.</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-card">
            {accounts.map((account) => (
              <li key={account.userId} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{account.displayName}</p>
                  <p className="mt-0.5 break-all text-xs text-muted">{account.email}</p>
                  <p className="mt-1 text-xs text-muted">
                    {account.provider}
                    {account.phone ? ` · ${account.phone}` : " · Sin celular"}
                    {" · "}
                    {account.orderCount === 0
                      ? "Sin pedidos"
                      : `${account.orderCount} pedido${account.orderCount === 1 ? "" : "s"}`}
                    {account.createdAt ? ` · ${formatDay(account.createdAt.slice(0, 10))}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-[8px] px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] uppercase ${
                    account.orderCount > 0 ? "bg-accent/15 text-accent-strong" : "bg-subtle text-muted"
                  }`}
                >
                  {account.orderCount > 0 ? "Con pedido" : "Solo cuenta"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6" aria-labelledby="pipeline">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Pipeline</p>
        <h2 id="pipeline" className="mt-0.5 text-base font-bold">
          Seguimientos abiertos
        </h2>
        <p className="mt-1 text-sm text-muted">
          {openTasks.length} abierto{openTasks.length === 1 ? "" : "s"}. Mueve la etapa o cierra con Hecho /
          Descartar. No envía mensajes.
        </p>

        {openTasks.length === 0 ? (
          <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
            <p className="mt-0.5 text-sm text-muted">No hay seguimientos abiertos. Crea uno desde un contacto.</p>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {FOLLOWUP_OPEN_STAGES.map((stage) => (
              <div key={stage.id} className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-3">
                <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{stage.label}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {stage.hint} · {byStage[stage.id].length}
                </p>
                {byStage[stage.id].length === 0 ? (
                  <p className="mt-3 text-sm text-muted">Sin tarjetas.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {byStage[stage.id].map((task) => (
                      <PipelineCard
                        key={task.id}
                        task={task}
                        pipelineReady={pipelineReady}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6" aria-labelledby="prioridad">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">AG-07</p>
        <h2 id="prioridad" className="mt-0.5 text-base font-bold">
          Priorizar seguimientos
        </h2>
        <p className="mt-1 text-sm text-muted">
          Sugiere a quién contactar (OpenAI o plantilla). No crea tareas ni envía mensajes hasta que tú lo
          guardes.
        </p>
        {!ag07Enabled ? (
          <p role="status" className="mt-2 text-sm font-medium text-coral">
            AG-07 está apagado. Actívalo en Presupuesto y activación (Centro de agentes).
          </p>
        ) : null}
        <form action={prioritizeFollowupsAction} className="mt-2">
          <nav aria-label="Consulta" className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</span>
            <button
              type="submit"
              title="Priorizar no crea tareas."
              disabled={!ag07Enabled}
              className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
            >
              Priorizar
            </button>
          </nav>
        </form>

        {priority ? (
          <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
              Fuente: {priority.via === "openai" ? "OpenAI" : "plantilla"}
              {priority.costEstimateCop > 0 ? ` · costo est. ${priority.costEstimateCop} COP` : ""}
            </p>
            {priority.suggestions.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No hay sugerencias ahora.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {priority.suggestions.map((item) => {
                  const waHref = whatsAppHref(
                    item.phone,
                    `${crmHello(item.customerName)} Pedido ${item.orderNumber}. ${item.reason}`.slice(0, 500),
                  );
                  return (
                  <li key={`${item.orderNumber}-${item.reason}`} className="rounded-[10px] border border-line bg-canvas px-3 py-2">
                    <p className="text-sm font-semibold">
                      {item.customerName} · {item.orderNumber}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">{item.reason}</p>
                    <form action={createSuggestedFollowupAction} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="phone" value={item.phone} />
                      <input type="hidden" name="customerName" value={item.customerName} />
                      <input type="hidden" name="orderNumber" value={item.orderNumber} />
                      <input type="hidden" name="note" value={item.reason} />
                      <input type="hidden" name="stage" value="nuevo" />
                      <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
                          Herramientas
                        </span>
                        <button
                          type="submit"
                          title="Guardarlo no envía WhatsApp."
                          disabled={!tableReady}
                          className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle disabled:opacity-55"
                        >
                          Guardar en Nuevo
                        </button>
                        <Link
                          href={orderFocusHref(item.orderNumber)}
                          className="inline-flex h-9 items-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle"
                        >
                          Ver pedido
                        </Link>
                        {waHref ? (
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abre WhatsApp. Compruki no envía."
                            className="inline-flex h-9 items-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle"
                          >
                            Abrir WhatsApp
                          </a>
                        ) : null}
                      </nav>
                    </form>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <section className="mt-6" aria-labelledby="contactos">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Agenda</p>
        <h2 id="contactos" className="mt-0.5 text-base font-bold">
          Contactos de pedidos
        </h2>
        <p className="mt-1 text-sm text-muted">
          {contacts.length} contacto{contacts.length === 1 ? "" : "s"} · agrupados por teléfono. Solo para
          seguimiento del pedido.
        </p>

        {contacts.length === 0 ? (
          <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
            <p className="mt-0.5 text-sm text-muted">Aún no hay pedidos con teléfono.</p>
          </div>
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {contacts.map((contact) => {
              const waHref = whatsAppHref(contact.phone, contactWhatsAppText(contact));
              return (
              <li key={contact.phone} className="elevate-1 rounded-[14px] border border-line bg-card px-4 py-3">
                <p className="text-sm font-semibold">{contact.customerName}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {contact.phone}
                  {contact.city ? ` · ${contact.city}` : ""}
                  {" · "}
                  {contact.orderCount} pedido{contact.orderCount === 1 ? "" : "s"}
                  {contact.openFollowups > 0 ? ` · ${contact.openFollowups} abierto(s)` : ""}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Último: {contact.latestOrderNumber} · {contact.latestStatusLabel}
                  {contact.latestAt ? ` · ${formatDay(contact.latestAt)}` : ""}
                </p>
                <form action={createFollowupAction} className="mt-2 space-y-2">
                  <input type="hidden" name="phone" value={contact.phone} />
                  <input type="hidden" name="customerName" value={contact.customerName} />
                  <input type="hidden" name="orderNumber" value={contact.latestOrderNumber} />
                  <label className="block">
                    <span className="mb-1 block text-sm font-semibold">Etapa inicial</span>
                    <select
                      name="stage"
                      defaultValue="nuevo"
                      disabled={!tableReady}
                      className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm focus:border-accent focus:outline-none disabled:opacity-55"
                    >
                      {FOLLOWUP_OPEN_STAGES.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-semibold">Nota del seguimiento</span>
                    <input
                      name="note"
                      required
                      maxLength={400}
                      title="Escribirla no envía."
                      placeholder="Ej. Confirmar talla / avisar incidencia"
                      disabled={!tableReady}
                      className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm focus:border-accent focus:outline-none disabled:opacity-55"
                    />
                  </label>
                  <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
                      Herramientas
                    </span>
                    <button
                      type="submit"
                      title="Guardarlo no envía WhatsApp."
                      disabled={!tableReady}
                      className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
                    >
                      Crear seguimiento
                    </button>
                    <Link
                      href={orderFocusHref(contact.latestOrderNumber)}
                      className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
                    >
                      Ver pedido
                    </Link>
                    {waHref ? (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abre WhatsApp. Compruki no envía."
                        className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
                      >
                        Abrir WhatsApp
                      </a>
                    ) : null}
                  </nav>
                </form>
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function crmHello(name: string) {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.length >= 2 ? `Hola ${first}.` : "Hola.";
}

function contactWhatsAppText(contact: CrmContact) {
  return `${crmHello(contact.customerName)} Te escribo por tu pedido ${contact.latestOrderNumber}.`.slice(0, 500);
}

function followupWhatsAppText(task: FollowupTask) {
  const order = task.orderNumber ? ` Pedido ${task.orderNumber}.` : "";
  const note = task.note.trim() ? ` ${task.note.trim()}` : "";
  return `${crmHello(task.customerName)}${order}${note}`.slice(0, 500);
}

function PipelineCard({ task, pipelineReady }: { task: FollowupTask; pipelineReady: boolean }) {
  const moves = nextFollowupStages(task.stage);
  const waHref = whatsAppHref(task.phone, followupWhatsAppText(task));
  return (
    <li className="rounded-[10px] border border-line bg-canvas px-3 py-2">
      <p className="text-sm font-semibold">
        {task.customerName || "Sin nombre"}
        {task.orderNumber ? ` · ${task.orderNumber}` : ""}
      </p>
      <p className="mt-0.5 text-xs text-muted">
        {task.phone}
        {task.createdAt ? ` · ${formatDay(task.createdAt)}` : ""}
        {" · "}
        {followupStageLabel(task.stage)}
      </p>
      <p className="mt-1 text-sm text-muted">{task.note}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {pipelineReady
          ? moves.map((stage) => (
              <MoveButton key={stage} id={task.id} stage={stage} />
            ))
          : null}
        <form action={resolveFollowupAction} className="contents">
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="status" value="done" />
          <button
            type="submit"
            title="Cerrarlo no envía mensaje."
            className="inline-flex h-8 items-center justify-center rounded-[10px] bg-primary px-2.5 text-xs font-semibold text-on-dark hover:bg-primary-soft"
          >
            Hecho
          </button>
        </form>
        <form action={resolveFollowupAction} className="contents">
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="status" value="dismissed" />
          <button
            type="submit"
            className="inline-flex h-8 items-center justify-center rounded-[10px] border border-line bg-card px-2.5 text-xs font-semibold text-ink hover:bg-subtle"
          >
            Descartar
          </button>
        </form>
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Abre WhatsApp con una nota. Compruki no envía."
            className="inline-flex h-8 items-center rounded-[10px] border border-line bg-card px-2.5 text-xs font-semibold text-ink hover:bg-subtle"
          >
            WhatsApp
          </a>
        ) : null}
        {task.orderNumber ? (
          <Link
            href={orderFocusHref(task.orderNumber)}
            className="inline-flex h-8 items-center rounded-[10px] border border-line bg-card px-2.5 text-xs font-semibold text-ink hover:bg-subtle"
          >
            Pedido
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function MoveButton({ id, stage }: { id: string; stage: FollowupStageId }) {
  return (
    <form action={moveFollowupStageAction} className="contents">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="stage" value={stage} />
      <button
        type="submit"
        title="Mover etapa no envía mensaje."
        className="inline-flex h-8 items-center justify-center rounded-[10px] border border-line bg-card px-2.5 text-xs font-semibold text-ink hover:bg-subtle"
      >
        → {followupStageLabel(stage)}
      </button>
    </form>
  );
}
