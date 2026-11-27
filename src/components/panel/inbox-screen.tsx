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
import { formatRelativeShort } from "@/lib/format";
import { fillInboxQuickReply, INBOX_QUICK_REPLIES } from "@/lib/inbox-quick-replies";
import {
  assignInboxConversationAction,
  createFollowupFromInboxAction,
  markAllInboxReadAction,
  openInboxByPhoneAction,
  renameInboxContactAction,
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

type FilterId = "all" | "mine" | "unassigned" | "unread" | "awaiting";
type StageFilter = "all" | FollowupStageId;

const ctrl =
  "h-7 rounded-[6px] border border-line bg-canvas px-1.5 text-[11px] text-ink outline-none focus:border-ink";
const btn =
  "inline-flex h-7 shrink-0 items-center justify-center rounded-[6px] border border-line bg-card px-2 text-[11px] font-semibold text-ink hover:bg-subtle disabled:opacity-50";
const btnDark =
  "inline-flex h-7 shrink-0 items-center justify-center rounded-[6px] bg-ink px-2 text-[11px] font-semibold text-canvas disabled:opacity-50";
const btnIconDark =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-ink text-[12px] font-bold text-canvas disabled:opacity-50";

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
  const [renameState, renameAction, renaming] = useActionState(renameInboxContactAction, empty);
  const [filter, setFilter] = useState<FilterId>(initialFilter);
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [query, setQuery] = useState("");
  const defaultTemplateKey = templates[0] ? `${templates[0].name}::${templates[0].language}` : "";
  const [templateKey, setTemplateKey] = useState(defaultTemplateKey);
  const [templateVarValues, setTemplateVarValues] = useState<Record<string, string>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());
  const router = useRouter();

  useEffect(() => {
    if (!defaultTemplateKey) return;
    setTemplateKey((current) => current || defaultTemplateKey);
  }, [defaultTemplateKey]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (filter === "all") url.searchParams.delete("f");
    else url.searchParams.set("f", filter);
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(null, "", next);
  }, [filter]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, 25_000);
    return () => window.clearInterval(id);
  }, [router]);

  // Tras enviar, refresca seguido para ver ✓✓ entregado/leído.
  useEffect(() => {
    if (!sendState.ok) return;
    const timers = [2_000, 5_000, 10_000, 18_000].map((ms) =>
      window.setTimeout(() => router.refresh(), ms),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [sendState.ok, sendState.messages.length, router]);

  const selectedTemplate = useMemo(() => {
    if (!templateKey) return null;
    const [name, language] = templateKey.split("::");
    return templates.find((item) => item.name === name && item.language === language) ?? null;
  }, [templateKey, templates]);

  const templatePositions = useMemo(() => {
    const body = selectedTemplate?.body || "";
    return [
      ...new Set([...body.matchAll(/{{(\d+)}}/g)].map((match) => Number(match[1]))),
    ].sort((a, b) => a - b);
  }, [selectedTemplate]);

  const templateValuesJoined = useMemo(() => {
    if (!templatePositions.length) return "";
    return templatePositions.map((position) => templateVarValues[String(position)]?.trim() || "").join("|");
  }, [templatePositions, templateVarValues]);

  // Última acción gana: antes sendState “pegaba” el hilo y no dejaba cambiar de chat.
  const [bundle, setBundle] = useState({
    conversations: initialConversations,
    activeId: initialActiveId,
    messages: initialMessages,
  });

  useEffect(() => {
    if (!selectState.activeId && !selectState.conversations.length) return;
    setBundle((prev) => ({
      conversations: selectState.conversations.length ? selectState.conversations : prev.conversations,
      activeId: selectState.activeId,
      messages: selectState.messages,
    }));
  }, [selectState]);

  useEffect(() => {
    if (!sendState.activeId && !sendState.ok && !sendState.error) return;
    setBundle((prev) => ({
      conversations: sendState.conversations.length ? sendState.conversations : prev.conversations,
      activeId: sendState.activeId || prev.activeId,
      messages: sendState.activeId ? sendState.messages : prev.messages,
    }));
  }, [sendState]);

  useEffect(() => {
    if (!stageState.activeId && !stageState.ok && !stageState.error) return;
    setBundle((prev) => ({
      conversations: stageState.conversations.length ? stageState.conversations : prev.conversations,
      activeId: stageState.activeId || prev.activeId,
      messages: stageState.activeId ? stageState.messages : prev.messages,
    }));
  }, [stageState]);

  useEffect(() => {
    if (!assignState.activeId && !assignState.ok && !assignState.error) return;
    setBundle((prev) => ({
      conversations: assignState.conversations.length ? assignState.conversations : prev.conversations,
      activeId: assignState.activeId || prev.activeId,
      messages: assignState.activeId ? assignState.messages : prev.messages,
    }));
  }, [assignState]);

  useEffect(() => {
    if (!followState.activeId && !followState.ok && !followState.error) return;
    setBundle((prev) => ({
      conversations: followState.conversations.length ? followState.conversations : prev.conversations,
      activeId: followState.activeId || prev.activeId,
      messages: followState.activeId ? followState.messages : prev.messages,
    }));
  }, [followState]);

  useEffect(() => {
    if (!renameState.activeId && !renameState.ok && !renameState.error) return;
    setBundle((prev) => ({
      conversations: renameState.conversations.length ? renameState.conversations : prev.conversations,
      activeId: renameState.activeId || prev.activeId,
      messages: renameState.activeId ? renameState.messages : prev.messages,
    }));
  }, [renameState]);

  useEffect(() => {
    if (!openState.activeId && !openState.ok && !openState.error) return;
    setBundle((prev) => ({
      conversations: openState.conversations.length ? openState.conversations : prev.conversations,
      activeId: openState.activeId,
      messages: openState.messages,
    }));
  }, [openState]);

  useEffect(() => {
    if (!readState.ok && !readState.error && !readState.conversations.length) return;
    setBundle((prev) => ({
      conversations: readState.conversations.length ? readState.conversations : prev.conversations,
      activeId: readState.activeId || prev.activeId,
      messages: readState.activeId ? readState.messages : prev.messages,
    }));
  }, [readState]);

  useEffect(() => {
    setBundle((prev) => ({
      conversations: initialConversations,
      activeId: prev.activeId || initialActiveId,
      messages:
        prev.activeId && prev.activeId === initialActiveId ? initialMessages : prev.messages,
    }));
  }, [initialConversations, initialMessages, initialActiveId]);

  const conversations = bundle.conversations;
  const activeId = bundle.activeId;
  const messages = bundle.messages;

  const assigneeName = useMemo(() => {
    const map = new Map(assignees.map((item) => [item.userId, item.name || item.email]));
    return (userId: string) => (userId ? map.get(userId) || "Asignado" : "Libre");
  }, [assignees]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, item) => sum + (item.unreadCount > 0 ? item.unreadCount : 0), 0),
    [conversations],
  );

  const filterCounts = useMemo(() => {
    let mine = 0;
    let unassigned = 0;
    let unread = 0;
    let awaiting = 0;
    for (const item of conversations) {
      if (item.assignedTo === actorUserId) mine += 1;
      if (!item.assignedTo && item.status !== "closed") unassigned += 1;
      if (item.unreadCount > 0) unread += 1;
      if (item.lastDirection === "inbound" && item.status !== "closed") awaiting += 1;
    }
    return {
      all: conversations.length,
      mine,
      unassigned,
      unread,
      awaiting,
    } satisfies Record<FilterId, number>;
  }, [conversations, actorUserId]);

  useEffect(() => {
    const base = "Inbox WhatsApp";
    document.title = unreadTotal > 0 ? `(${unreadTotal}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [unreadTotal]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "");
    return conversations.filter((item) => {
      if (filter === "mine" && item.assignedTo !== actorUserId) return false;
      if (filter === "unassigned" && item.assignedTo) return false;
      if (filter === "unread" && item.unreadCount <= 0) return false;
      if (filter === "awaiting" && item.lastDirection !== "inbound") return false;
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

  useEffect(() => {
    const firstName =
      (active?.contactName || "").trim().split(/\s+/).filter(Boolean)[0] || "";
    setTemplateVarValues((prev) => {
      const next: Record<string, string> = {};
      for (const position of templatePositions) {
        const key = String(position);
        if (prev[key]?.trim()) next[key] = prev[key];
        else if (position === 1 && firstName && !/^\d+$/.test(firstName)) next[key] = firstName;
        else next[key] = "";
      }
      return next;
    });
  }, [templateKey, selectedTemplate?.body, active?.contactName, templatePositions]);

  const threadRef = useRef<HTMLDivElement>(null);
  const [composerKey, setComposerKey] = useState(0);
  const [draft, setDraft] = useState("");
  const [showFailed, setShowFailed] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);

  const failedCount = useMemo(
    () =>
      messages.filter((msg) => msg.direction === "outbound" && msg.deliveryStatus === "failed")
        .length,
    [messages],
  );

  const threadMessages = useMemo(() => {
    if (showFailed || failedCount === 0) return messages;
    return messages.filter(
      (msg) => !(msg.direction === "outbound" && msg.deliveryStatus === "failed"),
    );
  }, [messages, showFailed, failedCount]);

  useEffect(() => {
    setShowFailed(false);
    setPhoneCopied(false);
  }, [activeId]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeId, threadMessages]);

  useEffect(() => {
    if (sendState.ok) setComposerKey((n) => n + 1);
  }, [sendState.ok, sendState.messages.length]);

  useEffect(() => {
    setDraft("");
  }, [activeId, composerKey]);

  const feedbackError =
    sendState.error ||
    bootError ||
    openState.error ||
    stageState.error ||
    assignState.error ||
    renameState.error ||
    followState.error ||
    readState.error ||
    selectState.error;
  const feedbackOk =
    sendState.ok ||
    openState.ok ||
    stageState.ok ||
    assignState.ok ||
    renameState.ok ||
    followState.ok ||
    readState.ok;

  function deliveryMark(status: string, outbound: boolean, detail = "") {
    if (!outbound) return null;
    const s = status.toLowerCase();
    if (s === "failed") {
      return {
        text: "!",
        title: detail || "Falló el envío",
        className: "text-[#fecaca]",
      };
    }
    if (s === "read") return { text: "✓✓", title: "Leído", className: "text-[#7dd3fc]" };
    if (s === "delivered") return { text: "✓✓", title: "Entregado", className: "text-on-dark/70" };
    if (s === "sent") return { text: "✓", title: "Enviado a Meta…", className: "text-on-dark/55" };
    return status ? { text: status, title: status, className: "text-on-dark/55" } : null;
  }

  const customerWindow = useMemo(() => {
    const lastInbound = [...messages].reverse().find((msg) => msg.direction === "inbound");
    if (!lastInbound) return { open: false, leftLabel: "", urgent: false };
    const endsAt = new Date(lastInbound.createdAt).getTime() + 24 * 60 * 60 * 1000;
    const leftMs = endsAt - nowTick;
    if (!Number.isFinite(leftMs) || leftMs <= 0) {
      return { open: false, leftLabel: "", urgent: false };
    }
    const hours = Math.floor(leftMs / 3_600_000);
    const mins = Math.floor((leftMs % 3_600_000) / 60_000);
    const leftLabel = hours > 0 ? `${hours}h ${mins}m` : `${Math.max(1, mins)}m`;
    return { open: true, leftLabel, urgent: leftMs < 2 * 3_600_000 };
  }, [messages, nowTick]);
  const withinCustomerWindow = customerWindow.open;

  async function copyActivePhone() {
    if (!active?.phone) return;
    try {
      await navigator.clipboard.writeText(active.phone);
      setPhoneCopied(true);
      window.setTimeout(() => setPhoneCopied(false), 1600);
    } catch {
      setPhoneCopied(false);
    }
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
          <div className="shrink-0 space-y-1 border-b border-line p-1.5">
            <form action={openAction} className="flex items-center gap-1">
              <input
                name="phone"
                required
                placeholder="Celular"
                aria-label="Celular"
                className={cx(ctrl, "min-w-0 flex-1")}
              />
              <input type="hidden" name="contactName" value="" />
              <button
                type="submit"
                disabled={opening}
                className={btnIconDark}
                title="Abrir chat"
                aria-label="Abrir chat"
              >
                {opening ? "…" : "+"}
              </button>
            </form>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar…"
              aria-label="Buscar conversaciones"
              className={cx(ctrl, "w-full")}
            />
            <div className="grid grid-cols-5 gap-0.5" role="tablist" aria-label="Filtro">
              {(
                [
                  ["all", "Todos", "Todos"],
                  ["mine", "Míos", "Míos"],
                  ["unassigned", "Libres", "Sin asignar"],
                  ["unread", "Nuevos", "No leídos"],
                  ["awaiting", "Resp.", "Por responder"],
                ] as const
              ).map(([id, label, title]) => {
                const count = filterCounts[id];
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={filter === id}
                    onClick={() => setFilter(id)}
                    title={count > 0 ? `${title} (${count})` : title}
                    className={cx(
                      "flex h-6 flex-col items-center justify-center rounded-[5px] leading-none",
                      filter === id ? "bg-ink text-canvas" : "bg-subtle text-muted hover:text-ink",
                    )}
                  >
                    <span className="text-[9px] font-semibold">{label}</span>
                    {count > 0 ? (
                      <span
                        className={cx(
                          "text-[8px] font-bold tabular-nums",
                          filter === id ? "text-canvas/80" : "text-muted",
                        )}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
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
                  {markingRead ? "…" : `Leídos (${unreadTotal})`}
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
              visible.map((item) => {
                const awaiting =
                  item.lastDirection === "inbound" && item.status !== "closed";
                return (
                  <li key={item.id} className="border-b border-line/80 last:border-0">
                    <form action={selectAction}>
                      <input type="hidden" name="conversationId" value={item.id} />
                      <button
                        type="submit"
                        onClick={() =>
                          setBundle((prev) => ({
                            ...prev,
                            activeId: item.id,
                            messages: prev.activeId === item.id ? prev.messages : [],
                            conversations: prev.conversations.map((row) =>
                              row.id === item.id ? { ...row, unreadCount: 0 } : row,
                            ),
                          }))
                        }
                        className={cx(
                          "w-full border-l-2 px-2.5 py-1.5 text-left hover:bg-subtle",
                          item.id === activeId
                            ? "border-l-accent bg-accent-tint/45"
                            : awaiting
                              ? "border-l-warning bg-warning-tint/40"
                              : "border-l-transparent",
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-[13px] font-semibold text-ink">
                            {item.contactName || item.phone}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            {awaiting && item.id !== activeId ? (
                              <span className="rounded-[4px] bg-warning-tint px-1 text-[9px] font-bold text-warning">
                                Resp.
                              </span>
                            ) : null}
                            {item.unreadCount > 0 ? (
                              <span className="rounded-full bg-accent px-1 text-[10px] font-bold text-primary-dark">
                                {item.unreadCount}
                              </span>
                            ) : null}
                            {item.lastMessageAt ? (
                              <span
                                className="text-[9px] font-semibold text-muted tabular-nums"
                                title={item.lastMessageAt}
                              >
                                {formatRelativeShort(item.lastMessageAt, nowTick)}
                              </span>
                            ) : null}
                          </span>
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
                );
              })
            )}
          </ul>
        </aside>

        <section className="elevate-1 flex min-h-0 flex-col overflow-hidden rounded-[12px] border border-line bg-card">
          {!active ? (
            <p className="m-auto px-4 text-sm text-muted">Elige un chat.</p>
          ) : (
            <>
              <header className="shrink-0 space-y-1 border-b border-line px-2 py-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  <form
                    action={renameAction}
                    className="flex min-w-0 items-center gap-1"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        event.currentTarget.requestSubmit();
                      }
                    }}
                  >
                    <input type="hidden" name="conversationId" value={active.id} />
                    <input
                      name="contactName"
                      defaultValue={active.contactName}
                      key={`${active.id}-name-${active.contactName}`}
                      placeholder="Nombre"
                      aria-label="Nombre del contacto"
                      maxLength={80}
                      disabled={renaming}
                      className={cx(ctrl, "w-[9.5rem] font-semibold sm:w-[12rem]")}
                    />
                  </form>
                  <button
                    type="button"
                    onClick={() => void copyActivePhone()}
                    title="Copiar celular"
                    className="truncate text-[11px] text-muted tabular-nums hover:text-ink hover:underline"
                  >
                    {active.phone}
                  </button>
                  {phoneCopied ? (
                    <span className="text-[10px] font-semibold text-success">Copiado</span>
                  ) : null}
                  {(assigning || staging || renaming) && (
                    <span className="text-[10px] text-muted">Guardando…</span>
                  )}
                  <Link
                    href="/panel/clientes"
                    className="ml-auto shrink-0 text-[11px] font-semibold text-accent-strong hover:underline"
                  >
                    CRM
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <form action={assignAction} className="flex items-center gap-1">
                    <input type="hidden" name="conversationId" value={active.id} />
                    <select
                      name="assignedTo"
                      defaultValue={active.assignedTo}
                      key={`${active.id}-a-${active.assignedTo}`}
                      aria-label="Responsable"
                      title="Responsable"
                      disabled={assigning}
                      className={cx(ctrl, "w-[8.5rem]")}
                      onChange={(event) => event.currentTarget.form?.requestSubmit()}
                    >
                      <option value="">Sin asignar</option>
                      {assignees.map((person) => (
                        <option key={person.userId} value={person.userId}>
                          {person.name || person.email}
                          {person.userId === actorUserId ? " (tú)" : ""}
                        </option>
                      ))}
                    </select>
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
                        Mío
                      </button>
                    </form>
                  ) : null}

                  <form action={stageAction} className="flex items-center gap-1">
                    <input type="hidden" name="conversationId" value={active.id} />
                    <select
                      name="stage"
                      defaultValue={active.pipelineStage}
                      key={`${active.id}-s-${active.pipelineStage}`}
                      aria-label="Etapa"
                      title="Etapa CRM"
                      disabled={staging}
                      className={cx(ctrl, "w-[6.5rem]")}
                      onChange={(event) => event.currentTarget.form?.requestSubmit()}
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
                      disabled={staging}
                      className={cx(ctrl, "w-[5.5rem]")}
                      onChange={(event) => event.currentTarget.form?.requestSubmit()}
                    >
                      <option value="open">Abierta</option>
                      <option value="pending">Pendiente</option>
                      <option value="closed">Cerrada</option>
                    </select>
                  </form>

                  <form action={followAction} className="flex min-w-0 flex-1 items-center gap-1">
                    <input type="hidden" name="conversationId" value={active.id} />
                    <input
                      name="note"
                      placeholder="Nota…"
                      aria-label="Nota para seguimiento"
                      className={cx(ctrl, "min-w-[6rem] flex-1")}
                    />
                    <button type="submit" disabled={following} className={btn} title="Crear seguimiento">
                      {following ? "…" : "+"}
                    </button>
                  </form>
                </div>
              </header>

              <div
                ref={threadRef}
                className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-canvas/40 px-2.5 py-2.5"
              >
                {failedCount > 0 ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-muted hover:text-ink"
                    onClick={() => setShowFailed((value) => !value)}
                  >
                    {showFailed
                      ? "Ocultar mensajes fallidos"
                      : `Mostrar ${failedCount} fallido(s)`}
                  </button>
                ) : null}
                {threadMessages.length === 0 ? (
                  <p className="text-xs text-muted">
                    {messages.length > 0
                      ? "Solo hay fallidos ocultos. Muestra fallidos o envía una plantilla."
                      : "Sin mensajes. Escribe abajo o manda una plantilla."}
                  </p>
                ) : (
                  threadMessages.map((msg) => {
                    const failed = msg.direction === "outbound" && msg.deliveryStatus === "failed";
                    const mark = deliveryMark(
                      msg.deliveryStatus,
                      msg.direction === "outbound",
                      msg.deliveryDetail,
                    );
                    return (
                      <div
                        key={msg.id}
                        className={cx(
                          "max-w-[min(88%,26rem)] rounded-[10px] px-2.5 py-1.5 text-[13px] leading-snug",
                          msg.direction === "outbound"
                            ? failed
                              ? "ml-auto bg-[#7f1d1d] text-on-dark"
                              : "ml-auto bg-primary text-on-dark"
                            : "mr-auto bg-card text-ink shadow-[0_0_0_1px_var(--color-line)]",
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                        {failed && msg.deliveryDetail ? (
                          <p className="mt-1 text-[11px] leading-4 text-[#fecaca]">{msg.deliveryDetail}</p>
                        ) : null}
                        <p
                          className={cx(
                            "mt-0.5 flex items-center gap-1 text-[9px]",
                            msg.direction === "outbound"
                              ? "justify-end text-on-dark/65"
                              : "text-muted",
                          )}
                        >
                          <span>
                            {new Date(msg.createdAt).toLocaleString("es-CO", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {mark ? (
                            <span
                              className={cx("font-semibold tracking-tight", mark.className)}
                              title={mark.title}
                            >
                              {mark.text}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              <footer className="shrink-0 border-t border-line bg-card px-2.5 py-2">
                {!withinCustomerWindow ? (
                  <p className="mb-1.5 rounded-[8px] bg-warning-tint px-2 py-1.5 text-[11px] leading-4 text-warning">
                    Fuera de ventana 24 h (o aún no te escribió). El texto libre no llega: abre{" "}
                    <span className="font-semibold">Plantilla Meta</span> abajo o pídele un hola al
                    301 123 4236.
                  </p>
                ) : (
                  <p
                    className={cx(
                      "mb-1.5 rounded-[8px] px-2 py-1.5 text-[11px] leading-4",
                      customerWindow.urgent
                        ? "bg-warning-tint text-warning"
                        : "bg-success-tint text-success",
                    )}
                  >
                    Ventana abierta · quedan{" "}
                    <span className="font-semibold tabular-nums">{customerWindow.leftLabel}</span>
                    {customerWindow.urgent
                      ? " — responde pronto o usa plantilla."
                      : ": texto libre o respuestas rápidas."}
                  </p>
                )}
                <form action={sendAction} className="flex flex-col gap-1.5">
                  <input type="hidden" name="conversationId" value={active.id} />
                  {withinCustomerWindow ? (
                    <div className="flex gap-1 overflow-x-auto pb-0.5">
                      {INBOX_QUICK_REPLIES.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="shrink-0 rounded-[6px] border border-line bg-canvas px-2 py-1 text-[11px] font-semibold text-ink hover:bg-subtle"
                          title={fillInboxQuickReply(item.text, active.contactName || "")}
                          onClick={() =>
                            setDraft(fillInboxQuickReply(item.text, active.contactName || ""))
                          }
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex gap-1.5">
                    <textarea
                      key={`body-${active.id}-${composerKey}`}
                      name="body"
                      rows={1}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={
                        withinCustomerWindow
                          ? "Mensaje… (Enter envía, Shift+Enter salto)"
                          : "Texto libre bloqueado — usa plantilla Meta"
                      }
                      disabled={!withinCustomerWindow}
                      onKeyDown={(event) => {
                        if (!withinCustomerWindow) return;
                        if (event.key !== "Enter" || event.shiftKey) return;
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }}
                      className="min-h-8 max-h-24 flex-1 resize-y rounded-[8px] border border-line bg-canvas px-2.5 py-1.5 text-sm outline-none focus:border-ink disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      name="mode"
                      value="text"
                      disabled={sending || !withinCustomerWindow || !draft.trim()}
                      className={btnDark}
                    >
                      {sending ? "…" : "Enviar"}
                    </button>
                  </div>
                  {sendState.error ? (
                    <p className="text-[11px] leading-4 text-danger">{sendState.error}</p>
                  ) : null}
                  {sendState.ok ? (
                    <p className="text-[11px] leading-4 text-success">{sendState.ok}</p>
                  ) : null}
                  <details className="text-xs text-muted" open={!withinCustomerWindow}>
                    <summary className="cursor-pointer font-semibold hover:text-ink">
                      Plantilla Meta{templates.length ? ` (${templates.length})` : ""}
                      {!withinCustomerWindow ? " · requerida" : ""}
                    </summary>
                    <div className="mt-1.5 flex flex-col gap-1.5">
                      <div className="flex flex-wrap gap-1">
                        {templates.length > 0 ? (
                          <>
                            <select
                              aria-label="Plantilla aprobada"
                              value={templateKey}
                              onChange={(event) => setTemplateKey(event.target.value)}
                              className={cx(ctrl, "min-w-[12rem] flex-1")}
                            >
                              {templates.map((item) => (
                                <option
                                  key={`${item.name}-${item.language}`}
                                  value={`${item.name}::${item.language}`}
                                >
                                  {item.name} · {item.language}
                                  {item.category ? ` · ${item.category}` : ""}
                                </option>
                              ))}
                            </select>
                            <input type="hidden" name="templateName" value={selectedTemplate?.name || ""} />
                            <input
                              type="hidden"
                              name="language"
                              value={selectedTemplate?.language || "es"}
                            />
                          </>
                        ) : (
                          <>
                            <input name="templateName" placeholder="Nombre" className={cx(ctrl, "w-[8rem]")} />
                            <input name="language" defaultValue="es" className={cx(ctrl, "w-[4.5rem]")} />
                          </>
                        )}
                        <input type="hidden" name="templateValues" value={templateValuesJoined} />
                        <button type="submit" name="mode" value="template" disabled={sending} className={btn}>
                          Enviar plantilla
                        </button>
                      </div>
                      {selectedTemplate?.body ? (
                        <p className="text-[11px] leading-4 text-muted">{selectedTemplate.body}</p>
                      ) : null}
                      {templatePositions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {templatePositions.map((position) => (
                            <label key={position} className="grid gap-0.5">
                              <span className="text-[10px] font-bold tracking-wide text-muted uppercase">
                                {`{{${position}}}`}
                              </span>
                              <input
                                value={templateVarValues[String(position)] || ""}
                                onChange={(event) =>
                                  setTemplateVarValues((prev) => ({
                                    ...prev,
                                    [String(position)]: event.target.value,
                                  }))
                                }
                                placeholder={position === 1 ? "Nombre" : `Valor ${position}`}
                                className={cx(ctrl, "w-[8.5rem]")}
                                required
                              />
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      {templates.length === 0
                        ? "Sin plantillas aprobadas. Créalas en Conexión → Plantillas."
                        : "Las plantillas en español aparecen primero. Si Meta aún revisa saludo_compruki, usa hello_world."}
                    </p>
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
