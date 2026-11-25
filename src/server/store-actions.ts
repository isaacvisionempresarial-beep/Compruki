"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { campaignSkusInOrder } from "@/lib/campaign";
import { parsePesos } from "@/lib/catalog";
import { assertPanelAccess } from "@/server/panel-auth";
import { normalizePhone, ownerOnlyOrderIntent, type OrderAction } from "@/lib/store-order";
import { syncQueueWithOrderIncident } from "@/server/dropi-connection";
import { addOrderLine, applyCatalogCosts, applySkuCatalogCosts, markBuyerNoteSeen, markCustomerNotice, placeOrder, saveClosedDepartment, saveDelivery, saveFreight, saveIncidenceReason, saveInternalNote, saveOrderLines, saveProviderRef, saveReturnReason, updateOrder } from "@/server/order-store";

function refreshOrderScreens() {
  revalidatePath("/panel/pedidos");
  revalidatePath("/panel/pedidos/[number]", "page");
  revalidatePath("/panel/sincronizacion");
  revalidatePath("/panel/sincronizacion/[number]", "page");
}

const ORDER_ACTIONS: OrderAction[] = [
  "confirmar",
  "preparar",
  "despachar",
  "entregar",
  "cobrar",
  "quitar_cobro",
  "incidencia",
  "cancelar",
  "resolver",
  "devolver",
];

export type PlaceOrderState = { error: string | null };

function campaignSkusFrom(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? "[]")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return campaignSkusInOrder(
      parsed.map((sku) => ({ sku: String(sku ?? "") })),
      parsed.map((sku) => String(sku ?? "")),
    );
  } catch {
    return [];
  }
}

export async function placeOrderAction(_state: PlaceOrderState, formData: FormData): Promise<PlaceOrderState> {
  let lines: Array<{ sku: string; quantity: number }> = [];
  try {
    const parsed = JSON.parse(String(formData.get("lines") ?? "[]")) as unknown;
    if (!Array.isArray(parsed)) throw new Error("invalid");
    lines = parsed.map((line) => {
      const item = line as { sku?: unknown; quantity?: unknown; variant?: unknown };
      return { sku: String(item.sku ?? ""), quantity: Number(item.quantity), variant: String(item.variant ?? "") };
    });
  } catch {
    return { error: "No se pudo leer el carrito. Vuelve a abrirlo." };
  }

  const result = await placeOrder({
    idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
    customerName: String(formData.get("customerName") ?? ""),
    phone: normalizePhone(String(formData.get("phone") ?? "")),
    document: String(formData.get("document") ?? ""),
    city: String(formData.get("city") ?? ""),
    department: String(formData.get("department") ?? ""),
    address: String(formData.get("address") ?? ""),
    reference: String(formData.get("reference") ?? ""),
    accepted: formData.get("accepted") === "on",
    lines,
    campaignSkus: campaignSkusFrom(formData.get("campaignSkus")),
  });

  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo registrar el pedido." };
  }

  refreshOrderScreens();
  const flag = result.repeated ? "ya=1" : "nuevo=1";
  redirect(`/tienda/pedido/${result.order.id}?t=${result.order.viewToken}&${flag}`);
}

export type UpdateOrderState = { error: string | null; orderId: string | null };

export async function updateOrderAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const access = await assertPanelAccess();
    if (!access) {
      return { error: "Tu sesión no permite cambiar este pedido.", orderId };
    }

  const intent = String(formData.get("intent") ?? "");
  if (!ORDER_ACTIONS.includes(intent as OrderAction)) {
    return { error: "Esa acción no existe.", orderId };
  }
  if (ownerOnlyOrderIntent(intent) && access.role !== "owner") {
    return { error: "Solo el propietario puede marcar o quitar el cobro.", orderId };
  }

  const result = await updateOrder(orderId, intent as OrderAction, access.actorName, String(formData.get("customerReason") ?? ""));
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo actualizar el pedido.", orderId };
  }
  if (intent === "incidencia" || intent === "resolver") {
    await syncQueueWithOrderIncident(orderId, intent === "incidencia");
  }

  refreshOrderScreens();
  revalidatePath("/panel/catalogo");
  revalidatePath("/panel/rentabilidad");
  revalidatePath("/panel");
  revalidatePath(`/tienda/pedido/${result.order.id}`);
  return { error: null, orderId };
}

function readPesos(raw: string, label: string) {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null as number | null, error: null as string | null };
  const value = parsePesos(trimmed);
  if (value === null || value > 5_000_000) {
    return { value: null, error: `Escribe ${label} en pesos, sin centavos, hasta $5.000.000.` };
  }
  return { value, error: null };
}

export async function saveFreightAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const access = await assertPanelAccess();
  if (!access) {
    return { error: "Tu sesión no permite anotar el flete.", orderId };
  }
  if (access.role !== "owner") {
    return { error: "Solo el propietario puede anotar el flete y el recaudo.", orderId };
  }

  const shipping = readPesos(String(formData.get("actualShipping") ?? ""), "el flete");
  const returning = readPesos(String(formData.get("returnFreight") ?? ""), "el flete");
  const collection = readPesos(String(formData.get("collectionCost") ?? ""), "el recaudo");
  if (shipping.error || returning.error || collection.error) {
    return { error: shipping.error ?? returning.error ?? collection.error, orderId };
  }

  const result = await saveFreight(
    orderId,
    { actualShipping: shipping.value, returnFreight: returning.value, collectionCost: collection.value },
    access.actorName,
  );
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo guardar el flete.", orderId };
  }

  refreshOrderScreens();
  revalidatePath("/panel/catalogo");
  revalidatePath("/panel/rentabilidad");
  revalidatePath("/panel");
  return { error: null, orderId };
}

export async function applyCatalogCostAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const access = await assertPanelAccess();
  if (!access) {
    return { error: "Tu sesión no permite anotar el costo.", orderId };
  }
  if (access.role !== "owner") {
    return { error: "Solo el propietario puede copiar el costo de la ficha a este pedido.", orderId };
  }

  const result = await applyCatalogCosts(orderId, access.actorName);
  if (result.error || !result.order) return { error: result.error ?? "No se pudo anotar el costo de la ficha.", orderId };
  if (!result.saved) return { error: null, orderId };

  refreshOrderScreens();
  revalidatePath("/panel/catalogo");
  revalidatePath("/panel/rentabilidad");
  revalidatePath("/panel");
  return { error: null, orderId };
}

export type SkuCostState = { error: string | null; saved: number; scope: "cuentan" | "fuera" | null };

export async function applySkuCatalogCostAction(_state: SkuCostState, formData: FormData): Promise<SkuCostState> {
  const sku = String(formData.get("sku") ?? "");
  const scope = formData.get("scope") === "fuera" ? "fuera" : formData.get("scope") === "cuentan" ? "cuentan" : null;
  const access = await assertPanelAccess();
  if (!access) return { error: "Tu sesión no permite copiar el costo.", saved: 0, scope };
  if (access.role !== "owner") return { error: "Solo el propietario puede copiar el costo de la ficha a los pedidos.", saved: 0, scope };
  if (!scope) return { error: "Elige si copias los que ya cuentan o los que siguen fuera.", saved: 0, scope: null };
  const result = await applySkuCatalogCosts(sku, access.actorName, scope);
  if (result.error) return { error: result.error, saved: 0, scope };
  if (result.saved === 0) return { error: null, saved: 0, scope };
  refreshOrderScreens();
  revalidatePath("/panel/catalogo");
  revalidatePath(`/panel/catalogo/${encodeURIComponent(sku.trim().toUpperCase())}`);
  revalidatePath("/panel/rentabilidad");
  revalidatePath("/panel");
  return { error: null, saved: result.saved, scope };
}

export async function saveProviderRefAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const access = await assertPanelAccess();
    if (!access) {
      return { error: "Tu sesión no permite anotar el número de Dropi.", orderId };
    }

  const clearing = formData.get("intent") === "quitar";
  const result = await saveProviderRef(orderId, clearing ? null : String(formData.get("providerRef") ?? ""), access.actorName);
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo anotar el número de Dropi.", orderId };
  }

  refreshOrderScreens();
  revalidatePath("/panel");
  return { error: null, orderId };
}

export async function saveClosedDepartmentAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const access = await assertPanelAccess();
    if (!access) {
      return { error: "Tu sesión no permite anotar en este pedido.", orderId };
    }

  const result = await saveClosedDepartment(orderId, String(formData.get("department") ?? ""), access.actorName);
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo anotar el departamento.", orderId };
  }

  refreshOrderScreens();
  revalidatePath("/panel");
  revalidatePath(`/tienda/pedido/${orderId}`);
  return { error: null, orderId };
}

export async function saveDeliveryAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const access = await assertPanelAccess();
    if (!access) {
      return { error: "Tu sesión no permite corregir este pedido.", orderId };
    }

  const result = await saveDelivery(
    orderId,
    {
      customerName: String(formData.get("customerName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      document: String(formData.get("document") ?? ""),
      city: String(formData.get("city") ?? ""),
      department: String(formData.get("department") ?? ""),
      address: String(formData.get("address") ?? ""),
      reference: String(formData.get("reference") ?? ""),
    },
    access.actorName,
  );
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudieron guardar los datos de entrega.", orderId };
  }

  refreshOrderScreens();
  revalidatePath("/panel");
  revalidatePath(`/tienda/pedido/${orderId}`);
  return { error: null, orderId };
}

function lineEditsFrom(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? "")) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item) => {
      const line = item as { sku?: unknown; variant?: unknown; nextVariant?: unknown; quantity?: unknown };
      return {
        sku: String(line.sku ?? ""),
        variant: String(line.variant ?? ""),
        ...(typeof line.nextVariant === "string" ? { nextVariant: line.nextVariant } : {}),
        quantity: Number(line.quantity),
      };
    });
  } catch {
    return null;
  }
}

export async function saveOrderLinesAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const access = await assertPanelAccess();
    if (!access) {
      return { error: "Tu sesión no permite corregir este pedido.", orderId };
    }

  const drafts = lineEditsFrom(formData.get("lines"));
  if (!drafts) return { error: "No se pudieron leer los productos.", orderId };

  const result = await saveOrderLines(orderId, drafts, access.actorName, {
    restrictMoney: access.role !== "owner",
  });
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudieron guardar las cantidades.", orderId };
  }

  refreshOrderScreens();
  revalidatePath("/panel");
  revalidatePath("/panel/catalogo");
  revalidatePath("/panel/rentabilidad");
  revalidatePath(`/tienda/pedido/${orderId}`);
  return { error: null, orderId };
}

export async function addOrderLineAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const access = await assertPanelAccess();
  if (!access) {
    return { error: "Tu sesión no permite corregir este pedido.", orderId };
  }
  if (access.role !== "owner") {
    return { error: "Solo el propietario puede agregar productos al pedido.", orderId };
  }

  const result = await addOrderLine(
    orderId,
    {
      sku: String(formData.get("sku") ?? ""),
      variant: String(formData.get("variant") ?? ""),
      quantity: Number(formData.get("quantity")),
    },
    access.actorName,
  );
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo agregar el producto.", orderId };
  }

  refreshOrderScreens();
  revalidatePath("/panel");
  revalidatePath("/panel/catalogo");
  revalidatePath("/panel/rentabilidad");
  revalidatePath(`/tienda/pedido/${orderId}`);
  return { error: null, orderId };
}

export async function saveIncidenceReasonAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const access = await assertPanelAccess();
    if (!access) {
      return { error: "Tu sesión no permite anotar en este pedido.", orderId };
    }

  const result = await saveIncidenceReason(orderId, String(formData.get("customerReason") ?? ""), access.actorName);
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo guardar el motivo.", orderId };
  }
  if (!result.saved) return { error: null, orderId };

  refreshOrderScreens();
  revalidatePath("/panel");
  revalidatePath(`/tienda/pedido/${orderId}`);
  return { error: null, orderId };
}

export async function saveReturnReasonAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const access = await assertPanelAccess();
    if (!access) {
      return { error: "Tu sesión no permite anotar en este pedido.", orderId };
    }

  const result = await saveReturnReason(orderId, String(formData.get("customerReason") ?? ""), access.actorName);
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo guardar el motivo.", orderId };
  }
  if (!result.saved) return { error: null, orderId };

  refreshOrderScreens();
  revalidatePath("/panel");
  revalidatePath(`/tienda/pedido/${orderId}`);
  return { error: null, orderId };
}

export async function saveInternalNoteAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const access = await assertPanelAccess();
    if (!access) {
      return { error: "Tu sesión no permite anotar en este pedido.", orderId };
    }

  const result = await saveInternalNote(orderId, String(formData.get("internalNote") ?? ""), access.actorName);
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo guardar la nota.", orderId };
  }

  refreshOrderScreens();
  revalidatePath("/panel");
  return { error: null, orderId };
}

export async function markCustomerNoticeAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const access = await assertPanelAccess();
    if (!access) {
      return { error: "Tu sesión no permite anotar en este pedido.", orderId };
    }

  const intent = formData.get("intent") === "quitar" ? "quitar" : "avisar";
  const result = await markCustomerNotice(orderId, intent, access.actorName);
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo anotar el aviso.", orderId };
  }

  refreshOrderScreens();
  revalidatePath("/panel");
  return { error: null, orderId };
}

export async function markBuyerNoteSeenAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const access = await assertPanelAccess();
  if (!access) {
    return { error: "Tu sesión no permite anotar en este pedido.", orderId };
  }

  const intent = formData.get("intent") === "quitar" ? "quitar" : "leer";
  const result = await markBuyerNoteSeen(orderId, intent, access.actorName);
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo marcar el aviso del comprador.", orderId };
  }

  refreshOrderScreens();
  revalidatePath("/panel");
  return { error: null, orderId };
}
