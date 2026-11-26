import { createAdminSupabase } from "@/lib/supabase/admin";
import { metaWaConfigured, metaWaEnvSummary, readMetaWaEnv } from "@/server/whatsapp/env";
import { getPilotTenantId } from "@/server/tenant";

export type WhatsAppConnectionStatus = "sin_configurar" | "configurada" | "verificada" | "error";

export type WhatsAppConnectionState = {
  id: string | null;
  status: WhatsAppConnectionStatus;
  phoneNumberId: string;
  businessAccountId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating: string;
  lastCheckedAt: string | null;
  lastInboundAt: string | null;
  lastError: string;
  detail: string;
  env: ReturnType<typeof metaWaEnvSummary>;
};

type ConnectionRow = {
  id: string;
  status: string;
  phone_number_id: string | null;
  business_account_id: string | null;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
  last_checked_at: string | null;
  last_inbound_at: string | null;
  last_error: string;
  detail: string;
};

function mapRow(row: ConnectionRow | null): WhatsAppConnectionState {
  const env = metaWaEnvSummary();
  if (!row) {
    return {
      id: null,
      status: env.ready ? "configurada" : "sin_configurar",
      phoneNumberId: readMetaWaEnv().phoneNumberId || "",
      businessAccountId: readMetaWaEnv().businessAccountId || "",
      displayPhoneNumber: "",
      verifiedName: "",
      qualityRating: "",
      lastCheckedAt: null,
      lastInboundAt: null,
      lastError: "",
      detail: env.ready
        ? "Credenciales en Railway. Aún no se verificó el número con Meta."
        : "Faltan variables META_WA_* en Railway.",
      env,
    };
  }

  let status = row.status as WhatsAppConnectionStatus;
  if (!env.ready) status = "sin_configurar";
  else if (status === "sin_configurar") status = "configurada";

  return {
    id: row.id,
    status,
    phoneNumberId: row.phone_number_id || readMetaWaEnv().phoneNumberId || "",
    businessAccountId: row.business_account_id || readMetaWaEnv().businessAccountId || "",
    displayPhoneNumber: row.display_phone_number || "",
    verifiedName: row.verified_name || "",
    qualityRating: row.quality_rating || "",
    lastCheckedAt: row.last_checked_at,
    lastInboundAt: row.last_inbound_at,
    lastError: row.last_error || "",
    detail: row.detail || "",
    env,
  };
}

export async function probeWhatsAppTables(): Promise<boolean> {
  try {
    const supabase = createAdminSupabase();
    const { error } = await supabase.from("whatsapp_connections").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function readWhatsAppConnection(tenantId?: string): Promise<WhatsAppConnectionState> {
  const id = tenantId ?? (await getPilotTenantId());
  try {
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("whatsapp_connections")
      .select(
        "id, status, phone_number_id, business_account_id, display_phone_number, verified_name, quality_rating, last_checked_at, last_inbound_at, last_error, detail",
      )
      .eq("tenant_id", id)
      .eq("provider", "meta_cloud")
      .maybeSingle();
    if (error) return mapRow(null);
    return mapRow((data as ConnectionRow | null) ?? null);
  } catch {
    return mapRow(null);
  }
}

export async function upsertWhatsAppConnection(
  tenantId: string,
  patch: {
    status: WhatsAppConnectionStatus;
    phoneNumberId?: string;
    businessAccountId?: string;
    displayPhoneNumber?: string;
    verifiedName?: string;
    qualityRating?: string;
    lastError?: string;
    detail?: string;
    touchChecked?: boolean;
    touchInbound?: boolean;
  },
) {
  const supabase = createAdminSupabase();
  const env = readMetaWaEnv();
  const payload = {
    tenant_id: tenantId,
    provider: "meta_cloud",
    status: patch.status,
    phone_number_id: patch.phoneNumberId ?? env.phoneNumberId ?? null,
    business_account_id: patch.businessAccountId ?? env.businessAccountId ?? null,
    display_phone_number: patch.displayPhoneNumber ?? "",
    verified_name: patch.verifiedName ?? "",
    quality_rating: patch.qualityRating ?? "",
    last_error: patch.lastError ?? "",
    detail: patch.detail ?? "",
    updated_at: new Date().toISOString(),
    ...(patch.touchChecked ? { last_checked_at: new Date().toISOString() } : {}),
    ...(patch.touchInbound ? { last_inbound_at: new Date().toISOString() } : {}),
  };

  const { error } = await supabase.from("whatsapp_connections").upsert(payload, {
    onConflict: "tenant_id,provider",
  });
  if (error) throw new Error(error.message);
}

export async function ensureWhatsAppConnectionRow(tenantId: string) {
  if (!metaWaConfigured()) return;
  const current = await readWhatsAppConnection(tenantId);
  if (current.id && current.status !== "sin_configurar") return;
  await upsertWhatsAppConnection(tenantId, {
    status: "configurada",
    detail: "Credenciales detectadas en Railway. Verifica el número desde el panel.",
  });
}

export type RecentWaMessage = {
  id: string;
  waMessageId: string;
  direction: "inbound" | "outbound";
  phone: string;
  contactName: string;
  body: string;
  messageType: string;
  deliveryStatus: string;
  createdBy: string;
  createdAt: string;
};

export async function listRecentWhatsAppMessages(tenantId: string, limit = 20): Promise<RecentWaMessage[]> {
  try {
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select(
        "id, wa_message_id, direction, phone, contact_name, body, message_type, delivery_status, created_by, created_at",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((row) => ({
      id: String(row.id),
      waMessageId: String(row.wa_message_id),
      direction: row.direction === "outbound" ? "outbound" : "inbound",
      phone: String(row.phone),
      contactName: String(row.contact_name ?? ""),
      body: String(row.body ?? ""),
      messageType: String(row.message_type ?? "text"),
      deliveryStatus: String(row.delivery_status ?? ""),
      createdBy: String(row.created_by ?? ""),
      createdAt: String(row.created_at),
    }));
  } catch {
    return [];
  }
}

export async function insertWhatsAppMessage(
  tenantId: string,
  input: {
    waMessageId: string;
    direction: "inbound" | "outbound";
    phone: string;
    contactName?: string;
    body: string;
    messageType?: string;
    deliveryStatus?: string;
    deliveryDetail?: string;
    createdBy?: string;
  },
) {
  const supabase = createAdminSupabase();
  const { error } = await supabase.from("whatsapp_messages").upsert(
    {
      tenant_id: tenantId,
      wa_message_id: input.waMessageId,
      direction: input.direction,
      phone: input.phone,
      contact_name: input.contactName ?? "",
      body: input.body,
      message_type: input.messageType ?? "text",
      delivery_status: input.deliveryStatus ?? (input.direction === "inbound" ? "received" : "sent"),
      delivery_detail: input.deliveryDetail ?? "",
      created_by: input.createdBy ?? "",
    },
    { onConflict: "tenant_id,wa_message_id", ignoreDuplicates: true },
  );
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export async function updateWhatsAppDelivery(
  tenantId: string,
  waMessageId: string,
  status: string,
  detail = "",
) {
  const supabase = createAdminSupabase();
  await supabase
    .from("whatsapp_messages")
    .update({
      delivery_status: status,
      delivery_detail: detail.slice(0, 400),
    })
    .eq("tenant_id", tenantId)
    .eq("wa_message_id", waMessageId);
}

/** Solo dígitos; Colombia 10 dígitos → 57… */
export function normalizeWaPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  return digits;
}
