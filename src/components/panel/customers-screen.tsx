"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { phonesMatchLast10, type CrmContact } from "@/lib/crm-contacts";
import { FOLLOWUP_OPEN_STAGES, groupFollowupsByStage } from "@/lib/crm-pipeline";
import { cx } from "@/lib/cx";
import { formatDay } from "@/lib/format";
import { orderFocusHref } from "@/lib/store-order";
import { usePanelQuery } from "@/components/panel/panel-shell";
import type { FollowupPriority as AgentPriority } from "@/server/agent-followup-priority";
import type { RegisteredStoreAccount } from "@/server/customer-auth";
import type { FollowupTask } from "@/server/followups";
import {
  createFollowupAction,
  createSuggestedFollowupAction,
  moveFollowupStageAction,
  prioritizeFollowupsAction,
  resolveFollowupAction,
  updateFollowupMetaAction,
} from "@/server/followup-actions";

export type CrmAssignee = { userId: string; name: string };

type BoardFilter = "all" | "mine" | "overdue" | "high";

const ctrl =
  "h-7 w-full rounded-[6px] border border-line bg-canvas px-1.5 text-[11px] text-ink outline-none focus:border-ink";
const btn =
  "inline-flex h-7 shrink-0 items-center justify-center rounded-[6px] border border-line bg-card px-2 text-[11px] font-semibold text-ink hover:bg-subtle disabled:opacity-50";
const btnPrimary =
  "inline-flex h-7 shrink-0 items-center justify-center rounded-[6px] bg-primary px-2 text-[11px] font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-50";

export function CustomersScreen({
  accounts = [],
  contacts,
  openTasks,
  assignees = [],
  actorUserId = "",
  initialBoardFilter = "all",
  tableReady,
  pipelineReady = true,
  crmProReady = false,
  priority = null,
  ag07Enabled = true,
  flash = null,
  error = null,
  policyError = null,
}: {
  accounts?: RegisteredStoreAccount[];
  contacts: CrmContact[];
  openTasks: FollowupTask[];
  assignees?: CrmAssignee[];
  actorUserId?: string;
  initialBoardFilter?: BoardFilter;
  tableReady: boolean;
  pipelineReady?: boolean;
  crmProReady?: boolean;
  priority?: AgentPriority | null;
  ag07Enabled?: boolean;
  flash?: string | null;
  error?: string | null;
  policyError?: string | null;
}) {
  const [boardFilter, setBoardFilter] = useState<BoardFilter>(initialBoardFilter);
  const today = new Date().toISOString().slice(0, 10);
  const panelQuery = usePanelQuery().trim().toLocaleLowerCase("es");
  const panelDigits = panelQuery.replace(/\D/g, "");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (boardFilter === "all") url.searchParams.delete("f");
    else url.searchParams.set("f", boardFilter);
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(null, "", next);
  }, [boardFilter]);

  const matchesPanelQuery = (phone: string, name: string) => {
    if (!panelQuery) return true;
    const hay = `${name} ${phone}`.toLocaleLowerCase("es");
    if (hay.includes(panelQuery)) return true;
    if (phonesMatchLast10(phone, panelQuery)) return true;
    if (panelDigits && phone.replace(/\D/g, "").includes(panelDigits)) return true;
    return false;
  };

  const filteredTasks = useMemo(() => {
    let list = openTasks;
    if (boardFilter === "mine") {
      list = list.filter((task) => task.assignedTo && task.assignedTo === actorUserId);
    } else if (boardFilter === "overdue") {
      list = list.filter((task) => task.dueAt && task.dueAt.slice(0, 10) < today);
    } else if (boardFilter === "high") {
      list = list.filter((task) => task.priority === "high");
    }
    if (panelQuery) {
      list = list.filter((task) => matchesPanelQuery(task.phone, task.customerName));
    }
    return list;
  }, [openTasks, boardFilter, actorUserId, today, panelQuery, panelDigits]);

  const visibleContacts = useMemo(() => {
    if (!panelQuery) return contacts;
    return contacts.filter((contact) => matchesPanelQuery(contact.phone, contact.customerName));
  }, [contacts, panelQuery, panelDigits]);

  const byStage = groupFollowupsByStage(filteredTasks);
  const filterCounts = useMemo(
    () => ({
      all: openTasks.length,
      mine: openTasks.filter((task) => task.assignedTo && task.assignedTo === actorUserId).length,
      overdue: openTasks.filter((task) => task.dueAt && task.dueAt.slice(0, 10) < today).length,
      high: openTasks.filter((task) => task.priority === "high").length,
    }),
    [openTasks, actorUserId, today],
  );
  const assigneeLabel = (userId: string) =>
    userId ? assignees.find((item) => item.userId === userId)?.name || "Asignado" : "Libre";

  return (
    <div className="mx-auto max-w-[1600px] pb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Operación</p>
          <h1 className="mt-0.5 text-xl leading-6 font-extrabold tracking-tight">CRM · Pipeline</h1>
          <p className="mt-0.5 text-[11px] text-muted">
            {openTasks.length} abiertos · Lead → Postventa ·{" "}
            <Link href="/panel/inbox" className="font-semibold text-accent-strong hover:underline">
              Inbox
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtro del tablero">
          {(
            [
              ["all", "Todos", filterCounts.all],
              ["mine", "Míos", filterCounts.mine],
              ["overdue", "Venc.", filterCounts.overdue],
              ["high", "Alta", filterCounts.high],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={boardFilter === id}
              onClick={() => setBoardFilter(id)}
              className={cx(
                "inline-flex h-7 items-center gap-1 rounded-[6px] px-2 text-[11px] font-semibold",
                boardFilter === id ? "bg-ink text-canvas" : "bg-subtle text-muted hover:text-ink",
              )}
            >
              {label}
              <span className="tabular-nums opacity-80">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {!tableReady ? (
        <p role="status" className="mt-2 rounded-[8px] bg-warning-tint px-2 py-1.5 text-[11px] text-warning">
          Falta followup_tasks (013).
        </p>
      ) : null}
      {tableReady && !pipelineReady ? (
        <p role="status" className="mt-2 rounded-[8px] bg-warning-tint px-2 py-1.5 text-[11px] text-warning">
          Falta stage (014 / 021).
        </p>
      ) : null}
      {tableReady && pipelineReady && !crmProReady ? (
        <p role="status" className="mt-2 rounded-[8px] bg-warning-tint px-2 py-1.5 text-[11px] text-warning">
          Para responsable/vencimiento: <code className="text-ink">022_crm_pipeline_pro.sql</code>.
        </p>
      ) : null}
      {flash ? <p className="mt-2 text-[11px] font-medium text-accent-strong">{flash}</p> : null}
      {error ? <p className="mt-2 text-[11px] font-medium text-danger">{error}</p> : null}
      {policyError ? <p className="mt-2 text-[11px] font-medium text-danger">{policyError}</p> : null}

      <section className="mt-3" aria-labelledby="pipeline">
        <h2 id="pipeline" className="sr-only">
          Tablero de seguimientos
        </h2>

        {openTasks.length === 0 ? (
          <div className="elevate-1 rounded-[10px] border border-line bg-card px-3 py-2">
            <p className="text-[11px] text-muted">Sin abiertos. Escribe por WhatsApp o crea uno abajo.</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="elevate-1 rounded-[10px] border border-line bg-card px-3 py-2">
            <p className="text-[11px] text-muted">Nada en este filtro.</p>
          </div>
        ) : (
          <div className="-mx-1 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-1.5 px-1">
              {FOLLOWUP_OPEN_STAGES.map((stage) => (
                <div
                  key={stage.id}
                  className="elevate-1 flex w-[200px] shrink-0 flex-col rounded-[10px] border border-line bg-card"
                >
                  <div className="border-b border-line px-2 py-1.5">
                    <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
                      {stage.label}
                      <span className="ml-1 tabular-nums text-ink">{byStage[stage.id].length}</span>
                    </p>
                  </div>
                  <ul className="max-h-[min(64vh,36rem)] space-y-1 overflow-y-auto p-1.5">
                    {byStage[stage.id].length === 0 ? (
                      <li className="px-1 py-2 text-[11px] text-muted">Vacío</li>
                    ) : (
                      byStage[stage.id].map((task) => (
                        <PipelineCard
                          key={task.id}
                          task={task}
                          pipelineReady={pipelineReady}
                          crmProReady={crmProReady}
                          assignees={assignees}
                          assigneeLabel={assigneeLabel(task.assignedTo)}
                        />
                      ))
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-4" aria-labelledby="prioridad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">AG-07</p>
            <h2 id="prioridad" className="mt-0.5 text-sm font-bold">
              Priorizar
            </h2>
          </div>
          <form action={prioritizeFollowupsAction}>
            <button type="submit" disabled={!ag07Enabled} className={btnPrimary}>
              Priorizar
            </button>
          </form>
        </div>
        {priority ? (
          <div className="elevate-1 mt-3 rounded-[12px] border border-line bg-card px-3 py-3">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
              Fuente: {priority.via === "openai" ? "OpenAI" : "plantilla"}
            </p>
            {priority.suggestions.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Sin sugerencias.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {priority.suggestions.map((item) => (
                  <li
                    key={`${item.orderNumber}-${item.reason}`}
                    className="rounded-[10px] border border-line bg-canvas px-3 py-2"
                  >
                    <p className="text-sm font-semibold">
                      {item.customerName} · {item.orderNumber}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{item.reason}</p>
                    <form action={createSuggestedFollowupAction} className="mt-2 flex flex-wrap gap-1.5">
                      <input type="hidden" name="phone" value={item.phone} />
                      <input type="hidden" name="customerName" value={item.customerName} />
                      <input type="hidden" name="orderNumber" value={item.orderNumber} />
                      <input type="hidden" name="note" value={item.reason} />
                      <input type="hidden" name="stage" value="nuevo" />
                      <button type="submit" disabled={!tableReady} className={btn}>
                        Guardar en Lead
                      </button>
                      {item.phone ? (
                        <Link
                          href={`/panel/inbox?phone=${encodeURIComponent(item.phone)}&name=${encodeURIComponent(item.customerName)}`}
                          className={btn}
                        >
                          Inbox
                        </Link>
                      ) : null}
                      <Link href={orderFocusHref(item.orderNumber)} className={btn}>
                        Pedido
                      </Link>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <section className="mt-4" aria-labelledby="contactos">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Agenda</p>
        <h2 id="contactos" className="mt-0.5 text-sm font-bold">
          Contactos de pedidos
        </h2>
        {contacts.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-muted">Aún no hay pedidos con teléfono.</p>
        ) : visibleContacts.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-muted">Ningún contacto coincide con la búsqueda.</p>
        ) : (
          <ul className="mt-2 grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
            {visibleContacts.map((contact) => (
              <li key={contact.phone} className="elevate-1 rounded-[10px] border border-line bg-card px-2.5 py-2">
                <p className="text-[13px] font-semibold">{contact.customerName}</p>
                <p className="mt-0.5 text-[10px] text-muted">
                  {contact.phone}
                  {contact.openFollowups > 0 ? ` · ${contact.openFollowups} ab.` : ""}
                  {" · "}
                  {contact.latestOrderNumber}
                </p>
                <form action={createFollowupAction} className="mt-1.5 space-y-1">
                  <input type="hidden" name="phone" value={contact.phone} />
                  <input type="hidden" name="customerName" value={contact.customerName} />
                  <input type="hidden" name="orderNumber" value={contact.latestOrderNumber} />
                  <div className="grid grid-cols-2 gap-1.5">
                    <select name="stage" defaultValue="nuevo" disabled={!tableReady} className={ctrl}>
                      {FOLLOWUP_OPEN_STAGES.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.label}
                        </option>
                      ))}
                    </select>
                    <select
                      name="priority"
                      defaultValue="normal"
                      disabled={!tableReady || !crmProReady}
                      className={ctrl}
                    >
                      <option value="low">Baja</option>
                      <option value="normal">Normal</option>
                      <option value="high">Alta</option>
                    </select>
                  </div>
                  {crmProReady ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      <select name="assignedTo" defaultValue="" disabled={!tableReady} className={ctrl}>
                        <option value="">Sin asignar</option>
                        {assignees.map((person) => (
                          <option key={person.userId} value={person.userId}>
                            {person.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        name="dueAt"
                        disabled={!tableReady}
                        className={ctrl}
                        title="Vence"
                      />
                    </div>
                  ) : null}
                  <input
                    name="note"
                    required
                    maxLength={400}
                    placeholder="Nota del seguimiento"
                    disabled={!tableReady}
                    className={ctrl}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <button type="submit" disabled={!tableReady} className={btnPrimary}>
                      Crear
                    </button>
                    <Link
                      href={`/panel/inbox?phone=${encodeURIComponent(contact.phone)}&name=${encodeURIComponent(contact.customerName)}`}
                      className={btn}
                    >
                      Inbox
                    </Link>
                    <Link href={orderFocusHref(contact.latestOrderNumber)} className={btn}>
                      Pedido
                    </Link>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-ink">
          Cuentas registradas ({accounts.length})
        </summary>
        {accounts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Sin compradores registrados.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[12px] border border-line bg-card">
            {accounts.map((account) => (
              <li key={account.userId} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{account.displayName}</p>
                  <p className="truncate text-[11px] text-muted">{account.email}</p>
                </div>
                <span className="text-[10px] font-bold tracking-wide text-muted uppercase">
                  {account.orderCount > 0 ? `${account.orderCount} pedido(s)` : "Solo cuenta"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

function dueLabel(dueAt: string | null) {
  if (!dueAt) return null;
  const day = dueAt.slice(0, 10);
  const overdue = day < new Date().toISOString().slice(0, 10);
  return { day: formatDay(day), overdue };
}

function priorityDot(priority: FollowupTask["priority"]) {
  if (priority === "high") return "bg-danger";
  if (priority === "low") return "bg-muted";
  return "bg-accent";
}

function PipelineCard({
  task,
  pipelineReady,
  crmProReady,
  assignees,
  assigneeLabel,
}: {
  task: FollowupTask;
  pipelineReady: boolean;
  crmProReady: boolean;
  assignees: CrmAssignee[];
  assigneeLabel: string;
}) {
  const due = dueLabel(task.dueAt);
  return (
    <li className="rounded-[8px] border border-line bg-canvas px-1.5 py-1.5">
      <div className="flex items-start gap-1">
        <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${priorityDot(task.priority)}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-ink">
            {task.customerName || "Sin nombre"}
            {task.orderNumber ? (
              <span className="font-normal text-muted"> · {task.orderNumber}</span>
            ) : null}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted">{task.note || "—"}</p>
          <p className="mt-0.5 text-[9px] text-muted">
            {assigneeLabel}
            {due ? (
              <span className={due.overdue ? " text-danger font-semibold" : ""}>
                {" · "}
                {due.day}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {pipelineReady ? (
        <form action={moveFollowupStageAction} className="mt-1">
          <input type="hidden" name="id" value={task.id} />
          <select
            name="stage"
            defaultValue={task.stage}
            className={ctrl}
            aria-label="Etapa"
            title="Cambia etapa (sincroniza Inbox)"
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            {FOLLOWUP_OPEN_STAGES.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.label}
              </option>
            ))}
          </select>
        </form>
      ) : null}

      {crmProReady ? (
        <form action={updateFollowupMetaAction} className="mt-1 space-y-1">
          <input type="hidden" name="id" value={task.id} />
          <select
            name="assignedTo"
            defaultValue={task.assignedTo}
            className={ctrl}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            <option value="">Sin asignar</option>
            {assignees.map((person) => (
              <option key={person.userId} value={person.userId}>
                {person.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-1">
            <select
              name="priority"
              defaultValue={task.priority}
              className={ctrl}
              title="Prioridad"
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
            >
              <option value="low">Baja</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
            </select>
            <input
              type="date"
              name="dueAt"
              defaultValue={task.dueAt ? task.dueAt.slice(0, 10) : ""}
              className={ctrl}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
            />
          </div>
        </form>
      ) : null}

      <div className="mt-1 flex flex-wrap gap-1">
        <form action={resolveFollowupAction}>
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="status" value="done" />
          <button type="submit" className={btnPrimary}>
            Hecho
          </button>
        </form>
        <form action={resolveFollowupAction}>
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="status" value="dismissed" />
          <button type="submit" className={btn} aria-label="Descartar">
            ×
          </button>
        </form>
        {task.phone ? (
          <Link
            href={`/panel/inbox?phone=${encodeURIComponent(task.phone)}${
              task.customerName ? `&name=${encodeURIComponent(task.customerName)}` : ""
            }`}
            className={btn}
          >
            Inbox
          </Link>
        ) : null}
        {task.orderNumber ? (
          <Link href={orderFocusHref(task.orderNumber)} className={btn}>
            Pedido
          </Link>
        ) : null}
      </div>
    </li>
  );
}
