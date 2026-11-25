import { STATUS_LABEL, type OrderStatus } from "@/lib/demo-data";
import type { StoreOrder } from "@/lib/store-order";
import { createAdminSupabase } from "@/lib/supabase/admin";

function siteOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3010";
}

async function wantsEmailUpdates(userId: string | undefined) {
  if (!userId) return false;
  try {
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("customer_profiles")
      .select("email_order_updates")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return true;
    return data.email_order_updates !== false;
  } catch {
    return true;
  }
}

/**
 * Aviso de cambio de estado. Best-effort: sin RESEND_API_KEY no falla el pedido.
 */
export async function notifyCustomerOrderStatus(order: StoreOrder, previousStatus: OrderStatus) {
  if (!order.customerEmail?.includes("@")) return { sent: false, reason: "sin-correo" as const };
  if (order.status === previousStatus) return { sent: false, reason: "sin-cambio" as const };
  if (!(await wantsEmailUpdates(order.customerUserId))) {
    return { sent: false, reason: "opt-out" as const };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "COMPRUKI <onboarding@resend.dev>";
  if (!apiKey) {
    console.info("[customer-mail] RESEND_API_KEY ausente; no se envió aviso de", order.number);
    return { sent: false, reason: "sin-proveedor" as const };
  }

  const link = `${siteOrigin()}/tienda/pedido/${order.id}?t=${order.viewToken}`;
  const statusLabel = STATUS_LABEL[order.status] ?? order.status;
  const subject = `Pedido ${order.number}: ${statusLabel}`;
  const text = [
    `Hola ${order.customerName.trim() || "cliente"}.`,
    "",
    `Tu pedido ${order.number} ahora está: ${statusLabel}.`,
    `Consulta el detalle: ${link}`,
    "",
    "COMPRUKI no cobra en este correo. El pago es contra entrega.",
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [order.customerEmail],
        subject,
        text,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.info("[customer-mail] Resend falló", response.status, body.slice(0, 200));
      return { sent: false, reason: "error" as const };
    }
    return { sent: true as const };
  } catch (err) {
    console.info("[customer-mail] error", err instanceof Error ? err.message : err);
    return { sent: false, reason: "error" as const };
  }
}
