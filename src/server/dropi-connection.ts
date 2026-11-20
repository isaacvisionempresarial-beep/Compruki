"use server";

import { revalidatePath } from "next/cache";
import { dropiAdapter, emptyDropiQueue, type DropiEnqueueState, type DropiQueueSnapshot, type DropiQueuedJob } from "@/lib/dropi-provider";
import { awaitsDropiNumber } from "@/lib/store-order";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { appendOrderHistory, getOrder } from "@/server/order-store";
import { assertPanelAccess } from "@/server/panel-auth";
import { getPilotTenantId } from "@/server/tenant";

const QUEUE_NOTE =
  "Quedó en la cola para Dropi. Sigue bloqueada: esta aplicación no tiene autorización. No se creó una orden allá. El total guardado no cambió. Nadie cobra en el sitio.";

type LinkRow = {
  order_id: string;
  order_number: string;
  sync_status: string;
  external_order_id: string | null;
  idempotency_key: string;
};

function missingTable(message: string) {
  return message.includes("schema cache") || message.includes("does not exist") || message.includes("Could not find");
}

function blockedJob(row: LinkRow): DropiQueuedJob {
  const extra = row.external_order_id?.trim()
    ? " Hay un número en la fila, pero esta aplicación no lo envió."
    : row.sync_status === "bloqueado"
      ? ""
      : " La fila no puede darse por enviada: no hay autorización.";
  return {
    orderId: row.order_id,
    orderNumber: row.order_number,
    status: "bloqueado",
    detail: `Bloqueado: no hay autorización.${extra} No se creó una orden en Dropi.`,
  };
}

export async function readDropiQueue(): Promise<DropiQueueSnapshot> {
  try {
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
      jobs: ((links.data ?? []) as LinkRow[]).map(blockedJob),
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
  if (!/^ord_[0-9a-f]{8}$/i.test(orderId)) {
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
      .select("id")
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
