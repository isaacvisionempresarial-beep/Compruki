import { createAdminSupabase } from "@/lib/supabase/admin";
import { normalizeCrmPhone } from "@/lib/crm-contacts";
import { getPilotTenantId } from "@/server/tenant";

export type FollowupStatus = "open" | "done" | "dismissed";

export type FollowupTask = {
  id: string;
  phone: string;
  customerName: string;
  orderNumber: string;
  note: string;
  status: FollowupStatus;
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
    status,
    createdBy: typeof row.created_by === "string" ? row.created_by : "",
    resolvedBy: typeof row.resolved_by === "string" ? row.resolved_by : "",
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

const SELECT =
  "id, phone, customer_name, order_number, note, status, created_by, resolved_by, resolved_at, created_at";

export async function listOpenFollowups(limit = 40): Promise<FollowupTask[]> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("followup_tasks")
      .select(SELECT)
      .eq("tenant_id", tenantId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(Math.min(80, Math.max(1, limit)));

    if (error) {
      if (missingTable(error.message)) return [];
      return [];
    }
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function countOpenFollowupsByPhone(): Promise<Record<string, number>> {
  const open = await listOpenFollowups(80);
  const counts: Record<string, number> = {};
  for (const task of open) {
    const phone = normalizeCrmPhone(task.phone);
    if (!phone) continue;
    counts[phone] = (counts[phone] ?? 0) + 1;
  }
  return counts;
}

export async function createFollowup(input: {
  phone: string;
  customerName: string;
  orderNumber?: string;
  note: string;
  createdBy: string;
}): Promise<{ error: string | null; id: string | null }> {
  const phone = normalizeCrmPhone(input.phone);
  const note = input.note.trim().replace(/\s+/g, " ").slice(0, 400);
  if (phone.length < 7) return { error: "Falta un teléfono válido del pedido.", id: null };
  if (note.length < 4) return { error: "Escribe una nota corta para el seguimiento.", id: null };

  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("followup_tasks")
      .insert({
        tenant_id: tenantId,
        phone,
        customer_name: input.customerName.trim().slice(0, 120),
        order_number: (input.orderNumber ?? "").trim().slice(0, 40),
        note,
        status: "open",
        created_by: input.createdBy.trim().slice(0, 80),
      })
      .select("id")
      .single();

    if (error) {
      return {
        error: missingTable(error.message)
          ? "Falta followup_tasks. Ejecuta supabase/migrations/013_followup_tasks.sql."
          : error.message,
        id: null,
      };
    }
    return { error: null, id: data?.id ? String(data.id) : null };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar el seguimiento.",
      id: null,
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
