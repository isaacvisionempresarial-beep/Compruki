"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  FOLLOWUP_OPEN_STAGES,
  followupStageLabel,
  type FollowupStageId,
} from "@/lib/crm-pipeline";
import { cx } from "@/lib/cx";
import {
  assignInboxConversationAction,
  createFollowupFromInboxAction,
  markAllInboxReadAction,
  openInboxByPhoneAction,
  selectInboxConversationAction,
  sendInboxMessageAction,
  updateInboxStageAction,
  type InboxActionState,
  type InboxAssignee,
  type InboxTemplateOption,
} from "@/server/whatsapp-inbox-actions";
import type { InboxConversation, InboxMessage } from "@/server/whatsapp-inbox";

const empty: InboxActionState = {
  error: null,
  ok: null,
  conversations: [],
  activeId: null,
  messages: [],
};

type FilterId = "all" | "mine" | "unassigned" | "unread";
type StageFilter = "all" | FollowupStageId;

const ctrl =
  "h-8 rounded-[8px] border border-line bg-canvas px-2 text-xs text-ink outline-none focus:border-ink";
const btn =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-[8px] border border-line bg-card px-2.5 text-xs font-semibold text-ink hover:bg-subtle disabled:opacity-50";
const btnDark =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-[8px] bg-ink px-2.5 text-xs font-semibold text-canvas disabled:opacity-50";

export function InboxScreen({
  tableReady,
  initialConversations,
  initialActiveId,
  initialMessages,
  assignees,
  templates = [],
  actorUserId,
  roleLabel,
  bootError,
  initialFilter = "all",
}: {
  tableReady: boolean;
  initialConversations: InboxConversation[];
  initialActiveId: string | null;
  initialMessages: InboxMessage[];
  assignees: InboxAssignee[];
  templates?: InboxTemplateOption[];
  actorUserId: string;
  roleLabel: string;
  bootError: string | null;
  initialFilter?: FilterId;
}) {
  const [selectState, selectAction] = useActionState(selectInboxConversationAction, empty);
  const [sendState, sendAction, sending] = useActionState(sendInboxMessageAction, empty);
  const [stageState, stageAction, staging] = useActionState(updateInboxStageAction, empty);
  const [assignState, assignAction, assigning] = useActionState(assignInboxConversationAction, empty);
  const [followState, followAction, following] = useActionState(createFollowupFromInboxAction, empty);
  const [openState, openAction, opening] = useActionState(openInboxByPhoneAction, empty);
  const [readState, readAction, markingRead] = useActionState(markAllInboxReadAction, empty);
  const [filter, setFilter] = useState<FilterId>(initialFilter);
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [query, setQuery] = useState("");
  const defaultTemplateKey = templates[0] ? `${templates[0].name}::${templates[0].language}` : "";
  const [templateKey, setTemplateKey] = useState(defaultTemplateKey);
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, 25_000);
    return () => window.clearInterval(id);
  }, [router]);

  const selectedTemplate = useMemo(() => {
    if (!templateKey) return null;
    const [name, language] = templateKey.split("::");
    return templates.find((item) => item.name === name && item.language === language) ?? null;
  }, [templateKey, templates]);

  const conversations =
    openState.conversations.length ||
    sendState.conversations.length ||
    stageState.conversations.length ||
    assignState.conversations.length ||
    followState.conversations.length ||
    readState.conversations.length ||
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
                : readState.conversations.length
                  ? readState.conversations
                  : selectState.conversations
      : initialConversations;

  const activeId =
    openState.activeId ||
    sendState.activeId ||
    stageState.activeId ||
    assignState.activeId ||
    followState.activeId ||
    readState.activeId ||
    selectState.activeId ||
    initialActiveId;

  const messages =
    (openState.activeId && openState.messages) ||
    (sendState.activeId && sendState.messages) ||
    (stageState.activeId && stageState.messages) ||
    (assignState.activeId && assignState.messages) ||
    (followState.activeId && followState.messages) ||
    (readState.activeId && readState.messages) ||
    (selectState.activeId && selectState.messages) ||
    initialMessages;

  const assigneeName = useMemo(() => {
    const map = new Map(assignees.map((item) => [item.userId, item.name || item.email]));
    return (userId: string) => (userId ? map.get(userId) || "Asignado" : "Libre");
  }, [assignees]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, item) => sum + (item.unreadCount > 0 ? item.unreadCount : 0), 0),
    [conversations],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "");
    return conversations.filter((item) => {
      if (filter === "mine" && item.assignedTo !== actorUserId) return false;
      if (filter === "unassigned" && item.assignedTo) return false;
      if (filter === "unread" && item.unreadCount <= 0) return false;
      if (stageFilter !== "all" && item.pipelineStage !== stageFilter) return false;
      if (!q) return true;
      const hay = `${item.contactName} ${item.phone} ${item.lastMessagePreview}`.toLowerCase();
      return hay.includes(q) || item.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""));
    });
  }, [conversations, filter, stageFilter, actorUserId, query]);

  const active = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? null,
    [conversations, activeId],
  );

  const threadRef = useRef<HTMLDivElement>(null);
  const [composerKey, setComposerKey] = useState(0);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeId, messages]);

  useEffect(() => {
    if (sendState.ok) setComposerKey((n) => n + 1);
  }, [sendState.ok, sendState.messages.length]);

  const feedbackError =
    sendState.error ||
    bootError ||
    openState.error ||
    stageState.error ||
    assignState.error ||
    followState.error ||
    readState.error ||
    selectState.error;
  const feedbackOk =
    sendState.ok || openState.ok || stageState.ok || assignState.ok || followState.ok || readState.ok;

  function deliveryLabel(status: string) {
    const s = status.toLowerCase();
    if (s === "sent") return "enviado";
    if (s === "delivered") return "entregado";
    if (s === "read") return "leído";
    if (s === "failed") return "falló";
    return status;
  }

  if (!tableReady) {
    return (
      <div className="mx-auto max-w-[900px] pb-6">
        <h1 className="text-xl font-extrabold tracking-tight">Inbox WhatsApp</h1>
        <p role="status" className="mt-3 rounded-[10px] bg-warning-tint px-3 py-2 text-sm text-warning">
          Falta <code className="text-ink">021_whatsapp_inbox_crm.sql</code> en Supabase.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-2 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl leading-6 font-extrabold tracking-tight">Inbox WhatsApp</h1>
          <p className="text-xs text-muted">Meta · CRM · {roleLabel}</p>
        </div>
        <Link href="/panel/whatsapp" className={btn}>
          Conexión
        </Link>
      </div>

      {feedbackError && !sendState.error ? (
        <p className="text-xs text-danger">{feedbackError}</p>
      ) : null}
      {feedbackOk && !sendState.ok ? <p className="text-xs text-success">{feedbackOk}</p> : null}

      <div className="grid min-h-[min(78vh,42rem)] gap-2 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="elevate-1 flex min-h-0 flex-col overflow-hidden rounded-[12px] border border-line bg-card">
          <div className="shrink-0 space-y-1.5 border-b border-line p-2">
            <form action={openAction} className="flex gap-1">
              <input
                name="phone"
                required
                placeholder="Celular"
                aria-label="Celular"
                className={cx(ctrl, "min-w-0 flex-1")}
              />
              <input type="hidden" name="contactName" value="" />
              <button type="submit" disabled={opening} className={btnDark} title="Abrir chat">
                {opening ? "…" : "+"}
              </button>
            </form>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar nombre o celular…"
              aria-label="Buscar conversaciones"
              className={cx(ctrl, "w-full")}
            />
            <div className="grid grid-cols-4 gap-0.5" role="tablist" aria-label="Filtro">
              {(
                [
                  ["all", "Todos"],
                  ["mine", "Míos"],
                  ["unassigned", "Libres"],
                  ["unread", "Nuevos"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => setFilter(id)}
                  className={cx(
                    "h-7 rounded-[6px] text-[10px] font-semibold",
                    filter === id ? "bg-ink text-canvas" : "bg-subtle text-muted hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              aria-label="Filtrar por etapa"
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value as StageFilter)}
              className={cx(ctrl, "w-full")}
            >
              <option value="all">Todas las etapas</option>
              {FOLLOWUP_OPEN_STAGES.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
            {unreadTotal > 0 ? (
              <form action={readAction}>
                <button type="submit" disabled={markingRead} className={cx(btn, "w-full")}>
                  {markingRead ? "…" : `Marcar leídos (${unreadTotal})`}
                </button>
              </form>
            ) : null}
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <li className="px-2.5 py-3 text-[11px] text-muted">
                {conversations.length === 0 ? "Sin chats." : "Nada con esa búsqueda/filtro."}
              </li>
            ) : (
              visible.map((item) => (
                <li key={item.id} className="border-b border-line/80 last:border-0">
                  <form action={selectAction}>
                    <input type="hidden" name="conversationId" value={item.id} />
                    <button
                      type="submit"
                      className={cx(
                        "w-full px-2.5 py-1.5 text-left hover:bg-subtle",
                        item.id === activeId ? "bg-accent-tint/45" : "",
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-[13px] font-semibold text-ink">
                          {item.contactName || item.phone}
                        </span>
                        {item.unreadCount > 0 ? (
                          <span className="rounded-full bg-accent px-1 text-[10px] font-bold text-primary-dark">
                            {item.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-[11px] leading-4 text-muted">
                        {item.lastMessagePreview || "—"}
                      </p>
                      <p className="truncate text-[9px] font-semibold tracking-wide text-muted uppercase">
                        {followupStageLabel(item.pipelineStage)} · {assigneeName(item.assignedTo)}
                      </p>
                    </button>
                  </form>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="elevate-1 flex min-h-0 flex-col overflow-hidden rounded-[12px] border border-line bg-card">
          {!active ? (
            <p className="m-auto px-4 text-sm text-muted">Elige un chat.</p>
          ) : (
            <>
              <header className="shrink-0 border-b border-line px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {active.contactName || active.phone}
                      <span className="ml-2 font-normal text-muted tabular-nums">{active.phone}</span>
                    </p>
                  </div>
                  <Link
                    href="/panel/clientes"
                    className="shrink-0 text-xs font-semibold text-accent-strong hover:underline"
                  >
                    CRM
                  </Link>
                </div>

                {/* Barra CRM en una sola franja */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <form action={assignAction} className="flex items-center gap-1">
                    <input type="hidden" name="conversationId" value={active.id} />
                    <select
                      name="assignedTo"
                      defaultValue={active.assignedTo}
                      key={`${active.id}-a-${active.assignedTo}`}
                      aria-label="Responsable"
                      title="Responsable"
                      className={cx(ctrl, "max-w-[9.5rem]")}
                    >
                      <option value="">Sin asignar</option>
                      {assignees.map((person) => (
                        <option key={person.userId} value={person.userId}>
                          {person.name || person.email}
                          {person.userId === actorUserId ? " (tú)" : ""}
                        </option>
                      ))}
                    </select>
                    <button type="submit" disabled={assigning} className={btn}>
                      Asignar
                    </button>
                  </form>
                  {active.assignedTo !== actorUserId ? (
                    <form action={assignAction}>
                      <input type="hidden" name="conversationId" value={active.id} />
                      <input type="hidden" name="assignedTo" value={actorUserId} />
                      <button
                        type="submit"
                        disabled={assigning}
                        className={btnDark}
                        title="Asignarme este chat y su seguimiento CRM"
                      >
                        Tomar
                      </button>
                    </form>
                  ) : null}

                  <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />

                  <form action={stageAction} className="flex items-center gap-1">
                    <input type="hidden" name="conversationId" value={active.id} />
                    <select
                      name="stage"
                      defaultValue={active.pipelineStage}
                      key={`${active.id}-s-${active.pipelineStage}`}
                      aria-label="Etapa"
                      title="Etapa CRM"
                      className={cx(ctrl, "w-[7.25rem]")}
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
                      key={`${active.id}-st-${active.status}`}
                      aria-label="Estado"
                      title="Estado del chat"
                      className={cx(ctrl, "w-[6.5rem]")}
                    >
                      <option value="open">Abierta</option>
                      <option value="pending">Pendiente</option>
                      <option value="closed">Cerrada</option>
                    </select>
                    <button type="submit" disabled={staging} className={btn}>
                      Guardar
                    </button>
                  </form>

                  <span className="hidden h-4 w-px bg-line md:block" aria-hidden />

                  <form action={followAction} className="flex min-w-[12rem] flex-1 items-center gap-1">
                    <input type="hidden" name="conversationId" value={active.id} />
                    <input
                      name="note"
                      placeholder="Nota CRM…"
                      aria-label="Nota para seguimiento"
                      className={cx(ctrl, "min-w-0 flex-1")}
                    />
                    <button type="submit" disabled={following} className={btn}>
                      + Seg.
                    </button>
                  </form>
                </div>
              </header>

              <div
                ref={threadRef}
                className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-canvas/40 px-2.5 py-2.5"
              >
                {messages.length === 0 ? (
                  <p className="text-xs text-muted">Sin mensajes. Escribe abajo o manda una plantilla.</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cx(
                        "max-w-[min(88%,26rem)] rounded-[10px] px-2.5 py-1.5 text-[13px] leading-snug",
                        msg.direction === "outbound"
                          ? "ml-auto bg-primary text-on-dark"
                          : "mr-auto bg-card text-ink shadow-[0_0_0_1px_var(--color-line)]",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                      <p
                        className={cx(
                          "mt-0.5 text-[9px]",
                          msg.direction === "outbound" ? "text-on-dark/65" : "text-muted",
                        )}
                      >
                        {new Date(msg.createdAt).toLocaleString("es-CO", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {msg.deliveryStatus ? ` · ${deliveryLabel(msg.deliveryStatus)}` : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <footer className="shrink-0 border-t border-line bg-card px-2.5 py-2">
                <form action={sendAction} className="flex flex-col gap-1.5">
                  <input type="hidden" name="conversationId" value={active.id} />
                  <input type="hidden" name="mode" value="text" />
                  <div className="flex gap-1.5">
                    <textarea
                      key={`body-${active.id}-${composerKey}`}
                      name="body"
                      rows={1}
                      placeholder="Mensaje… (Enter envía, Shift+Enter salto)"
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" || event.shiftKey) return;
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }}
                      className="min-h-8 max-h-24 flex-1 resize-y rounded-[8px] border border-line bg-canvas px-2.5 py-1.5 text-sm outline-none focus:border-ink"
                    />
                    <button type="submit" disabled={sending} className={btnDark}>
                      {sending ? "…" : "Enviar"}
                    </button>
                  </div>
                  {sendState.error ? (
                    <p className="text-[11px] leading-4 text-danger">{sendState.error}</p>
                  ) : null}
                  {sendState.ok ? (
                    <p className="text-[11px] leading-4 text-success">{sendState.ok}</p>
                  ) : null}
                  <details className="text-xs text-muted">
                    <summary className="cursor-pointer font-semibold hover:text-ink">
                      Plantilla Meta{templates.length ? ` (${templates.length})` : ""}
                    </summary>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {templates.length > 0 ? (
                        <>
                          <select
                            aria-label="Plantilla aprobada"
                            value={templateKey}
                            onChange={(event) => setTemplateKey(event.target.value)}
                            className={cx(ctrl, "min-w-[12rem] flex-1")}
                          >
                            {templates.map((item) => (
                              <option key={`${item.name}-${item.language}`} value={`${item.name}::${item.language}`}>
                                {item.name} · {item.language}
                                {item.category ? ` · ${item.category}` : ""}
                              </option>
                            ))}
                          </select>
                          <input type="hidden" name="templateName" value={selectedTemplate?.name || ""} />
                          <input type="hidden" name="language" value={selectedTemplate?.language || "en_US"} />
                        </>
                      ) : (
                        <>
                          <input name="templateName" placeholder="Nombre" className={cx(ctrl, "w-[8rem]")} />
                          <input name="language" defaultValue="en_US" className={cx(ctrl, "w-[4.5rem]")} />
                        </>
                      )}
                      <input
                        name="templateValues"
                        placeholder="Vars |"
                        className={cx(ctrl, "min-w-[6rem] flex-1")}
                      />
                      <button type="submit" name="mode" value="template" disabled={sending} className={btn}>
                        Enviar plantilla
                      </button>
                    </div>
                    {templates.length === 0 ? (
                      <p className="mt-1 text-[11px] text-muted">
                        Sin plantillas listadas aún. Escribe el nombre aprobado en Meta (ej. hello_world).
                      </p>
                    ) : null}
                  </details>
                </form>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
