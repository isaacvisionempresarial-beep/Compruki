"use server";

import { revalidatePath } from "next/cache";
import { isFollowupStageId } from "@/lib/crm-pipeline";
import { assertPanelAccess, hasPermission } from "@/server/panel-auth";
import {
  assignConversation,
  getInboxConversation,
  listInboxConversations,
  listInboxMessages,
  markConversationRead,
  openConversationByPhone,
  probeInboxTables,
  sendInboxTemplate,
  sendInboxText,
  updateConversationPipeline,
  type InboxConversation,
  type InboxMessage,
} from "@/server/whatsapp-inbox";
import { normalizeCrmPhone } from "@/lib/crm-contacts";
import { createFollowup } from "@/server/followups";
import { listTeamMembers } from "@/server/team";

export type InboxAssignee = {
  userId: string;
  name: string;
  email: string;
};

export type InboxActionState = {
  error: string | null;
  ok: string | null;
  conversations: InboxConversation[];
  activeId: string | null;
  messages: InboxMessage[];
};

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
  const messages = selected ? await listInboxMessages(tenantId, selected) : [];
  if (selected) await markConversationRead(tenantId, selected).catch(() => undefined);
  return { conversations, activeId: selected, messages };
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
      actorUserId: "",
      roleLabel: "",
      bootError: null as string | null,
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
      actorUserId: access.user.id,
      roleLabel: access.roleLabel,
      bootError: null,
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

  const [data, members] = await Promise.all([
    pack(access.tenantId, preferredId),
    listTeamMembers(access.tenantId).catch(() => []),
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
    bootError,
    ...data,
  };
}

export async function selectInboxConversationAction(
  _state: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  const access = await requireWhatsAppAccess();
  if (!access) return { error: "Sin permiso WhatsApp.", ok: null, conversations: [], activeId: null, messages: [] };
  const activeId = String(formData.get("conversationId") || "") || null;
  const data = await pack(access.tenantId, activeId);
  return { error: null, ok: null, ...data };
}

export async function sendInboxMessageAction(
  _state: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  const access = await requireWhatsAppAccess();
  if (!access) return { error: "Sin permiso WhatsApp.", ok: null, conversations: [], activeId: null, messages: [] };

  const conversationId = String(formData.get("conversationId") || "");
  const mode = String(formData.get("mode") || "text");
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
    revalidatePath("/panel/inbox");
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
  if (!access) return { error: "Sin permiso WhatsApp.", ok: null, conversations: [], activeId: null, messages: [] };
  const conversationId = String(formData.get("conversationId") || "");
  try {
    await assignConversation(access.tenantId, conversationId, String(formData.get("assignedTo") || ""));
    revalidatePath("/panel/inbox");
    const data = await pack(access.tenantId, conversationId);
    return { error: null, ok: "Responsable actualizado.", ...data };
  } catch (error) {
    const data = await pack(access.tenantId, conversationId || null);
    return {
      error: error instanceof Error ? error.message : "No se pudo asignar.",
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
  if (!access) return { error: "Sin permiso WhatsApp.", ok: null, conversations: [], activeId: null, messages: [] };
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
  if (!access) return { error: "Sin permiso WhatsApp.", ok: null, conversations: [], activeId: null, messages: [] };
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
  if (!access) return { error: "Sin permiso WhatsApp.", ok: null, conversations: [], activeId: null, messages: [] };
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
