import {
  isFollowupStageId,
  normalizeFollowupStage,
  type FollowupStageId,
} from "@/lib/crm-pipeline";
import { normalizeCrmPhone } from "@/lib/crm-contacts";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getPilotTenantId } from "@/server/tenant";
import { normalizeWaPhone } from "@/server/whatsapp/connection";

export type FollowupStatus = "open" | "done" | "dismissed";
export type FollowupPriority = "low" | "normal" | "high";

export type FollowupTask = {
  id: string;
  phone: string;
  customerName: string;
  orderNumber: string;
  note: string;
  stage: FollowupStageId;
  status: FollowupStatus;
  assignedTo: string;
  dueAt: string | null;
  priority: FollowupPriority;
  createdBy: string;
  resolvedBy: string;
  resolvedAt: string | null;
  createdAt: string;
};

function missingTable(message: string) {
  return (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("followup_tasks")
  );
}

function missingStageColumn(message: string) {
  return (
    message.includes("stage") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("column"))
  );
}

function missingCrmProColumn(message: string) {
  return (
    /(assigned_to|due_at|priority)/i.test(message) &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("column"))
  );
}

function normalizePriority(value: string | null | undefined): FollowupPriority {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "low" || raw === "high") return raw;
  return "normal";
}

export async function probeFollowupsTable(): Promise<boolean> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { error } = await supabase.from("followup_tasks").select("id").eq("tenant_id", tenantId).limit(1);
    if (!error) return true;
    return !missingTable(error.message);
  } catch {
    return false;
  }
}

/** True si existe la columna stage (migración 014). */
export async function probeFollowupPipeline(): Promise<boolean> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { error } = await supabase
      .from("followup_tasks")
      .select("stage")
      .eq("tenant_id", tenantId)
      .limit(1);
    if (!error) return true;
    if (missingStageColumn(error.message)) return false;
    return !missingTable(error.message);
  } catch {
    return false;
  }
}

/** True si existen assigned_to / due_at (migración 022). */
export async function probeFollowupCrmPro(): Promise<boolean> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { error } = await supabase
      .from("followup_tasks")
      .select("assigned_to, due_at, priority")
      .eq("tenant_id", tenantId)
      .limit(1);
    if (!error) return true;
    if (missingCrmProColumn(error.message)) return false;
    return !missingTable(error.message);
  } catch {
    return false;
  }
}

function mapRow(row: Record<string, unknown>): FollowupTask {
  const statusRaw = String(row.status ?? "open");
  const status: FollowupStatus =
    statusRaw === "done" || statusRaw === "dismissed" ? statusRaw : "open";
  return {
    id: String(row.id),
    phone: String(row.phone ?? ""),
    customerName: typeof row.customer_name === "string" ? row.customer_name : "",
    orderNumber: typeof row.order_number === "string" ? row.order_number : "",
    note: typeof row.note === "string" ? row.note : "",
    stage: normalizeFollowupStage(typeof row.stage === "string" ? row.stage : "nuevo"),
    status,
    assignedTo: typeof row.assigned_to === "string" ? row.assigned_to : "",
    dueAt: row.due_at ? String(row.due_at) : null,
    priority: normalizePriority(typeof row.priority === "string" ? row.priority : "normal"),
    createdBy: typeof row.created_by === "string" ? row.created_by : "",
    resolvedBy: typeof row.resolved_by === "string" ? row.resolved_by : "",
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

const SELECT_PRO =
  "id, phone, customer_name, order_number, note, stage, status, assigned_to, due_at, priority, created_by, resolved_by, resolved_at, created_at";

const SELECT_STAGE =
  "id, phone, customer_name, order_number, note, stage, status, created_by, resolved_by, resolved_at, created_at";

const SELECT_LEGACY =
  "id, phone, customer_name, order_number, note, status, created_by, resolved_by, resolved_at, created_at";

export async function listOpenFollowups(limit = 80): Promise<FollowupTask[]> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const capped = Math.min(120, Math.max(1, limit));

    const withPro = await supabase
      .from("followup_tasks")
      .select(SELECT_PRO)
      .eq("tenant_id", tenantId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(capped);

    if (!withPro.error && withPro.data) {
      return withPro.data.map((row) => mapRow(row as Record<string, unknown>));
    }

    if (withPro.error && missingCrmProColumn(withPro.error.message)) {
      const withStage = await supabase
        .from("followup_tasks")
        .select(SELECT_STAGE)
        .eq("tenant_id", tenantId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(capped);
      if (!withStage.error && withStage.data) {
        return withStage.data.map((row) => mapRow(row as Record<string, unknown>));
      }
      if (withStage.error && missingStageColumn(withStage.error.message)) {
        const legacy = await supabase
          .from("followup_tasks")
          .select(SELECT_LEGACY)
          .eq("tenant_id", tenantId)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(capped);
        if (legacy.error || !legacy.data) return [];
        return legacy.data.map((row) => mapRow(row as Record<string, unknown>));
      }
    }

    return [];
  } catch {
    return [];
  }
}

export async function countOpenFollowupsByPhone(): Promise<Record<string, number>> {
  const open = await listOpenFollowups(120);
  const counts: Record<string, number> = {};
  for (const task of open) {
    const phone = normalizeCrmPhone(task.phone);
    if (!phone) continue;
    counts[phone] = (counts[phone] ?? 0) + 1;
  }
  return counts;
}

/** Crea Lead solo si no hay seguimiento abierto para ese celular (webhook Inbox → CRM). */
export async function ensureLeadFromInbound(input: {
  tenantId: string;
  phone: string;
  customerName?: string;
  preview?: string;
}): Promise<{ created: boolean }> {
  const phone = normalizeCrmPhone(input.phone);
  const waPhone = normalizeWaPhone(input.phone) || phone;
  if (phone.length < 7 && (!waPhone || waPhone.length < 7)) return { created: false };

  const candidates = new Set<string>();
  if (phone) candidates.add(phone);
  if (waPhone) {
    candidates.add(waPhone);
    if (waPhone.startsWith("57") && waPhone.length === 12) candidates.add(waPhone.slice(2));
    if (waPhone.length === 10 && waPhone.startsWith("3")) candidates.add(`57${waPhone}`);
  }

  try {
    const supabase = createAdminSupabase();
    const { data: existing } = await supabase
      .from("followup_tasks")
      .select("id, phone")
      .eq("tenant_id", input.tenantId)
      .eq("status", "open")
      .in("phone", [...candidates])
      .limit(1);
    if (existing && existing.length > 0) return { created: false };

    const note = (input.preview?.trim() || "Mensaje entrante por WhatsApp").slice(0, 400);
    const result = await createFollowup({
      phone: phone.length >= 7 ? phone : waPhone!,
      customerName: (input.customerName || "").trim().slice(0, 120),
      note: note.length >= 4 ? note : "Mensaje entrante por WhatsApp",
      stage: "nuevo",
      priority: "normal",
      createdBy: "whatsapp-inbound",
    });
    return { created: !result.error };
  } catch {
    return { created: false };
  }
}

function phoneCandidates(phoneRaw: string): string[] {
  const waPhone = normalizeWaPhone(phoneRaw) || normalizeCrmPhone(phoneRaw);
  if (!waPhone) return [];
  const candidates = new Set<string>([waPhone]);
  if (waPhone.startsWith("57") && waPhone.length === 12) candidates.add(waPhone.slice(2));
  if (waPhone.length === 10 && waPhone.startsWith("3")) candidates.add(`57${waPhone}`);
  return [...candidates];
}

async function syncInboxStageByPhone(tenantId: string, phoneRaw: string, stage: FollowupStageId) {
  const phones = phoneCandidates(phoneRaw);
  if (phones.length === 0) return;
  const supabase = createAdminSupabase();
  const now = new Date().toISOString();
  for (const phone of phones) {
    await supabase
      .from("whatsapp_conversations")
      .update({ pipeline_stage: stage, updated_at: now })
      .eq("tenant_id", tenantId)
      .eq("phone", phone);
  }
}

async function syncInboxAssigneeByPhone(tenantId: string, phoneRaw: string, assignedTo: string) {
  const phones = phoneCandidates(phoneRaw);
  if (phones.length === 0) return;
  const supabase = createAdminSupabase();
  const now = new Date().toISOString();
  for (const phone of phones) {
    await supabase
      .from("whatsapp_conversations")
      .update({ assigned_to: assignedTo, updated_at: now })
      .eq("tenant_id", tenantId)
      .eq("phone", phone);
  }
}

export async function createFollowup(input: {
  phone: string;
  customerName: string;
  orderNumber?: string;
  note: string;
  createdBy: string;
  stage?: FollowupStageId;
  assignedTo?: string;
  dueAt?: string | null;
  priority?: FollowupPriority;
}): Promise<{ error: string | null; id: string | null }> {
  const phone = normalizeCrmPhone(input.phone);
  const note = input.note.trim().replace(/\s+/g, " ").slice(0, 400);
  const stage = normalizeFollowupStage(input.stage ?? "nuevo");
  const assignedTo = (input.assignedTo ?? "").trim().slice(0, 80);
  const priority = normalizePriority(input.priority);
  const dueAt = input.dueAt?.trim() ? new Date(input.dueAt).toISOString() : null;
  if (phone.length < 7) return { error: "Falta un teléfono válido del pedido.", id: null };
  if (note.length < 4) return { error: "Escribe una nota corta para el seguimiento.", id: null };
  if (dueAt && Number.isNaN(Date.parse(dueAt))) return { error: "Fecha de vencimiento inválida.", id: null };

  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const base = {
      tenant_id: tenantId,
      phone,
      customer_name: input.customerName.trim().slice(0, 120),
      order_number: (input.orderNumber ?? "").trim().slice(0, 40),
      note,
      stage,
      status: "open",
      created_by: input.createdBy.trim().slice(0, 80),
    };
    const withPro = {
      ...base,
      assigned_to: assignedTo,
      due_at: dueAt,
      priority,
    };

    const proInsert = await supabase.from("followup_tasks").insert(withPro).select("id").single();
    if (!proInsert.error) {
      await syncInboxStageByPhone(tenantId, phone, stage).catch(() => undefined);
      return { error: null, id: proInsert.data?.id ? String(proInsert.data.id) : null };
    }

    if (missingCrmProColumn(proInsert.error.message)) {
      const stageInsert = await supabase.from("followup_tasks").insert(base).select("id").single();
      if (!stageInsert.error) {
        await syncInboxStageByPhone(tenantId, phone, stage).catch(() => undefined);
        return { error: null, id: stageInsert.data?.id ? String(stageInsert.data.id) : null };
      }
      if (missingStageColumn(stageInsert.error.message)) {
        const { stage: _stage, ...legacyPayload } = base;
        const legacy = await supabase.from("followup_tasks").insert(legacyPayload).select("id").single();
        if (legacy.error) {
          return {
            error: missingTable(legacy.error.message)
              ? "Falta followup_tasks. Ejecuta supabase/migrations/013_followup_tasks.sql."
              : legacy.error.message,
            id: null,
          };
        }
        return { error: null, id: legacy.data?.id ? String(legacy.data.id) : null };
      }
      return {
        error: missingTable(stageInsert.error.message)
          ? "Falta followup_tasks. Ejecuta supabase/migrations/013_followup_tasks.sql."
          : stageInsert.error.message,
        id: null,
      };
    }

    return {
      error: missingTable(proInsert.error.message)
        ? "Falta followup_tasks. Ejecuta supabase/migrations/013_followup_tasks.sql."
        : /stage/i.test(proInsert.error.message)
          ? "Falta la columna stage. Ejecuta supabase/migrations/014_followup_pipeline.sql (o 021/022)."
          : proInsert.error.message,
      id: null,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar el seguimiento.",
      id: null,
    };
  }
}

export async function moveFollowupStage(input: {
  id: string;
  stage: FollowupStageId;
}): Promise<{ error: string | null }> {
  const id = input.id.trim();
  if (!id) return { error: "Falta el seguimiento." };
  if (!isFollowupStageId(input.stage)) return { error: "Etapa no válida." };

  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("followup_tasks")
      .update({ stage: input.stage })
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .eq("status", "open")
      .select("phone")
      .maybeSingle();

    if (error) {
      return {
        error: missingStageColumn(error.message)
          ? "Falta la columna stage. Ejecuta supabase/migrations/014_followup_pipeline.sql."
          : missingTable(error.message)
            ? "Falta followup_tasks. Ejecuta supabase/migrations/013_followup_tasks.sql."
            : error.message,
      };
    }
    if (data?.phone) {
      await syncInboxStageByPhone(tenantId, String(data.phone), input.stage).catch(() => undefined);
    }
    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo mover el seguimiento.",
    };
  }
}

export async function updateFollowupMeta(input: {
  id: string;
  assignedTo?: string;
  dueAt?: string | null;
  priority?: FollowupPriority;
}): Promise<{ error: string | null }> {
  const id = input.id.trim();
  if (!id) return { error: "Falta el seguimiento." };

  const patch: Record<string, unknown> = {};
  if (input.assignedTo !== undefined) patch.assigned_to = input.assignedTo.trim().slice(0, 80);
  if (input.priority !== undefined) patch.priority = normalizePriority(input.priority);
  if (input.dueAt !== undefined) {
    if (!input.dueAt || !input.dueAt.trim()) {
      patch.due_at = null;
    } else {
      const iso = new Date(input.dueAt).toISOString();
      if (Number.isNaN(Date.parse(iso))) return { error: "Fecha de vencimiento inválida." };
      patch.due_at = iso;
    }
  }
  if (Object.keys(patch).length === 0) return { error: null };

  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("followup_tasks")
      .update(patch)
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .eq("status", "open")
      .select("phone")
      .maybeSingle();

    if (error) {
      return {
        error: missingCrmProColumn(error.message)
          ? "Falta la migración 022_crm_pipeline_pro.sql (asignación / vencimiento)."
          : missingTable(error.message)
            ? "Falta followup_tasks. Ejecuta supabase/migrations/013_followup_tasks.sql."
            : error.message,
      };
    }
    if (data?.phone && input.assignedTo !== undefined) {
      await syncInboxAssigneeByPhone(tenantId, String(data.phone), input.assignedTo.trim()).catch(
        () => undefined,
      );
    }
    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo actualizar el seguimiento.",
    };
  }
}

export async function resolveFollowup(input: {
  id: string;
  status: "done" | "dismissed";
  resolvedBy: string;
}): Promise<{ error: string | null }> {
  const id = input.id.trim();
  if (!id) return { error: "Falta el seguimiento." };

  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { error } = await supabase
      .from("followup_tasks")
      .update({
        status: input.status,
        resolved_by: input.resolvedBy.trim().slice(0, 80),
        resolved_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .eq("status", "open");

    if (error) {
      return {
        error: missingTable(error.message)
          ? "Falta followup_tasks. Ejecuta supabase/migrations/013_followup_tasks.sql."
          : error.message,
      };
    }
    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo cerrar el seguimiento.",
    };
  }
}
