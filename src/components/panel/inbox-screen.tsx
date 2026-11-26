"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { FOLLOWUP_OPEN_STAGES, followupStageLabel } from "@/lib/crm-pipeline";
import { cx } from "@/lib/cx";
import {
  assignInboxConversationAction,
  createFollowupFromInboxAction,
  openInboxByPhoneAction,
  selectInboxConversationAction,
  sendInboxMessageAction,
  updateInboxStageAction,
  type InboxActionState,
  type InboxAssignee,
} from "@/server/whatsapp-inbox-actions";
import type { InboxConversation, InboxMessage } from "@/server/whatsapp-inbox";

const empty: InboxActionState = {
  error: null,
  ok: null,
  conversations: [],
  activeId: null,
  messages: [],
};

type FilterId = "all" | "mine" | "unassigned";

const field =
  "h-9 w-full rounded-[10px] border border-line bg-canvas px-2.5 text-sm text-ink outline-none focus:border-ink";
const btnSecondary =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle disabled:opacity-50";
const btnPrimary =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] bg-ink px-3 text-sm font-semibold text-canvas hover:opacity-90 disabled:opacity-50";
const labelCls = "mb-1 block text-[10px] font-bold tracking-[0.08em] text-muted uppercase";

export function InboxScreen({
  tableReady,
  initialConversations,
  initialActiveId,
  initialMessages,
  assignees,
  actorUserId,
  roleLabel,
  bootError,
}: {
  tableReady: boolean;
  initialConversations: InboxConversation[];
  initialActiveId: string | null;
  initialMessages: InboxMessage[];
  assignees: InboxAssignee[];
  actorUserId: string;
  roleLabel: string;
  bootError: string | null;
}) {
  const [selectState, selectAction] = useActionState(selectInboxConversationAction, empty);
  const [sendState, sendAction, sending] = useActionState(sendInboxMessageAction, empty);
  const [stageState, stageAction, staging] = useActionState(updateInboxStageAction, empty);
  const [assignState, assignAction, assigning] = useActionState(assignInboxConversationAction, empty);
  const [followState, followAction, following] = useActionState(createFollowupFromInboxAction, empty);
  const [openState, openAction, opening] = useActionState(openInboxByPhoneAction, empty);
  const [filter, setFilter] = useState<FilterId>("all");

  const conversations =
    openState.conversations.length ||
    sendState.conversations.length ||
    stageState.conversations.length ||
    assignState.conversations.length ||
    followState.conversations.length ||
    selectState.conversations.length
      ? openState.conversations.length
        ? openState.conversations
        : sendState.conversations.length
          ? sendState.conversations
          : stageState.conversations.length
            ? stageState.conversations
            : assignState.conversations.length
              ? assignState.conversations
              : followState.conversations.length
                ? followState.conversations
                : selectState.conversations
      : initialConversations;

  const activeId =
    openState.activeId ||
    sendState.activeId ||
    stageState.activeId ||
    assignState.activeId ||
    followState.activeId ||
    selectState.activeId ||
    initialActiveId;

  const messages =
    (openState.activeId && openState.messages) ||
    (sendState.activeId && sendState.messages) ||
    (stageState.activeId && stageState.messages) ||
    (assignState.activeId && assignState.messages) ||
    (followState.activeId && followState.messages) ||
    (selectState.activeId && selectState.messages) ||
    initialMessages;

  const assigneeName = useMemo(() => {
    const map = new Map(assignees.map((item) => [item.userId, item.name || item.email]));
    return (userId: string) => (userId ? map.get(userId) || "Asignado" : "Sin asignar");
  }, [assignees]);

  const visible = useMemo(() => {
    if (filter === "mine") return conversations.filter((item) => item.assignedTo === actorUserId);
    if (filter === "unassigned") return conversations.filter((item) => !item.assignedTo);
    return conversations;
  }, [conversations, filter, actorUserId]);

  const active = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? null,
    [conversations, activeId],
  );

  const feedbackError =
    bootError ||
    openState.error ||
    sendState.error ||
    stageState.error ||
    assignState.error ||
    followState.error ||
    selectState.error;
  const feedbackOk =
    openState.ok || sendState.ok || stageState.ok || assignState.ok || followState.ok;

  if (!tableReady) {
    return (
      <div className="mx-auto max-w-[900px] pb-8">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Operación</p>
        <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Inbox WhatsApp</h1>
        <p role="status" className="mt-4 rounded-[12px] bg-warning-tint px-3 py-2 text-sm text-warning">
          Falta la migración <code className="text-ink">021_whatsapp_inbox_crm.sql</code>. Ejecútala en Supabase
          SQL Editor y recarga.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Operación</p>
          <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Inbox WhatsApp</h1>
          <p className="mt-1 text-sm text-muted">Meta Cloud · CRM · {roleLabel}</p>
        </div>
        <Link href="/panel/whatsapp" className={btnSecondary}>
          Conexión Meta
        </Link>
      </div>

      {feedbackError ? <p className="mt-3 text-sm text-danger">{feedbackError}</p> : null}
      {feedbackOk ? <p className="mt-3 text-sm text-success">{feedbackOk}</p> : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        {/* Lista compacta */}
        <aside className="elevate-1 flex max-h-[min(72vh,40rem)] flex-col overflow-hidden rounded-[14px] border border-line bg-card">
          <div className="shrink-0 space-y-2 border-b border-line px-2.5 py-2.5">
            <form action={openAction} className="space-y-1.5">
              <input name="phone" required placeholder="Celular" className={field} />
              <div className="flex gap-1.5">
                <input name="contactName" placeholder="Nombre" className={cx(field, "min-w-0 flex-1")} />
                <button type="submit" disabled={opening} className={btnPrimary}>
                  {opening ? "…" : "Abrir"}
                </button>
              </div>
            </form>
            <div className="flex gap-1" role="tablist" aria-label="Filtro">
              {(
                [
                  ["all", "Todos"],
                  ["mine", "Míos"],
                  ["unassigned", "Libres"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => setFilter(id)}
                  className={cx(
                    "h-7 flex-1 rounded-[8px] border text-[11px] font-semibold",
                    filter === id
                      ? "border-ink bg-ink text-canvas"
                      : "border-line bg-canvas text-ink hover:bg-subtle",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted">
                {conversations.length === 0 ? "Sin chats aún." : "Nada en este filtro."}
              </p>
            ) : (
              <ul>
                {visible.map((item) => (
                  <li key={item.id} className="border-b border-line last:border-b-0">
                    <form action={selectAction}>
                      <input type="hidden" name="conversationId" value={item.id} />
                      <button
                        type="submit"
                        className={cx(
                          "w-full px-2.5 py-2 text-left transition-colors hover:bg-subtle",
                          item.id === activeId ? "bg-accent-tint/50" : "",
                        )}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <p className="truncate text-[13px] font-semibold text-ink">
                            {item.contactName || item.phone}
                          </p>
                          {item.unreadCount > 0 ? (
                            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-primary-dark">
                              {item.unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted">
                          {item.lastMessagePreview || "—"}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] font-semibold tracking-[0.04em] text-muted uppercase">
                          {followupStageLabel(item.pipelineStage)} · {assigneeName(item.assignedTo)}
                        </p>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Chat + controles ordenados */}
        <section className="elevate-1 flex min-h-[min(72vh,40rem)] flex-col overflow-hidden rounded-[14px] border border-line bg-card">
          {!active ? (
            <p className="m-auto px-4 text-sm text-muted">Elige una conversación a la izquierda.</p>
          ) : (
            <>
              <header className="shrink-0 border-b border-line px-3 py-2.5 sm:px-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-ink">
                      {active.contactName || active.phone}
                    </p>
                    <p className="text-xs text-muted tabular-nums">{active.phone}</p>
                  </div>
                  <Link
                    href="/panel/clientes"
                    className="text-sm font-semibold text-accent-strong hover:underline"
                  >
                    Ver CRM
                  </Link>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <form action={assignAction} className="min-w-0">
                    <input type="hidden" name="conversationId" value={active.id} />
                    <label className={labelCls} htmlFor="inbox-assignee">
                      Responsable
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        id="inbox-assignee"
                        name="assignedTo"
                        defaultValue={active.assignedTo}
                        key={`${active.id}-${active.assignedTo}`}
                        className={cx(field, "min-w-0 flex-1")}
                      >
                        <option value="">Sin asignar</option>
                        {assignees.map((person) => (
                          <option key={person.userId} value={person.userId}>
                            {person.name || person.email}
                            {person.userId === actorUserId ? " (tú)" : ""}
                          </option>
                        ))}
                      </select>
                      <button type="submit" disabled={assigning} className={btnSecondary}>
                        Asignar
                      </button>
                    </div>
                  </form>

                  <form action={stageAction} className="min-w-0">
                    <input type="hidden" name="conversationId" value={active.id} />
                    <label className={labelCls} htmlFor="inbox-stage">
                      Etapa y estado
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <select
                        id="inbox-stage"
                        name="stage"
                        defaultValue={active.pipelineStage}
                        key={`${active.id}-stage-${active.pipelineStage}`}
                        className={cx(field, "min-w-0 flex-1 basis-[7rem]")}
                      >
                        {FOLLOWUP_OPEN_STAGES.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                      <select
                        name="status"
                        defaultValue={active.status}
                        key={`${active.id}-status-${active.status}`}
                        className={cx(field, "w-[7.5rem] shrink-0")}
                      >
                        <option value="open">Abierta</option>
                        <option value="pending">Pendiente</option>
                        <option value="closed">Cerrada</option>
                      </select>
                      <button type="submit" disabled={staging} className={btnSecondary}>
                        Guardar
                      </button>
                    </div>
                  </form>
                </div>

                <form action={followAction} className="mt-3 min-w-0">
                  <input type="hidden" name="conversationId" value={active.id} />
                  <label className={labelCls} htmlFor="inbox-note">
                    Seguimiento CRM
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="inbox-note"
                      name="note"
                      placeholder="Nota corta para Clientes"
                      className={cx(field, "min-w-0 flex-1")}
                    />
                    <button type="submit" disabled={following} className={btnSecondary}>
                      Crear
                    </button>
                  </div>
                </form>
              </header>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 sm:px-4">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted">Sin mensajes aún.</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cx(
                        "max-w-[min(85%,28rem)] rounded-[12px] px-3 py-2 text-sm",
                        msg.direction === "outbound"
                          ? "ml-auto bg-primary text-on-dark"
                          : "mr-auto bg-subtle text-ink",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                      <p
                        className={cx(
                          "mt-1 text-[10px]",
                          msg.direction === "outbound" ? "text-on-dark/70" : "text-muted",
                        )}
                      >
                        {new Date(msg.createdAt).toLocaleString("es-CO")}
                        {msg.createdBy ? ` · ${msg.createdBy}` : ""}
                        {msg.deliveryStatus ? ` · ${msg.deliveryStatus}` : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <footer className="shrink-0 border-t border-line px-3 py-3 sm:px-4">
                <form action={sendAction} className="space-y-2">
                  <input type="hidden" name="conversationId" value={active.id} />
                  <input type="hidden" name="mode" value="text" />
                  <textarea
                    name="body"
                    rows={2}
                    required
                    placeholder="Escribe un mensaje (ventana 24 h)…"
                    className="w-full resize-none rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-ink"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="submit" disabled={sending} className={btnPrimary}>
                      {sending ? "Enviando…" : "Enviar texto"}
                    </button>
                    <details className="min-w-0 flex-1 basis-full sm:basis-auto">
                      <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-ink">
                        Plantilla Meta (fuera de 24 h)
                      </summary>
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-[minmax(0,1.2fr)_5.5rem_minmax(0,1fr)_auto]">
                        <input name="templateName" placeholder="Nombre plantilla" className={field} />
                        <input name="language" defaultValue="en_US" className={field} />
                        <input name="templateValues" placeholder="Vars | separadas" className={field} />
                        <button
                          type="submit"
                          name="mode"
                          value="template"
                          disabled={sending}
                          className={btnSecondary}
                        >
                          Enviar plantilla
                        </button>
                      </div>
                    </details>
                  </div>
                </form>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
