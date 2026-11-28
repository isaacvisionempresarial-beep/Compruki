"use server";

import { revalidatePath } from "next/cache";
import { isFollowupStageId } from "@/lib/crm-pipeline";
import { assertPanelAccess, hasPermission } from "@/server/panel-auth";
import {
  assignConversation,
  getInboxConversation,
  listInboxConversations,
  listInboxMessages,
  markAllInboxRead,
  markConversationRead,
  openConversationByPhone,
  probeInboxTables,
  sendInboxTemplate,
  sendInboxText,
  signalWhatsAppReadReceipt,
  updateConversationContactName,
  updateConversationPipeline,
  type InboxConversation,
  type InboxMessage,
} from "@/server/whatsapp-inbox";
import {
  normalizeCrmPhone,
  openFollowupChipForPhone,
  recentOrdersForPhone,
  type PhoneFollowupChip,
  type PhoneOrderChip,
} from "@/lib/crm-contacts";
import { listOrders } from "@/server/order-store";
import {
  advancePipelineOnOperatorOutbound,
  createFollowup,
  listOpenFollowups,
} from "@/server/followups";
import { listTeamMembers } from "@/server/team";
import { metaWaConfigured, requireMetaWaEnv } from "@/server/whatsapp/env";
import { listWhatsAppTemplates } from "@/server/whatsapp/meta-client";

export type InboxAssignee = {
  userId: string;
  name: string;
  email: string;
};

export type InboxTemplateOption = {
  name: string;
  language: string;
  status: string;
  category: string;
  body: string;
};

export type InboxActionState = {
  error: string | null;
  ok: string | null;
  conversations: InboxConversation[];
  activeId: string | null;
  messages: InboxMessage[];
  activeOrders: PhoneOrderChip[];
  activeOrderExtra: number;
  activeFollowup: PhoneFollowupChip | null;
};

function emptyInboxAction(error: string): InboxActionState {
  return {
    error,
    ok: null,
    conversations: [],
    activeId: null,
    messages: [],
    activeOrders: [],
    activeOrderExtra: 0,
    activeFollowup: null,
  };
}

async function contextForActivePhone(phone: string) {
  if (normalizeCrmPhone(phone).length !== 10) {
    return { shown: [] as PhoneOrderChip[], extra: 0, followup: null as PhoneFollowupChip | null };
  }
  const [orders, followups] = await Promise.all([
    listOrders(),
    listOpenFollowups(120).catch(() => []),
  ]);
  const phoneOrders = recentOrdersForPhone(orders, phone);
  return {
    shown: phoneOrders.shown,
    extra: phoneOrders.extra,
    followup: openFollowupChipForPhone(followups, phone),
  };
}

async function requireWhatsAppAccess() {
  const access = await assertPanelAccess();
  if (!access) return null;
  if (!hasPermission(access, "whatsapp_manage")) return null;
  return access;
}

async function pack(tenantId: string, activeId: string | null): Promise<Omit<InboxActionState, "error" | "ok">> {
  const conversations = await listInboxConversations(tenantId);
  const selected =
    (activeId && conversations.find((item) => item.id === activeId)?.id) ||
    conversations[0]?.id ||
    null;
  const activePhone = selected ? conversations.find((item) => item.id === selected)?.phone ?? "" : "";
  const [messages, phoneContext] = await Promise.all([
    selected ? listInboxMessages(tenantId, selected) : Promise.resolve([] as InboxMessage[]),
    activePhone
      ? contextForActivePhone(activePhone)
      : Promise.resolve({
          shown: [] as PhoneOrderChip[],
          extra: 0,
          followup: null as PhoneFollowupChip | null,
        }),
  ]);
  if (selected) await markConversationRead(tenantId, selected).catch(() => undefined);
  return {
    // Refleja el leído al instante (mark ocurre después del list).
    conversations: selected
      ? conversations.map((item) =>
          item.id === selected ? { ...item, unreadCount: 0 } : item,
        )
      : conversations,
    activeId: selected,
    messages,
    activeOrders: phoneContext.shown,
    activeOrderExtra: phoneContext.extra,
    activeFollowup: phoneContext.followup,
  };
}

export async function loadInboxPanelData(opts?: {
  activeId?: string | null;
  phone?: string | null;
  contactName?: string | null;
}) {
  const access = await requireWhatsAppAccess();
  if (!access) {
    return {
      canManage: false,
      tableReady: false,
      conversations: [] as InboxConversation[],
      activeId: null as string | null,
      messages: [] as InboxMessage[],
      assignees: [] as InboxAssignee[],
      templates: [] as InboxTemplateOption[],
      actorUserId: "",
      roleLabel: "",
      bootError: null as string | null,
      activeOrders: [] as PhoneOrderChip[],
      activeOrderExtra: 0,
      activeFollowup: null as PhoneFollowupChip | null,
    };
  }
  const tableReady = await probeInboxTables();
  if (!tableReady) {
    return {
      canManage: true,
      tableReady: false,
      conversations: [],
      activeId: null,
      messages: [],
      assignees: [],
      templates: [],
      actorUserId: access.user.id,
      roleLabel: access.roleLabel,
      bootError: null,
      activeOrders: [],
      activeOrderExtra: 0,
      activeFollowup: null,
    };
  }

  let bootError: string | null = null;
  let preferredId = opts?.activeId ?? null;
  const phoneRaw = opts?.phone?.trim() || "";
  if (phoneRaw) {
    try {
      const opened = await openConversationByPhone(
        access.tenantId,
        phoneRaw,
        opts?.contactName?.trim() || "",
      );
      preferredId = opened.id;
    } catch (error) {
      bootError = error instanceof Error ? error.message : "No se pudo abrir el chat.";
    }
  }

  const [data, members, templates] = await Promise.all([
    pack(access.tenantId, preferredId),
    listTeamMembers(access.tenantId).catch(() => []),
    loadApprovedTemplates(),
  ]);
  const assignees: InboxAssignee[] = members.map((member) => ({
    userId: member.userId,
    name: member.name,
    email: member.email,
  }));
  return {
    canManage: true,
    tableReady: true,
    roleLabel: access.roleLabel,
    actorUserId: access.user.id,
    assignees,
    templates,
    bootError,
    ...data,
  };
}

function templateLanguageRank(language: string) {
  const lang = language.toLowerCase();
  if (lang === "es" || lang === "es_co") return 0;
  if (lang.startsWith("es")) return 1;
  return 2;
}

async function loadApprovedTemplates(): Promise<InboxTemplateOption[]> {
  if (!metaWaConfigured()) return [];
  try {
    const env = requireMetaWaEnv();
    if (!env.businessAccountId) return [];
    const rows = await listWhatsAppTemplates(env);
    return rows
      .filter((row) => row.name && row.language)
      .filter((row) => {
        const status = String(row.status || "").toUpperCase();
        return !status || status === "APPROVED";
      })
      .map((row) => ({
        name: String(row.name),
        language: String(row.language),
        status: String(row.status || "APPROVED"),
        category: String(row.category || ""),
        body: String(row.body || ""),
      }))
      .sort((a, b) => {
        const lang = templateLanguageRank(a.language) - templateLanguageRank(b.language);
        if (lang !== 0) return lang;
        if (a.name === "hello_world" && b.name !== "hello_world") return 1;
        if (b.name === "hello_world" && a.name !== "hello_world") return -1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 40);
  } catch {
    return [];
  }
}

export async function selectInboxConversationAction(
  _state: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  const access = await requireWhatsAppAccess();
  if (!access) return emptyInboxAction("Sin permiso WhatsApp.");
  const activeId = String(formData.get("conversationId") || "") || null;
  const data = await pack(access.tenantId, activeId);
  return { error: null, ok: null, ...data };
}

/** «Escribiendo…» en el celular del cliente (throttled desde el composer). */
export async function signalInboxTypingAction(
  _state: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  const access = await requireWhatsAppAccess();
  if (!access) return emptyInboxAction("Sin permiso WhatsApp.");
  const conversationId = String(formData.get("conversationId") || "");
  if (!conversationId) return emptyInboxAction("Falta la conversación.");
  await signalWhatsAppReadReceipt(access.tenantId, conversationId, { typing: true });
  return {
    error: null,
    ok: null,
    conversations: [],
    activeId: null,
    messages: [],
    activeOrders: [],
    activeOrderExtra: 0,
    activeFollowup: null,
  };
}

export async function sendInboxMessageAction(
  _state: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  const access = await requireWhatsAppAccess();
  if (!access) return emptyInboxAction("Sin permiso WhatsApp.");

  const conversationId = String(formData.get("conversationId") || "");
  // Si hay hidden + botón submit, get() puede devolver el primero; preferimos el último.
  const modeParts = formData.getAll("mode").map((part) => String(part));
  const mode = modeParts[modeParts.length - 1] || "text";
  try {
    if (mode === "template") {
      await sendInboxTemplate({
        tenantId: access.tenantId,
        conversationId,
        templateName: String(formData.get("templateName") || ""),
        language: String(formData.get("language") || "es"),
        values: String(formData.get("templateValues") || "")
          .split("|")
          .map((part) => part.trim())
          .filter(Boolean),
        actorName: access.actorName,
      });
    } else {
      await sendInboxText({
        tenantId: access.tenantId,
        conversationId,
        body: String(formData.get("body") || ""),
        actorName: access.actorName,
      });
    }
    // Si nadie lo tenía, al responder queda en tu bandeja.
    const conversation = await getInboxConversation(access.tenantId, conversationId);
    if (conversation && !conversation.assignedTo && access.user.id) {
      await assignConversation(access.tenantId, conversationId, access.user.id).catch(() => undefined);
    }
    if (conversation?.phone) {
      await advancePipelineOnOperatorOutbound({
        tenantId: access.tenantId,
        phone: conversation.phone,
      }).catch(() => undefined);
    }
    revalidatePath("/panel/inbox");
    revalidatePath("/panel/clientes");
    const data = await pack(access.tenantId, conversationId);
    return { error: null, ok: "Mensaje enviado.", ...data };
  } catch (error) {
    const data = await pack(access.tenantId, conversationId || null);
    return {
      error: error instanceof Error ? error.message : "No se pudo enviar.",
      ok: null,
      ...data,
    };
  }
}

export async function assignInboxConversationAction(
  _state: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  const access = await requireWhatsAppAccess();
  if (!access) return emptyInboxAction("Sin permiso WhatsApp.");
  const conversationId = String(formData.get("conversationId") || "");
  try {
    await assignConversation(access.tenantId, conversationId, String(formData.get("assignedTo") || ""));
    revalidatePath("/panel/inbox");
    revalidatePath("/panel/clientes");
    const data = await pack(access.tenantId, conversationId);
    return { error: null, ok: "Responsable actualizado en Inbox y CRM.", ...data };
  } catch (error) {
    const data = await pack(access.tenantId, conversationId || null);
    return {
      error: error instanceof Error ? error.message : "No se pudo asignar.",
      ok: null,
      ...data,
    };
  }
}

export async function renameInboxContactAction(
  _state: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  const access = await requireWhatsAppAccess();
  if (!access) return emptyInboxAction("Sin permiso WhatsApp.");
  const conversationId = String(formData.get("conversationId") || "");
  try {
    await updateConversationContactName(
      access.tenantId,
      conversationId,
      String(formData.get("contactName") || ""),
    );
    revalidatePath("/panel/inbox");
    const data = await pack(access.tenantId, conversationId);
    return { error: null, ok: "Nombre del contacto guardado.", ...data };
  } catch (error) {
    const data = await pack(access.tenantId, conversationId || null);
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar el nombre.",
      ok: null,
      ...data,
    };
  }
}

export async function markAllInboxReadAction(
  _state: InboxActionState,
  _formData: FormData,
): Promise<InboxActionState> {
  const access = await requireWhatsAppAccess();
  if (!access) return emptyInboxAction("Sin permiso WhatsApp.");
  try {
    const cleared = await markAllInboxRead(access.tenantId);
    revalidatePath("/panel/inbox");
    revalidatePath("/panel");
    const data = await pack(access.tenantId, null);
    return {
      error: null,
      ok: cleared > 0 ? `${cleared} chat(s) marcados como leídos.` : "No había no leídos.",
      ...data,
    };
  } catch (error) {
    const data = await pack(access.tenantId, null);
    return {
      error: error instanceof Error ? error.message : "No se pudo marcar leídos.",
      ok: null,
      ...data,
    };
  }
}

export async function updateInboxStageAction(
  _state: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  const access = await requireWhatsAppAccess();
  if (!access) return emptyInboxAction("Sin permiso WhatsApp.");
  const conversationId = String(formData.get("conversationId") || "");
  const stage = String(formData.get("stage") || "");
  const statusRaw = String(formData.get("status") || "");
  if (!isFollowupStageId(stage)) {
    const data = await pack(access.tenantId, conversationId || null);
    return { error: "Etapa no válida.", ok: null, ...data };
  }
  try {
    await updateConversationPipeline(
      access.tenantId,
      conversationId,
      stage,
      statusRaw === "closed" || statusRaw === "pending" || statusRaw === "open" ? statusRaw : undefined,
    );
    revalidatePath("/panel/inbox");
    revalidatePath("/panel/clientes");
    const data = await pack(access.tenantId, conversationId);
    return { error: null, ok: "Pipeline actualizado.", ...data };
  } catch (error) {
    const data = await pack(access.tenantId, conversationId || null);
    return {
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
      ok: null,
      ...data,
    };
  }
}

export async function createFollowupFromInboxAction(
  _state: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  const access = await requireWhatsAppAccess();
  if (!access) return emptyInboxAction("Sin permiso WhatsApp.");
  const conversationId = String(formData.get("conversationId") || "");
  const conversation = await getInboxConversation(access.tenantId, conversationId);
  if (!conversation) {
    const data = await pack(access.tenantId, null);
    return { error: "Conversación no encontrada.", ok: null, ...data };
  }
  const note = String(formData.get("note") || "").trim() || "Seguimiento desde Inbox WhatsApp";
  const localPhone =
    conversation.phone.startsWith("57") && conversation.phone.length === 12
      ? conversation.phone.slice(2)
      : conversation.phone;
  const result = await createFollowup({
    phone: normalizeCrmPhone(localPhone) || localPhone,
    customerName: conversation.contactName || conversation.phone,
    note,
    stage: conversation.pipelineStage,
    createdBy: access.actorName,
  });
  const data = await pack(access.tenantId, conversationId);
  if (result.error) return { error: result.error, ok: null, ...data };
  revalidatePath("/panel/clientes");
  return { error: null, ok: "Seguimiento creado en Clientes.", ...data };
}

export async function openInboxByPhoneAction(
  _state: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  const access = await requireWhatsAppAccess();
  if (!access) return emptyInboxAction("Sin permiso WhatsApp.");
  try {
    const conversation = await openConversationByPhone(
      access.tenantId,
      String(formData.get("phone") || ""),
      String(formData.get("contactName") || ""),
    );
    revalidatePath("/panel/inbox");
    const data = await pack(access.tenantId, conversation.id);
    return { error: null, ok: "Conversación lista.", ...data };
  } catch (error) {
    const data = await pack(access.tenantId, null);
    return {
      error: error instanceof Error ? error.message : "No se pudo abrir.",
      ok: null,
      ...data,
    };
  }
}
