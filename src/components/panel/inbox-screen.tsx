"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  FOLLOWUP_OPEN_STAGES,
  followupStageLabel,
  type FollowupStageId,
} from "@/lib/crm-pipeline";
import {
  normalizeCrmPhone,
  type PhoneFollowupChip,
  type PhoneOrderChip,
} from "@/lib/crm-contacts";
import { cx } from "@/lib/cx";
import { formatRelativeShort, formatWindowLeft } from "@/lib/format";
import { orderFocusHref } from "@/lib/store-order";
import {
  isInboxArrivalChimeMuted,
  playInboxArrivalChime,
  setInboxArrivalChimeMuted,
} from "@/lib/inbox-arrival-chime";
import {
  fillInboxQuickReply,
  inboxMediaLabel,
  INBOX_QUICK_REPLIES,
  orderStatusQuickReply,
} from "@/lib/inbox-quick-replies";
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
  activeOrders: [],
  activeOrderExtra: 0,
  activeFollowup: null,
};

type InboxBundle = {
  conversations: InboxConversation[];
  activeId: string | null;
  messages: InboxMessage[];
  activeOrders: PhoneOrderChip[];
  activeOrderExtra: number;
  activeFollowup: PhoneFollowupChip | null;
  ordersForId: string | null;
};

function bundleFromAction(prev: InboxBundle, state: InboxActionState, mode: "always" | "keep"): InboxBundle {
  const useThread = mode === "always" || Boolean(state.activeId);
  return {
    conversations: state.conversations.length ? state.conversations : prev.conversations,
    activeId: mode === "always" ? state.activeId : state.activeId || prev.activeId,
    messages: useThread ? state.messages : prev.messages,
    activeOrders: useThread ? state.activeOrders : prev.activeOrders,
    activeOrderExtra: useThread ? state.activeOrderExtra : prev.activeOrderExtra,
    activeFollowup: useThread ? state.activeFollowup : prev.activeFollowup,
    ordersForId: useThread ? state.activeId : prev.ordersForId,
  };
}

function contextAfterSwitch(prev: InboxBundle, conversationId: string) {
  if (prev.activeId === conversationId) {
    return {
      activeOrders: prev.activeOrders,
      activeOrderExtra: prev.activeOrderExtra,
      activeFollowup: prev.activeFollowup,
      ordersForId: prev.ordersForId,
    };
  }
  return {
    activeOrders: [] as PhoneOrderChip[],
    activeOrderExtra: 0,
    activeFollowup: null as PhoneFollowupChip | null,
    ordersForId: null as string | null,
  };
}

type FilterId = "all" | "mine" | "unassigned" | "unread" | "awaiting" | "urgent" | "template";
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
  initialActiveOrders = [],
  initialActiveOrderExtra = 0,
  initialActiveFollowup = null,
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
  initialActiveOrders?: PhoneOrderChip[];
  initialActiveOrderExtra?: number;
  initialActiveFollowup?: PhoneFollowupChip | null;
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
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [arrivalNotice, setArrivalNotice] = useState<{
    id: string;
    name: string;
    preview: string;
  } | null>(null);
  const [notifyOffer, setNotifyOffer] = useState(false);
  const [chimeMuted, setChimeMuted] = useState(false);
  const prevUnreadRef = useRef<number | null>(null);
  const activeStampRef = useRef("");
  const prevActiveForStampRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!defaultTemplateKey) return;
    setTemplateKey((current) => current || defaultTemplateKey);
  }, [defaultTemplateKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setNotifyOffer(Notification.permission === "default");
  }, []);

  useEffect(() => {
    setChimeMuted(isInboxArrivalChimeMuted());
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

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
  const [bundle, setBundle] = useState<InboxBundle>({
    conversations: initialConversations,
    activeId: initialActiveId,
    messages: initialMessages,
    activeOrders: initialActiveOrders,
    activeOrderExtra: initialActiveOrderExtra,
    activeFollowup: initialActiveFollowup,
    ordersForId: initialActiveId,
  });

  useEffect(() => {
    if (!selectState.activeId && !selectState.conversations.length) return;
    setBundle((prev) => bundleFromAction(prev, selectState, "always"));
  }, [selectState]);

  useEffect(() => {
    if (!sendState.activeId && !sendState.ok && !sendState.error) return;
    setBundle((prev) => bundleFromAction(prev, sendState, "keep"));
  }, [sendState]);

  useEffect(() => {
    if (!stageState.activeId && !stageState.ok && !stageState.error) return;
    setBundle((prev) => bundleFromAction(prev, stageState, "keep"));
  }, [stageState]);

  useEffect(() => {
    if (!assignState.activeId && !assignState.ok && !assignState.error) return;
    setBundle((prev) => bundleFromAction(prev, assignState, "keep"));
  }, [assignState]);

  useEffect(() => {
    if (!followState.activeId && !followState.ok && !followState.error) return;
    setBundle((prev) => bundleFromAction(prev, followState, "keep"));
  }, [followState]);

  useEffect(() => {
    if (!renameState.activeId && !renameState.ok && !renameState.error) return;
    setBundle((prev) => bundleFromAction(prev, renameState, "keep"));
  }, [renameState]);

  useEffect(() => {
    if (!openState.activeId && !openState.ok && !openState.error) return;
    setBundle((prev) => bundleFromAction(prev, openState, "always"));
  }, [openState]);

  useEffect(() => {
    if (!readState.ok && !readState.error && !readState.conversations.length) return;
    setBundle((prev) => bundleFromAction(prev, readState, "keep"));
  }, [readState]);

  useEffect(() => {
    setBundle((prev) => {
      const nextActive = prev.activeId || initialActiveId;
      const serverHasActive =
        Boolean(nextActive) &&
        (nextActive === initialActiveId ||
          initialConversations.some((item) => item.id === nextActive));
      const useServerThread = Boolean(serverHasActive && nextActive === initialActiveId);
      const keepLocal = !useServerThread && prev.activeId === nextActive;
      return {
        conversations: initialConversations,
        activeId: nextActive,
        // Con ?c= en URL, el refresh trae mensajes del hilo abierto.
        messages: useServerThread ? initialMessages : keepLocal ? prev.messages : initialMessages,
        activeOrders: useServerThread ? initialActiveOrders : keepLocal ? prev.activeOrders : initialActiveOrders,
        activeOrderExtra: useServerThread
          ? initialActiveOrderExtra
          : keepLocal
            ? prev.activeOrderExtra
            : initialActiveOrderExtra,
        activeFollowup: useServerThread
          ? initialActiveFollowup
          : keepLocal
            ? prev.activeFollowup
            : initialActiveFollowup,
        ordersForId: useServerThread ? initialActiveId : keepLocal ? prev.ordersForId : initialActiveId,
      };
    });
  }, [
    initialConversations,
    initialMessages,
    initialActiveId,
    initialActiveOrders,
    initialActiveOrderExtra,
    initialActiveFollowup,
  ]);

  // Si el chat abierto recibe algo nuevo en el poll, recarga el hilo.
  useEffect(() => {
    const currentId = bundle.activeId;
    if (!currentId) return;
    if (prevActiveForStampRef.current !== currentId) {
      prevActiveForStampRef.current = currentId;
      activeStampRef.current = "";
    }
    const row = initialConversations.find((item) => item.id === currentId);
    if (!row) return;
    const stamp = `${row.id}|${row.lastMessageAt}|${row.lastMessagePreview}|${row.unreadCount}`;
    if (!activeStampRef.current) {
      activeStampRef.current = stamp;
      return;
    }
    if (stamp === activeStampRef.current) return;
    activeStampRef.current = stamp;
    const fd = new FormData();
    fd.set("conversationId", currentId);
    startTransition(() => {
      selectAction(fd);
    });
  }, [initialConversations, bundle.activeId, selectAction]);

  const conversations = bundle.conversations;
  const activeId = bundle.activeId;
  const messages = bundle.messages;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (filter === "all") url.searchParams.delete("f");
    else url.searchParams.set("f", filter);
    if (activeId) url.searchParams.set("c", activeId);
    else url.searchParams.delete("c");
    // phone/name solo sirven para deep-link de entrada.
    url.searchParams.delete("phone");
    url.searchParams.delete("name");
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(null, "", next);
  }, [filter, activeId]);

  const assigneeName = useMemo(() => {
    const map = new Map(assignees.map((item) => [item.userId, item.name || item.email]));
    return (userId: string) => (userId ? map.get(userId) || "Asignado" : "Libre");
  }, [assignees]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, item) => sum + (item.unreadCount > 0 ? item.unreadCount : 0), 0),
    [conversations],
  );

  useEffect(() => {
    const previous = prevUnreadRef.current;
    prevUnreadRef.current = unreadTotal;
    if (previous === null || unreadTotal <= previous) return;
    const candidate = [...conversations]
      .filter((item) => item.unreadCount > 0 && item.id !== activeId)
      .sort((a, b) => (b.lastMessageAt || "").localeCompare(a.lastMessageAt || ""))[0];
    if (!candidate) return;
    const notice = {
      id: candidate.id,
      name: candidate.contactName || candidate.phone,
      preview: candidate.lastMessagePreview || "Nuevo mensaje",
    };
    setArrivalNotice(notice);
    playInboxArrivalChime();
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      document.visibilityState !== "visible"
    ) {
      try {
        const desktop = new Notification(`Compruki · ${notice.name}`, {
          body: notice.preview.slice(0, 120),
          tag: `inbox-${notice.id}`,
        });
        desktop.onclick = () => {
          window.focus();
          desktop.close();
        };
      } catch {
        // Algunos navegadores bloquean Notification sin gesto previo.
      }
    }
  }, [unreadTotal, conversations, activeId]);

  useEffect(() => {
    if (!arrivalNotice) return;
    const id = window.setTimeout(() => setArrivalNotice(null), 8_000);
    return () => window.clearTimeout(id);
  }, [arrivalNotice]);

  const filterCounts = useMemo(() => {
    let mine = 0;
    let unassigned = 0;
    let unread = 0;
    let awaiting = 0;
    let urgent = 0;
    let template = 0;
    const now = Date.now();
    for (const item of conversations) {
      if (item.assignedTo === actorUserId) mine += 1;
      if (!item.assignedTo && item.status !== "closed") unassigned += 1;
      if (item.unreadCount > 0) unread += 1;
      if (item.lastDirection === "inbound" && item.status !== "closed") {
        awaiting += 1;
        const left = item.lastMessageAt ? formatWindowLeft(item.lastMessageAt, now) : null;
        if (left && left.leftMs <= 0) template += 1;
        else if (left?.urgent && left.leftMs > 0) urgent += 1;
      }
    }
    return {
      all: conversations.length,
      mine,
      unassigned,
      unread,
      awaiting,
      urgent,
      template,
    } satisfies Record<FilterId, number>;
  }, [conversations, actorUserId]);

  const busyQueue = filterCounts.awaiting > 0 || unreadTotal > 0;

  const awaitingQueue = useMemo(
    () =>
      [...conversations]
        .filter((item) => item.lastDirection === "inbound" && item.status !== "closed")
        // Más urgente primero (menos tiempo de ventana).
        .sort((a, b) => (a.lastMessageAt || "").localeCompare(b.lastMessageAt || "")),
    [conversations],
  );

  const urgentQueue = useMemo(
    () =>
      awaitingQueue.filter((item) => {
        const left = item.lastMessageAt ? formatWindowLeft(item.lastMessageAt, nowTick) : null;
        return Boolean(left?.urgent && left.leftMs > 0);
      }),
    [awaitingQueue, nowTick],
  );

  const templateQueue = useMemo(
    () =>
      awaitingQueue.filter((item) => {
        const left = item.lastMessageAt ? formatWindowLeft(item.lastMessageAt, nowTick) : null;
        return Boolean(left && left.leftMs <= 0);
      }),
    [awaitingQueue, nowTick],
  );

  const replyQueue =
    filter === "urgent" ? urgentQueue : filter === "template" ? templateQueue : awaitingQueue;
  const replyFilter: FilterId =
    filter === "urgent" ? "urgent" : filter === "template" ? "template" : "awaiting";

  const nextReply = useMemo(() => {
    if (!replyQueue.length) return null;
    const currentIndex = replyQueue.findIndex((item) => item.id === activeId);
    if (currentIndex < 0) return replyQueue[0];
    return replyQueue[(currentIndex + 1) % replyQueue.length] ?? null;
  }, [replyQueue, activeId]);

  const prevReply = useMemo(() => {
    if (!replyQueue.length) return null;
    const currentIndex = replyQueue.findIndex((item) => item.id === activeId);
    if (currentIndex < 0) return replyQueue[replyQueue.length - 1] ?? null;
    return replyQueue[(currentIndex - 1 + replyQueue.length) % replyQueue.length] ?? null;
  }, [replyQueue, activeId]);

  function openConversation(conversationId: string, opts?: { claimIfFree?: boolean }) {
    const claim =
      Boolean(opts?.claimIfFree) &&
      !conversations.find((row) => row.id === conversationId)?.assignedTo;
    setBundle((prev) => ({
      ...prev,
      ...contextAfterSwitch(prev, conversationId),
      activeId: conversationId,
      messages: prev.activeId === conversationId ? prev.messages : [],
      conversations: prev.conversations.map((row) =>
        row.id === conversationId
          ? {
              ...row,
              unreadCount: 0,
              ...(claim ? { assignedTo: actorUserId } : {}),
            }
          : row,
      ),
    }));
    startTransition(() => {
      const selectFd = new FormData();
      selectFd.set("conversationId", conversationId);
      selectAction(selectFd);
      if (!claim) return;
      const assignFd = new FormData();
      assignFd.set("conversationId", conversationId);
      assignFd.set("assignedTo", actorUserId);
      assignAction(assignFd);
    });
  }

  function openReply(conversationId: string) {
    setFilter(replyFilter);
    openConversation(conversationId, { claimIfFree: true });
  }

  function openNextReply() {
    if (!nextReply) return;
    openReply(nextReply.id);
  }

  function openPrevReply() {
    if (!prevReply) return;
    openReply(prevReply.id);
  }

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refreshIfVisible);
    const intervalMs = busyQueue ? 10_000 : 25_000;
    const id = window.setInterval(refreshIfVisible, intervalMs);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refreshIfVisible);
      window.clearInterval(id);
    };
  }, [router, busyQueue]);

  useEffect(() => {
    const base = "Inbox WhatsApp";
    document.title = unreadTotal > 0 ? `(${unreadTotal}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [unreadTotal]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "");
    const now = nowTick;
    const list = conversations.filter((item) => {
      if (filter === "mine" && item.assignedTo !== actorUserId) return false;
      if (filter === "unassigned" && item.assignedTo) return false;
      if (filter === "unread" && item.unreadCount <= 0) return false;
      if (filter === "awaiting" && item.lastDirection !== "inbound") return false;
      if (filter === "urgent") {
        if (item.lastDirection !== "inbound" || item.status === "closed") return false;
        const left = item.lastMessageAt ? formatWindowLeft(item.lastMessageAt, now) : null;
        if (!left?.urgent || left.leftMs <= 0) return false;
      }
      if (filter === "template") {
        if (item.lastDirection !== "inbound" || item.status === "closed") return false;
        const left = item.lastMessageAt ? formatWindowLeft(item.lastMessageAt, now) : null;
        if (!left || left.leftMs > 0) return false;
      }
      if (stageFilter !== "all" && item.pipelineStage !== stageFilter) return false;
      if (!q) return true;
      const hay = `${item.contactName} ${item.phone} ${item.lastMessagePreview}`.toLowerCase();
      return hay.includes(q) || item.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""));
    });
    if (filter !== "awaiting" && filter !== "urgent" && filter !== "template") return list;
    // Más urgente primero: menos tiempo de ventana 24 h.
    return [...list].sort((a, b) => (a.lastMessageAt || "").localeCompare(b.lastMessageAt || ""));
  }, [conversations, filter, stageFilter, actorUserId, query, nowTick]);

  const active = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? null,
    [conversations, activeId],
  );
  const phoneKey = active ? normalizeCrmPhone(active.phone) || active.phone : "";
  const contextReady = Boolean(active && bundle.ordersForId === active.id);
  const shownOrders = contextReady ? bundle.activeOrders : [];
  const extraOrders = contextReady ? bundle.activeOrderExtra : 0;
  const activeFollowup = contextReady ? bundle.activeFollowup : null;

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
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [composerKey, setComposerKey] = useState(0);
  const [draft, setDraft] = useState("");
  const [showFailed, setShowFailed] = useState(false);

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
    setCopiedMsgId(null);
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

  useEffect(() => {
    if (!withinCustomerWindow) return;
    const el = composerRef.current;
    if (!el || el.disabled) return;
    el.focus({ preventScroll: true });
  }, [activeId, composerKey, withinCustomerWindow]);

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

  async function copyMessageBody(messageId: string, body: string) {
    const text = body.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(messageId);
      window.setTimeout(() => {
        setCopiedMsgId((current) => (current === messageId ? null : current));
      }, 1400);
    } catch {
      setCopiedMsgId(null);
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Escape" && arrivalNotice) {
        event.preventDefault();
        setArrivalNotice(null);
        return;
      }
      const goNext = event.key === "]" || event.code === "BracketRight";
      const goPrev = event.key === "[" || event.code === "BracketLeft";
      if (!goNext && !goPrev) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }
      if (!(goNext ? nextReply : prevReply)) return;
      event.preventDefault();
      if (goNext) openNextReply();
      else openPrevReply();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    arrivalNotice,
    nextReply,
    prevReply,
    replyFilter,
    conversations,
    actorUserId,
    selectAction,
    assignAction,
  ]);

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
        <div className="flex items-center gap-1.5">
          {replyQueue.length > 0 ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={btn}
                title={
                  replyFilter === "urgent"
                    ? "Anterior ventana <2 h (tecla [); te asigna si está libre"
                    : replyFilter === "template"
                      ? "Anterior que necesita plantilla (tecla [); te asigna si está libre"
                      : "Anterior por responder (tecla [); te asigna si está libre"
                }
                disabled={!prevReply || replyQueue.length < 2}
                onClick={openPrevReply}
              >
                Ant.
              </button>
              <button
                type="button"
                className={btnDark}
                title={
                  replyFilter === "urgent"
                    ? "Siguiente ventana <2 h (tecla ]); te asigna si está libre"
                    : replyFilter === "template"
                      ? "Siguiente que necesita plantilla (tecla ]); te asigna si está libre"
                      : "Siguiente por responder (tecla ]); te asigna si está libre"
                }
                onClick={openNextReply}
              >
                {replyFilter === "urgent"
                  ? "Sig. <2h"
                  : replyFilter === "template"
                    ? "Sig. Plant."
                    : "Sig. Resp."}
                {replyQueue.length > 1 ? ` (${replyQueue.length})` : ""}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className={btn}
            title={
              chimeMuted
                ? "Activar pitido al llegar un mensaje"
                : "Silenciar pitido al llegar un mensaje"
            }
            aria-pressed={chimeMuted}
            onClick={() => {
              const next = !chimeMuted;
              setChimeMuted(next);
              setInboxArrivalChimeMuted(next);
            }}
          >
            {chimeMuted ? "Sonido off" : "Sonido"}
          </button>
          {notifyOffer ? (
            <button
              type="button"
              className={btn}
              title="Avisos del sistema cuando llegue un mensaje y esta pestaña esté oculta"
              onClick={() => {
                void Notification.requestPermission().then((result) => {
                  setNotifyOffer(result === "default");
                });
              }}
            >
              Activar avisos
            </button>
          ) : null}
          <Link href="/panel/whatsapp" className={btn}>
            Conexión
          </Link>
        </div>
      </div>

      {feedbackError && !sendState.error ? (
        <p className="text-xs text-danger">{feedbackError}</p>
      ) : null}
      {feedbackOk && !sendState.ok ? <p className="text-xs text-success">{feedbackOk}</p> : null}

      {arrivalNotice ? (
        <div
          role="status"
          className="elevate-1 flex items-center gap-2 rounded-[10px] border border-line bg-card px-2.5 py-2"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-ink">
              Nuevo · {arrivalNotice.name}
            </p>
            <p className="truncate text-[11px] text-muted">{arrivalNotice.preview}</p>
          </div>
          <button
            type="button"
            className={btnDark}
            title="Abrir y asignarme si está libre"
            onClick={() => {
              const id = arrivalNotice.id;
              setArrivalNotice(null);
              setFilter("awaiting");
              openConversation(id, { claimIfFree: true });
            }}
          >
            Abrir
          </button>
          <button
            type="button"
            className={btn}
            aria-label="Cerrar aviso (Esc)"
            title="Cerrar (Esc)"
            onClick={() => setArrivalNotice(null)}
          >
            ×
          </button>
        </div>
      ) : null}

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
            <div className="flex flex-wrap gap-0.5" role="tablist" aria-label="Filtro">
              {(
                [
                  ["all", "Todos", "Todos"],
                  ["mine", "Míos", "Míos"],
                  ["unassigned", "Libres", "Sin asignar"],
                  ["unread", "Nuevos", "No leídos"],
                  ["awaiting", "Resp.", "Por responder"],
                  ["urgent", "<2h", "Ventana por cerrar (<2 h)"],
                  ["template", "Plant.", "Ventana cerrada — solo plantilla Meta"],
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
                      "flex h-6 min-w-[2.4rem] flex-1 flex-col items-center justify-center rounded-[5px] px-1 leading-none",
                      filter === id
                        ? id === "urgent"
                          ? "bg-danger text-canvas"
                          : id === "template"
                            ? "bg-warning text-canvas"
                            : "bg-ink text-canvas"
                        : id === "urgent" && count > 0
                          ? "bg-danger-tint text-danger"
                          : id === "template" && count > 0
                            ? "bg-warning-tint text-warning"
                            : "bg-subtle text-muted hover:text-ink",
                    )}
                  >
                    <span className="text-[9px] font-semibold">{label}</span>
                    {count > 0 ? (
                      <span
                        className={cx(
                          "text-[8px] font-bold tabular-nums",
                          filter === id ? "text-canvas/80" : "opacity-80",
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
                const windowLeft =
                  awaiting && item.lastMessageAt
                    ? formatWindowLeft(item.lastMessageAt, nowTick)
                    : null;
                return (
                  <li key={item.id} className="border-b border-line/80 last:border-0">
                    <form action={selectAction}>
                      <input type="hidden" name="conversationId" value={item.id} />
                      <button
                        type="submit"
                        onClick={() =>
                          setBundle((prev) => ({
                            ...prev,
                            ...contextAfterSwitch(prev, item.id),
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
                              ? windowLeft?.urgent
                                ? "border-l-danger bg-danger-tint/30"
                                : "border-l-warning bg-warning-tint/40"
                              : "border-l-transparent",
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-[13px] font-semibold text-ink">
                            {item.contactName || item.phone}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            {awaiting && item.id !== activeId ? (
                              <span
                                className={cx(
                                  "rounded-[4px] px-1 text-[9px] font-bold",
                                  windowLeft?.urgent
                                    ? "bg-danger-tint text-danger"
                                    : "bg-warning-tint text-warning",
                                )}
                                title={
                                  windowLeft
                                    ? `Ventana 24 h: ${windowLeft.label}`
                                    : "Por responder"
                                }
                              >
                                {windowLeft ? windowLeft.label : "Resp."}
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
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <Link
                      href={`/panel/pedidos?q=${encodeURIComponent(phoneKey)}`}
                      className="text-[11px] font-semibold text-accent-strong hover:underline"
                      title="Ver pedidos de este celular"
                    >
                      Pedidos
                    </Link>
                    <Link
                      href={`/panel/clientes?q=${encodeURIComponent(active.phone)}#contactos`}
                      className="text-[11px] font-semibold text-accent-strong hover:underline"
                      title="Ver contacto en CRM"
                    >
                      CRM
                    </Link>
                  </div>
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

              <div className="flex min-w-0 shrink-0 flex-col gap-0.5 border-b border-line px-2 py-1 text-[11px] leading-4">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  {!contextReady ? (
                    <span className="text-muted">…</span>
                  ) : shownOrders.length === 0 ? (
                    <span className="text-muted">Sin pedidos con este celular</span>
                  ) : (
                    <>
                      {shownOrders.map((order) => (
                        <Link
                          key={order.number}
                          href={orderFocusHref(order.number)}
                          className="inline-flex min-w-0 items-baseline gap-1 truncate text-ink hover:underline"
                          title={`${order.number} · ${order.statusLabel} · ${order.totalLabel}`}
                        >
                          <span className="font-semibold">{order.number}</span>
                          <span className="truncate text-muted">{order.statusLabel}</span>
                          <span className="shrink-0 tabular-nums text-muted">{order.totalLabel}</span>
                        </Link>
                      ))}
                      {extraOrders > 0 ? (
                        <Link
                          href={`/panel/pedidos?q=${encodeURIComponent(phoneKey)}`}
                          className="shrink-0 font-semibold text-muted hover:text-ink hover:underline"
                          title="Ver el resto de pedidos de este celular"
                        >
                          +{extraOrders}
                        </Link>
                      ) : null}
                    </>
                  )}
                </div>
                {contextReady ? (
                  activeFollowup ? (
                    <Link
                      href={`/panel/clientes?q=${encodeURIComponent(phoneKey)}`}
                      className={cx(
                        "inline-flex min-w-0 items-baseline gap-1 truncate hover:underline",
                        activeFollowup.overdue ? "text-danger" : "text-ink",
                      )}
                      title={[
                        activeFollowup.stageLabel,
                        activeFollowup.dueLabel,
                        activeFollowup.high ? "alta" : "",
                        activeFollowup.note,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    >
                      <span className="font-semibold">CRM</span>
                      <span className="truncate text-muted">{activeFollowup.stageLabel}</span>
                      {activeFollowup.dueLabel ? (
                        <span
                          className={cx(
                            "shrink-0 font-semibold",
                            activeFollowup.overdue ? "text-danger" : "text-muted",
                          )}
                        >
                          {activeFollowup.dueLabel}
                        </span>
                      ) : null}
                      {activeFollowup.high ? (
                        <span className="shrink-0 font-semibold text-warning">alta</span>
                      ) : null}
                      {activeFollowup.note ? (
                        <span className="truncate text-muted">{activeFollowup.note}</span>
                      ) : null}
                      {activeFollowup.openCount > 1 ? (
                        <span className="shrink-0 text-muted">+{activeFollowup.openCount - 1}</span>
                      ) : null}
                    </Link>
                  ) : (
                    <span className="text-muted">Sin seguimiento CRM abierto</span>
                  )
                ) : null}
              </div>

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
                    const mediaLabel = inboxMediaLabel(msg.messageType);
                    const copied = copiedMsgId === msg.id;
                    const bubble = (
                      <button
                        type="button"
                        className={cx(
                          "block w-full max-w-[min(88%,26rem)] rounded-[10px] px-2.5 py-1.5 text-left text-[13px] leading-snug",
                          msg.direction === "outbound"
                            ? failed
                              ? "bg-[#7f1d1d] text-on-dark"
                              : "bg-primary text-on-dark"
                            : "bg-card text-ink shadow-[0_0_0_1px_var(--color-line)]",
                        )}
                        title={copied ? "Copiado" : "Clic para copiar"}
                        onClick={() => void copyMessageBody(msg.id, msg.body)}
                      >
                        {mediaLabel ? (
                          <p
                            className={cx(
                              "mb-0.5 text-[10px] font-bold tracking-wide uppercase",
                              msg.direction === "outbound" ? "text-on-dark/70" : "text-muted",
                            )}
                          >
                            {mediaLabel}
                          </p>
                        ) : null}
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
                            {copied
                              ? "Copiado"
                              : new Date(msg.createdAt).toLocaleString("es-CO", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                          </span>
                          {!copied && mark ? (
                            <span
                              className={cx("font-semibold tracking-tight", mark.className)}
                              title={mark.title}
                            >
                              {mark.text}
                            </span>
                          ) : null}
                        </p>
                      </button>
                    );
                    if (!failed) {
                      return (
                        <div
                          key={msg.id}
                          className={cx(
                            "max-w-[min(88%,26rem)]",
                            msg.direction === "outbound" ? "ml-auto" : "mr-auto",
                          )}
                        >
                          {bubble}
                        </div>
                      );
                    }
                    return (
                      <div key={msg.id} className="ml-auto flex max-w-[min(88%,26rem)] flex-col items-end gap-1">
                        {bubble}
                        {withinCustomerWindow && msg.body.trim() ? (
                          <button
                            type="button"
                            className={btn}
                            title="Poner el texto fallido en el composer para reenviar"
                            onClick={() => {
                              setDraft(msg.body);
                              window.requestAnimationFrame(() => {
                                composerRef.current?.focus({ preventScroll: true });
                              });
                            }}
                          >
                            Reenviar
                          </button>
                        ) : (
                          <p className="text-[10px] text-muted">
                            Ventana cerrada: usa plantilla Meta para reintentar.
                          </p>
                        )}
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
                      {shownOrders[0] ? (
                        <button
                          type="button"
                          className="shrink-0 rounded-[6px] border border-line bg-canvas px-2 py-1 text-[11px] font-semibold text-ink hover:bg-subtle"
                          title={orderStatusQuickReply(shownOrders[0], active.contactName || "")}
                          onClick={() =>
                            setDraft(orderStatusQuickReply(shownOrders[0]!, active.contactName || ""))
                          }
                        >
                          Estado
                        </button>
                      ) : null}
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
                      ref={composerRef}
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
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[11px] leading-4 text-success">{sendState.ok}</p>
                      {nextReply && nextReply.id !== activeId ? (
                        <button
                          type="button"
                          className={btnDark}
                          title="Abrir el siguiente de la cola (tecla ])"
                          onClick={openNextReply}
                        >
                          Sig. en cola
                        </button>
                      ) : null}
                    </div>
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
