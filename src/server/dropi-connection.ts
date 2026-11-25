"use server";

import { revalidatePath } from "next/cache";
import { dropiAdapter, emptyDropiQueue, type DropiEnqueueState, type DropiQueueSnapshot, type DropiQueuedJob } from "@/lib/dropi-provider";
import { awaitsDropiNumber, isStoreOrderId, validateProviderRef } from "@/lib/store-order";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { appendOrderHistory, getOrder, listOrders } from "@/server/order-store";
import { assertPanelAccess } from "@/server/panel-auth";
import { getPilotTenantId } from "@/server/tenant";

const QUEUE_NOTE =
  "Quedó en la cola para Dropi. Sigue bloqueada: esta aplicación no tiene autorización. No se creó una orden allá. El total guardado no cambió. Nadie cobra en el sitio.";

type LinkRow = {
  id: string;
  order_id: string;
  order_number: string;
  sync_status: string;
  external_order_id: string | null;
  idempotency_key: string;
};

function missingTable(message: string) {
  return message.includes("schema cache") || message.includes("does not exist") || message.includes("Could not find");
}

const RECONCILED_DETAIL = "Anotado a mano. Esta aplicación no lo envió y no lo reintentará.";
const NOTICE_DETAIL =
  "Aviso operativo: no hay autorización para enviar. No se reintenta. La recuperación es anotar el número a mano. El cliente no recibe este aviso.";

function presentJob(row: LinkRow): DropiQueuedJob {
  const noted = row.external_order_id?.trim();
  if (noted) {
    return {
      orderId: row.order_id,
      orderNumber: row.order_number,
      status: "conciliado",
      detail: `${RECONCILED_DETAIL} Número ${noted}. El total guardado no cambió.`,
    };
  }
  if (row.sync_status === "incidencia") {
    return {
      orderId: row.order_id,
      orderNumber: row.order_number,
      status: "aviso",
      detail: `${NOTICE_DETAIL} El total guardado no cambió.`,
    };
  }
  return {
    orderId: row.order_id,
    orderNumber: row.order_number,
    status: "bloqueado",
    detail:
      row.sync_status === "bloqueado"
        ? "Bloqueado: no hay autorización. No se creó una orden en Dropi."
        : "La fila no puede darse por enviada: no hay autorización. No se creó una orden en Dropi.",
  };
}

async function reconcileNotedDropiNumbers() {
  const access = await assertPanelAccess();
  if (!access) return;
  const tenantId = await getPilotTenantId();
  const supabase = createAdminSupabase();
  const [orders, links] = await Promise.all([
    listOrders(),
    supabase
      .from("provider_order_links")
      .select("id, order_id, order_number, sync_status, external_order_id, idempotency_key")
      .eq("tenant_id", tenantId)
      .eq("provider", "dropi")
      .limit(200),
  ]);
  if (links.error) return;

  const linkByOrder = new Map((links.data as LinkRow[]).map((row) => [row.order_id, row]));
  for (const order of orders) {
    const noted = validateProviderRef(order.providerRef ?? "").value;
    const link = linkByOrder.get(order.id);
    const stableKey = /^[0-9a-f-]{36}$/i.test(order.idempotencyKey);
    const idempotencyKey = link?.idempotency_key || (stableKey ? `dropi:${order.idempotencyKey}` : "");
    if (noted) {
      if (!idempotencyKey) continue;
      if (link?.external_order_id === noted) {
        await supabase
          .from("integration_jobs")
          .update({ status: "bloqueado", next_run_at: null, last_detail: RECONCILED_DETAIL })
          .eq("tenant_id", tenantId)
          .eq("idempotency_key", idempotencyKey)
          .neq("last_detail", RECONCILED_DETAIL);
        continue;
      }
      if (!link) {
        const inserted = await supabase.from("provider_order_links").insert({
          tenant_id: tenantId,
          order_id: order.id,
          order_number: order.number,
          provider: "dropi",
          external_order_id: noted,
          idempotency_key: idempotencyKey,
          sync_status: "bloqueado",
        });
        if (inserted.error && inserted.error.code !== "23505") continue;
      } else {
        await supabase
          .from("provider_order_links")
          .update({ external_order_id: noted, sync_status: "bloqueado", order_number: order.number })
          .eq("id", link.id);
      }
      await writeBlockedJob(supabase, tenantId, order.id, order.number, idempotencyKey, RECONCILED_DETAIL);
      continue;
    }
    if (link?.external_order_id) {
      await supabase.from("provider_order_links").update({ external_order_id: null, sync_status: "bloqueado" }).eq("id", link.id);
      await writeBlockedJob(supabase, tenantId, order.id, order.number, idempotencyKey, dropiAdapter.createOrder().detail);
    }
  }
}

async function writeBlockedJob(
  supabase: ReturnType<typeof createAdminSupabase>,
  tenantId: string,
  orderId: string,
  orderNumber: string,
  idempotencyKey: string,
  detail: string,
) {
  const existing = await supabase
    .from("integration_jobs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing.error) return;
  if (!existing.data) {
    await supabase.from("integration_jobs").insert({
      tenant_id: tenantId,
      job_type: "enviar_pedido",
      status: "bloqueado",
      attempts: 0,
      next_run_at: null,
      correlation_id: orderId,
      order_number: orderNumber,
      idempotency_key: idempotencyKey,
      last_detail: detail,
    });
    return;
  }
  await supabase
    .from("integration_jobs")
    .update({ status: "bloqueado", next_run_at: null, last_detail: detail, order_number: orderNumber })
    .eq("id", existing.data.id);
}

export async function readDropiQueue(): Promise<DropiQueueSnapshot> {
  try {
    try {
      await reconcileNotedDropiNumbers();
    } catch {
      // La lectura sigue. Un fallo al conciliar no marca la tienda como conectada.
    }
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const connection = await supabase
      .from("provider_connections")
      .select("status, detail, credential_ref")
      .eq("tenant_id", tenantId)
      .eq("provider", "dropi")
      .maybeSingle();
    if (connection.error) {
      if (missingTable(connection.error.message)) {
        return emptyDropiQueue("Falta la tabla de conexión. Corre 011_dropi_connection.sql en Supabase. Dropi sigue sin estar conectado.");
      }
      return emptyDropiQueue("No se pudo leer la conexión. Dropi sigue sin estar conectado.");
    }

    const links = await supabase
      .from("provider_order_links")
      .select("order_id, order_number, sync_status, external_order_id, idempotency_key")
      .eq("tenant_id", tenantId)
      .eq("provider", "dropi")
      .order("created_at", { ascending: false })
      .limit(50);
    if (links.error) {
      if (missingTable(links.error.message)) {
        return emptyDropiQueue("Falta la tabla de la cola. Corre 011_dropi_connection.sql en Supabase. Dropi sigue sin estar conectado.");
      }
      return emptyDropiQueue("No se pudo leer la cola. Dropi sigue sin estar conectado.");
    }

    const detail = connection.data?.detail?.trim()
      ? connection.data.detail.trim()
      : "Sin autorización. No hay token ni contraseña guardados.";
    return {
      connection: {
        tableReady: true,
        status: "sin_autorizacion",
        passwordStored: false,
        tokenStored: false,
        appRegistered: false,
        detail: connection.data?.credential_ref
          ? `${detail} La referencia guardada no es un token usable. Sigue sin estar conectado.`
          : detail,
      },
      jobs: ((links.data ?? []) as LinkRow[]).map(presentJob),
    };
  } catch {
    return emptyDropiQueue("No se pudo leer la cola. Dropi sigue sin estar conectado.");
  }
}

export async function recordDropiAdvertisement(detail: string) {
  const text = detail.trim().slice(0, 400);
  if (!text) return;
  try {
    const access = await assertPanelAccess();
    if (!access) return;
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    await supabase
      .from("provider_connections")
      .update({
        status: "sin_autorizacion",
        credential_ref: null,
        scopes: "",
        last_checked_at: new Date().toISOString(),
        detail: text,
      })
      .eq("tenant_id", tenantId)
      .eq("provider", "dropi");
  } catch {
    return;
  }
}

export async function enqueueDropiSend(_state: DropiEnqueueState, formData: FormData): Promise<DropiEnqueueState> {
  const denied = dropiAdapter.createOrder();
  const access = await assertPanelAccess();
  if (!access) return { error: "Entra al panel para dejar un pedido en la cola.", message: null };
  if (access.role !== "owner") {
    return { error: "Solo el propietario deja un pedido en la cola. No se envió ni se cobró.", message: null };
  }

  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!isStoreOrderId(orderId)) {
    return { error: "No encontré ese pedido. El total guardado no cambió.", message: null };
  }

  const order = await getOrder(orderId);
  if (!order) return { error: "No encontré ese pedido. El total guardado no cambió.", message: null };
  if (!awaitsDropiNumber(order)) {
    return {
      error: "Este pedido no se encola. Hace falta confirmarlo y que todavía no tenga número de Dropi. El total guardado no cambió.",
      message: null,
    };
  }
  if (!/^[0-9a-f-]{36}$/i.test(order.idempotencyKey)) {
    return { error: "Este pedido no tiene una clave estable. No se encoló.", message: null };
  }

  const idempotencyKey = `dropi:${order.idempotencyKey}`;
  let alreadyQueued = false;
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const existing = await supabase
      .from("provider_order_links")
      .select("id, external_order_id")
      .eq("tenant_id", tenantId)
      .eq("provider", "dropi")
      .eq("order_id", order.id)
      .maybeSingle();
    if (existing.error) {
      return {
        error: missingTable(existing.error.message)
          ? "Falta la tabla de la cola. Corre 011_dropi_connection.sql en Supabase. El pedido no cambió."
          : "No se pudo leer la cola. El pedido no cambió.",
        message: null,
      };
    }

    if (existing.data?.external_order_id) {
      return {
        error: null,
        message: "Ya está conciliado a mano. No se crea otro envío. El total guardado no cambió.",
      };
    }

    alreadyQueued = Boolean(existing.data);
    if (!alreadyQueued) {
      const inserted = await supabase.from("provider_order_links").insert({
        tenant_id: tenantId,
        order_id: order.id,
        order_number: order.number,
        provider: "dropi",
        external_order_id: null,
        idempotency_key: idempotencyKey,
        sync_status: "bloqueado",
      });
      if (inserted.error) {
        if (inserted.error.code === "23505") {
          alreadyQueued = true;
        } else {
          return {
            error: missingTable(inserted.error.message)
              ? "Falta la tabla de la cola. Corre 011_dropi_connection.sql en Supabase. El pedido no cambió."
              : "No se pudo dejar el pedido en la cola. No se envió a Dropi.",
            message: null,
          };
        }
      }
    }

    const job = await supabase.from("integration_jobs").insert({
      tenant_id: tenantId,
      job_type: "enviar_pedido",
      status: "bloqueado",
      attempts: 0,
      next_run_at: null,
      correlation_id: order.id,
      order_number: order.number,
      idempotency_key: idempotencyKey,
      last_detail: denied.detail,
    });
    if (job.error && job.error.code !== "23505") {
      return {
        error: missingTable(job.error.message)
          ? "Falta la tabla de trabajos. Corre 011_dropi_connection.sql en Supabase. No se envió a Dropi."
          : "La cola quedó a medias. Recarga Sincronización. No se envió a Dropi.",
        message: null,
      };
    }

    if (!alreadyQueued) {
      const noted = await appendOrderHistory(order.id, QUEUE_NOTE, access.actorName);
      if (noted.error) {
        return { error: "Quedó en la cola, pero el historial no se anotó. No se envió a Dropi.", message: null };
      }
    }
  } catch {
    return { error: "No se pudo dejar el pedido en la cola. No se envió a Dropi.", message: null };
  }

  revalidatePath("/panel/sincronizacion");
  revalidatePath("/panel/conexiones");
  revalidatePath("/panel/pedidos", "layout");
  return {
    error: null,
    message: alreadyQueued
      ? "Ya estaba en la cola. No se creó otra. No se envió a Dropi y el total guardado no cambió."
      : "Quedó en la cola, bloqueado. Dropi no está conectado: no se creó una orden allá y el total guardado no cambió.",
  };
}

async function markQueueNotice(orderId: string, active: boolean) {
  const tenantId = await getPilotTenantId();
  const supabase = createAdminSupabase();
  const link = await supabase
    .from("provider_order_links")
    .select("id, order_number, external_order_id, idempotency_key, sync_status")
    .eq("tenant_id", tenantId)
    .eq("provider", "dropi")
    .eq("order_id", orderId)
    .maybeSingle();
  if (link.error) {
    return {
      error: missingTable(link.error.message)
        ? "Falta la tabla de la cola. El pedido no se envió."
        : "No se pudo leer la cola. El pedido no se envió.",
    };
  }
  if (!link.data || link.data.external_order_id) return { error: null };
  const nextStatus = active ? "incidencia" : "bloqueado";
  if (!active && link.data.sync_status !== "incidencia") return { error: null };
  if (active && link.data.sync_status === "incidencia") return { error: null };
  const detail = active ? NOTICE_DETAIL : dropiAdapter.createOrder().detail;
  const updated = await supabase.from("provider_order_links").update({ sync_status: nextStatus }).eq("id", link.data.id);
  if (updated.error) return { error: "No se pudo registrar el aviso. No se envió a Dropi." };
  await supabase
    .from("integration_jobs")
    .update({ status: nextStatus, next_run_at: null, last_detail: detail })
    .eq("tenant_id", tenantId)
    .eq("idempotency_key", link.data.idempotency_key);
  return { error: null };
}

export async function syncQueueWithOrderIncident(orderId: string, active: boolean) {
  try {
    return await markQueueNotice(orderId, active);
  } catch {
    return { error: "No se pudo registrar el aviso. No se envió a Dropi." };
  }
}

export async function recordOperationalNotice(_state: DropiEnqueueState, formData: FormData): Promise<DropiEnqueueState> {
  const access = await assertPanelAccess();
  if (!access) return { error: "Entra al panel para dejar el aviso.", message: null };
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!isStoreOrderId(orderId)) {
    return { error: "No encontré ese pedido. El total guardado no cambió.", message: null };
  }
  const order = await getOrder(orderId);
  if (!order) return { error: "No encontré ese pedido. El total guardado no cambió.", message: null };
  if (validateProviderRef(order.providerRef ?? "").value) {
    return { error: null, message: "Ya tiene número anotado. No hace falta un aviso de envío. El total guardado no cambió." };
  }

  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const link = await supabase
      .from("provider_order_links")
      .select("id, sync_status, external_order_id")
      .eq("tenant_id", tenantId)
      .eq("provider", "dropi")
      .eq("order_id", order.id)
      .maybeSingle();
    if (link.error) {
      return {
        error: missingTable(link.error.message)
          ? "Falta la tabla de la cola. Corre 011_dropi_connection.sql en Supabase. El pedido no cambió."
          : "No se pudo leer la cola. El pedido no cambió.",
        message: null,
      };
    }
    if (!link.data) {
      return { error: "Primero déjalo en la cola. El aviso no envía el pedido y el total guardado no cambia.", message: null };
    }
    if (link.data.external_order_id) {
      return { error: null, message: "Ya está conciliado a mano. No se crea un aviso de envío. El total guardado no cambió." };
    }
    if (link.data.sync_status === "incidencia") {
      return { error: null, message: "El aviso ya estaba. No se creó otro y no se envió a Dropi." };
    }
  } catch {
    return { error: "No se pudo registrar el aviso. No se envió a Dropi.", message: null };
  }

  const marked = await syncQueueWithOrderIncident(order.id, true);
  if (marked.error) return { error: marked.error, message: null };
  const noted = await appendOrderHistory(
    order.id,
    "Dejó un aviso operativo en la cola de Dropi. No se envió, no se reintenta y el cliente no recibe este aviso. El total guardado no cambió. Nadie cobra en el sitio.",
    access.actorName,
  );
  if (noted.error) return { error: "El aviso quedó en la cola, pero el historial no se anotó. No se envió a Dropi.", message: null };

  revalidatePath("/panel/sincronizacion");
  revalidatePath("/panel/conexiones");
  revalidatePath("/panel/pedidos", "layout");
  return {
    error: null,
    message: "Quedó el aviso operativo. No se envió a Dropi, no se reintenta y el cliente no lo recibe. El total guardado no cambió.",
  };
}
