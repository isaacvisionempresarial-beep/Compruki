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
    <div className="mx-auto max-w-[1400px] pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Operación</p>
          <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Inbox WhatsApp</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Conversaciones Meta Cloud · pipeline CRM · asignación a operadores · acceso {roleLabel}.
          </p>
        </div>
        <Link
          href="/panel/whatsapp"
          className="inline-flex h-9 items-center rounded-[10px] border border-line px-3 text-sm font-semibold hover:bg-subtle"
        >
          Conexión Meta
        </Link>
      </div>

      {feedbackError ? <p className="mt-3 text-sm text-danger">{feedbackError}</p> : null}
      {feedbackOk ? <p className="mt-3 text-sm text-success">{feedbackOk}</p> : null}

      <form action={openAction} className="mt-4 flex flex-wrap gap-2">
        <input
          name="phone"
          required
          placeholder="573001112233"
          className="h-10 min-w-[12rem] flex-1 rounded-[10px] border border-line bg-canvas px-3 text-sm"
        />
        <input
          name="contactName"
          placeholder="Nombre (opcional)"
          className="h-10 min-w-[10rem] flex-1 rounded-[10px] border border-line bg-canvas px-3 text-sm"
        />
        <button
          type="submit"
          disabled={opening}
          className="h-10 rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas disabled:opacity-50"
        >
          {opening ? "Abriendo…" : "Nueva / abrir"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Filtro de conversaciones">
        {(
          [
            ["all", "Todos"],
            ["mine", "Míos"],
            ["unassigned", "Sin asignar"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={cx(
              "h-8 rounded-[10px] border px-3 text-xs font-semibold",
              filter === id ? "border-ink bg-ink text-canvas" : "border-line bg-card text-ink hover:bg-subtle",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(260px,0.95fr)_minmax(0,1.35fr)]">
        <section className="elevate-1 rounded-[14px] border border-line bg-card overflow-hidden">
          <div className="border-b border-line px-3 py-2">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Conversaciones</p>
          </div>
          {visible.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">
              {conversations.length === 0
                ? "Aún no hay chats. Escribe desde un celular o abre uno arriba."
                : "Ninguna conversación en este filtro."}
            </p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto">
              {visible.map((item) => (
                <li key={item.id} className="border-b border-line last:border-b-0">
                  <form action={selectAction}>
                    <input type="hidden" name="conversationId" value={item.id} />
                    <button
                      type="submit"
                      className={cx(
                        "w-full px-3 py-2.5 text-left transition-colors hover:bg-subtle",
                        item.id === activeId ? "bg-accent-tint/60" : "",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-ink">
                          {item.contactName || item.phone}
                        </p>
                        {item.unreadCount > 0 ? (
                          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-primary-dark">
                            {item.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">{item.lastMessagePreview || "—"}</p>
                      <p className="mt-1 text-[10px] font-semibold tracking-[0.06em] text-muted uppercase">
                        {followupStageLabel(item.pipelineStage)} · {assigneeName(item.assignedTo)}
                      </p>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="elevate-1 flex min-h-[28rem] flex-col rounded-[14px] border border-line bg-card">
          {!active ? (
            <p className="m-auto px-4 text-sm text-muted">Elige una conversación.</p>
          ) : (
            <>
              <div className="border-b border-line px-3 py-2">
                <p className="text-sm font-semibold text-ink">{active.contactName || active.phone}</p>
                <p className="text-xs text-muted tabular-nums">{active.phone}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={assignAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="conversationId" value={active.id} />
                    <label className="sr-only" htmlFor="inbox-assignee">
                      Responsable
                    </label>
                    <select
                      id="inbox-assignee"
                      name="assignedTo"
                      defaultValue={active.assignedTo}
                      key={`${active.id}-${active.assignedTo}`}
                      className="h-9 rounded-[10px] border border-line bg-canvas px-2 text-sm"
                    >
                      <option value="">Sin asignar</option>
                      {assignees.map((person) => (
                        <option key={person.userId} value={person.userId}>
                          {person.name || person.email}
                          {person.userId === actorUserId ? " (tú)" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={assigning}
                      className="h-9 rounded-[10px] border border-line px-3 text-sm font-semibold hover:bg-subtle disabled:opacity-50"
                    >
                      Asignar
                    </button>
                  </form>
                  <form action={stageAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="conversationId" value={active.id} />
                    <select
                      name="stage"
                      defaultValue={active.pipelineStage}
                      key={`${active.id}-stage-${active.pipelineStage}`}
                      className="h-9 rounded-[10px] border border-line bg-canvas px-2 text-sm"
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
                      className="h-9 rounded-[10px] border border-line bg-canvas px-2 text-sm"
                    >
                      <option value="open">Abierta</option>
                      <option value="pending">Pendiente</option>
                      <option value="closed">Cerrada</option>
                    </select>
                    <button
                      type="submit"
                      disabled={staging}
                      className="h-9 rounded-[10px] border border-line px-3 text-sm font-semibold hover:bg-subtle disabled:opacity-50"
                    >
                      Guardar etapa
                    </button>
                  </form>
                  <form action={followAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="conversationId" value={active.id} />
                    <input
                      name="note"
                      placeholder="Nota para Clientes"
                      className="h-9 min-w-[10rem] rounded-[10px] border border-line bg-canvas px-2 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={following}
                      className="h-9 rounded-[10px] border border-line px-3 text-sm font-semibold hover:bg-subtle disabled:opacity-50"
                    >
                      Crear seguimiento
                    </button>
                  </form>
                  <Link
                    href="/panel/clientes"
                    className="inline-flex h-9 items-center rounded-[10px] px-2 text-sm font-semibold text-accent-strong hover:underline"
                  >
                    Ver CRM
                  </Link>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted">Sin mensajes aún.</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cx(
                        "max-w-[85%] rounded-[12px] px-3 py-2 text-sm",
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

              <form action={sendAction} className="border-t border-line px-3 py-3 space-y-2">
                <input type="hidden" name="conversationId" value={active.id} />
                <input type="hidden" name="mode" value="text" />
                <textarea
                  name="body"
                  rows={2}
                  required
                  placeholder="Escribe un mensaje (ventana 24 h)…"
                  className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm"
                />
                <div className="grid gap-2 sm:grid-cols-[1fr_7rem_1fr_auto]">
                  <input
                    name="templateName"
                    placeholder="Plantilla (opcional)"
                    className="h-9 rounded-[10px] border border-line bg-canvas px-2 text-sm"
                  />
                  <input
                    name="language"
                    defaultValue="en_US"
                    className="h-9 rounded-[10px] border border-line bg-canvas px-2 text-sm"
                  />
                  <input
                    name="templateValues"
                    placeholder="Vars | separadas"
                    className="h-9 rounded-[10px] border border-line bg-canvas px-2 text-sm"
                  />
                  <button
                    type="submit"
                    name="mode"
                    value="template"
                    disabled={sending}
                    className="h-9 rounded-[10px] border border-line px-3 text-sm font-semibold hover:bg-subtle disabled:opacity-50"
                  >
                    Plantilla
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="h-10 w-full rounded-[10px] bg-ink text-sm font-semibold text-canvas disabled:opacity-50 sm:w-auto sm:px-5"
                >
                  {sending ? "Enviando…" : "Enviar texto"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
