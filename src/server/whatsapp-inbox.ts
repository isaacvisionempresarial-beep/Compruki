import {
  normalizeFollowupStage,
  type FollowupStageId,
} from "@/lib/crm-pipeline";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { syncOpenFollowupsFromConversation } from "@/server/followups";
import {
  insertWhatsAppMessage,
  normalizeWaPhone,
  upsertWhatsAppConversation,
} from "@/server/whatsapp/connection";
import { requireMetaWaEnv, metaWaConfigured } from "@/server/whatsapp/env";
import { sendWhatsAppTemplate, sendWhatsAppText, MetaApiError } from "@/server/whatsapp/meta-client";

export type InboxConversation = {
  id: string;
  phone: string;
  contactName: string;
  status: "open" | "pending" | "closed";
  pipelineStage: FollowupStageId;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastDirection: "inbound" | "outbound";
  unreadCount: number;
  assignedTo: string;
};

export type InboxMessage = {
  id: string;
  waMessageId: string;
  direction: "inbound" | "outbound";
  body: string;
  messageType: string;
  deliveryStatus: string;
  createdBy: string;
  createdAt: string;
};

function mapConversation(row: Record<string, unknown>): InboxConversation {
  return {
    id: String(row.id),
    phone: String(row.phone ?? ""),
    contactName: String(row.contact_name ?? ""),
    status: row.status === "closed" || row.status === "pending" ? row.status : "open",
    pipelineStage: normalizeFollowupStage(typeof row.pipeline_stage === "string" ? row.pipeline_stage : "nuevo"),
    lastMessageAt: String(row.last_message_at ?? ""),
    lastMessagePreview: String(row.last_message_preview ?? ""),
    lastDirection: row.last_direction === "outbound" ? "outbound" : "inbound",
    unreadCount: Number(row.unread_count ?? 0),
    assignedTo: String(row.assigned_to ?? ""),
  };
}

export async function probeInboxTables(): Promise<boolean> {
  try {
    const supabase = createAdminSupabase();
    const { error } = await supabase.from("whatsapp_conversations").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function countInboxUnread(tenantId: string): Promise<number> {
  try {
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("unread_count")
      .eq("tenant_id", tenantId)
      .gt("unread_count", 0)
      .limit(80);
    if (error || !data) return 0;
    return data.reduce((sum, row) => sum + Number(row.unread_count || 0), 0);
  } catch {
    return 0;
  }
}

export async function listInboxConversations(tenantId: string, limit = 80): Promise<InboxConversation[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select(
      "id, phone, contact_name, status, pipeline_stage, last_message_at, last_message_preview, last_direction, unread_count, assigned_to",
    )
    .eq("tenant_id", tenantId)
    .order("last_message_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (/whatsapp_conversations|schema cache|does not exist/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapConversation(row as Record<string, unknown>));
}

export async function getInboxConversation(tenantId: string, conversationId: string): Promise<InboxConversation | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select(
      "id, phone, contact_name, status, pipeline_stage, last_message_at, last_message_preview, last_direction, unread_count, assigned_to",
    )
    .eq("tenant_id", tenantId)
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !data) return null;
  return mapConversation(data as Record<string, unknown>);
}

export async function listInboxMessages(tenantId: string, conversationId: string, limit = 120): Promise<InboxMessage[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id, wa_message_id, direction, body, message_type, delivery_status, created_by, created_at")
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId)
    .neq("message_type", "status")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    // Fallback por teléfono si aún no hay conversation_id poblado
    const conversation = await getInboxConversation(tenantId, conversationId);
    if (!conversation) return [];
    const byPhone = await supabase
      .from("whatsapp_messages")
      .select("id, wa_message_id, direction, body, message_type, delivery_status, created_by, created_at")
      .eq("tenant_id", tenantId)
      .eq("phone", conversation.phone)
      .neq("message_type", "status")
      .order("created_at", { ascending: true })
      .limit(limit);
    if (byPhone.error || !byPhone.data) return [];
    return byPhone.data.map((row) => ({
      id: String(row.id),
      waMessageId: String(row.wa_message_id),
      direction: row.direction === "outbound" ? "outbound" : "inbound",
      body: String(row.body ?? ""),
      messageType: String(row.message_type ?? "text"),
      deliveryStatus: String(row.delivery_status ?? ""),
      createdBy: String(row.created_by ?? ""),
      createdAt: String(row.created_at),
    }));
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    waMessageId: String(row.wa_message_id),
    direction: row.direction === "outbound" ? "outbound" : "inbound",
    body: String(row.body ?? ""),
    messageType: String(row.message_type ?? "text"),
    deliveryStatus: String(row.delivery_status ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at),
  }));
}

export async function markConversationRead(tenantId: string, conversationId: string) {
  const supabase = createAdminSupabase();
  await supabase
    .from("whatsapp_conversations")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", conversationId);
}

export async function updateConversationPipeline(
  tenantId: string,
  conversationId: string,
  stage: FollowupStageId,
  status?: "open" | "pending" | "closed",
) {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .update({
      pipeline_stage: stage,
      ...(status ? { status } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", conversationId)
    .select("phone")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.phone) {
    await syncOpenFollowupsFromConversation({
      tenantId,
      phone: String(data.phone),
      stage,
    }).catch(() => undefined);
  }
}

export async function assignConversation(
  tenantId: string,
  conversationId: string,
  assignedTo: string,
) {
  const supabase = createAdminSupabase();
  const value = assignedTo.trim();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .update({
      assigned_to: value,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", conversationId)
    .select("phone")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.phone) {
    await syncOpenFollowupsFromConversation({
      tenantId,
      phone: String(data.phone),
      assignedTo: value,
    }).catch(() => undefined);
  }
}

export async function sendInboxText(input: {
  tenantId: string;
  conversationId: string;
  body: string;
  actorName: string;
}) {
  if (!metaWaConfigured()) throw new Error("Faltan META_WA_* en Railway.");
  const body = input.body.trim();
  if (!body || body.length > 4096) throw new Error("Escribe un mensaje de 1 a 4096 caracteres.");

  const conversation = await getInboxConversation(input.tenantId, input.conversationId);
  if (!conversation) throw new Error("Conversación no encontrada.");
  const phone = normalizeWaPhone(conversation.phone);
  if (!phone) throw new Error("Teléfono de la conversación inválido.");

  const env = requireMetaWaEnv();
  let messageId: string;
  try {
    messageId = await sendWhatsAppText(env, phone, body);
  } catch (error) {
    if (error instanceof MetaApiError) throw error;
    throw new Error(error instanceof Error ? error.message : "No se pudo enviar.");
  }

  await insertWhatsAppMessage(input.tenantId, {
    waMessageId: messageId,
    direction: "outbound",
    phone,
    contactName: conversation.contactName,
    body,
    messageType: "text",
    deliveryStatus: "sent",
    createdBy: input.actorName,
  });
  await markConversationRead(input.tenantId, input.conversationId);
  return messageId;
}

export async function sendInboxTemplate(input: {
  tenantId: string;
  conversationId: string;
  templateName: string;
  language: string;
  values: string[];
  actorName: string;
}) {
  if (!metaWaConfigured()) throw new Error("Faltan META_WA_* en Railway.");
  const conversation = await getInboxConversation(input.tenantId, input.conversationId);
  if (!conversation) throw new Error("Conversación no encontrada.");
  const phone = normalizeWaPhone(conversation.phone);
  if (!phone) throw new Error("Teléfono de la conversación inválido.");
  if (!input.templateName.trim()) throw new Error("Indica el nombre de la plantilla.");

  const env = requireMetaWaEnv();
  const messageId = await sendWhatsAppTemplate(env, {
    toPhoneDigits: phone,
    templateName: input.templateName.trim(),
    language: input.language.trim() || "es",
    bodyValues: input.values,
  });
  const stored = `Plantilla ${input.templateName.trim()} (${input.language})${
    input.values.length ? `: ${input.values.join(", ")}` : ""
  }`;
  await insertWhatsAppMessage(input.tenantId, {
    waMessageId: messageId,
    direction: "outbound",
    phone,
    contactName: conversation.contactName,
    body: stored,
    messageType: "template",
    deliveryStatus: "sent",
    createdBy: input.actorName,
  });
  return messageId;
}

export async function openConversationByPhone(
  tenantId: string,
  phoneRaw: string,
  contactName = "",
): Promise<InboxConversation> {
  const phone = normalizeWaPhone(phoneRaw);
  if (!phone) throw new Error("Celular inválido.");
  const id = await upsertWhatsAppConversation(tenantId, {
    phone,
    contactName,
    preview: "",
    direction: "outbound",
    bumpUnread: false,
  });
  if (!id) throw new Error("Falta la migración 021_whatsapp_inbox_crm.sql.");
  const conversation = await getInboxConversation(tenantId, id);
  if (!conversation) throw new Error("No se pudo abrir la conversación.");
  return conversation;
}
