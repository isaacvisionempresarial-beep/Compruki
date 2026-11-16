"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { campaignSkusInOrder } from "@/lib/campaign";
import { parsePesos } from "@/lib/catalog";
import { DEMO_USER } from "@/lib/demo-account";
import { SESSION_COOKIE, SESSION_VALUE } from "@/lib/session";
import { normalizePhone, type OrderAction } from "@/lib/store-order";
import { addOrderLine, applyCatalogCosts, markCustomerNotice, placeOrder, saveClosedDepartment, saveDelivery, saveFreight, saveIncidenceReason, saveInternalNote, saveOrderLines, saveProviderRef, saveReturnReason, updateOrder } from "@/server/order-store";

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

  const result = placeOrder({
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
  redirect(`/tienda/pedido/${result.order.id}?t=${result.order.viewToken}&nuevo=1`);
}

export type UpdateOrderState = { error: string | null; orderId: string | null };

export async function updateOrderAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    return { error: "Tu sesión no permite cambiar este pedido.", orderId };
  }

  const intent = String(formData.get("intent") ?? "");
  if (!ORDER_ACTIONS.includes(intent as OrderAction)) {
    return { error: "Esa acción no existe.", orderId };
  }

  const result = updateOrder(orderId, intent as OrderAction, DEMO_USER.name, String(formData.get("customerReason") ?? ""));
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo actualizar el pedido.", orderId };
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
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    return { error: "Tu sesión no permite anotar el flete.", orderId };
  }

  const shipping = readPesos(String(formData.get("actualShipping") ?? ""), "el flete");
  const returning = readPesos(String(formData.get("returnFreight") ?? ""), "el flete");
  const collection = readPesos(String(formData.get("collectionCost") ?? ""), "el recaudo");
  if (shipping.error || returning.error || collection.error) {
    return { error: shipping.error ?? returning.error ?? collection.error, orderId };
  }

  const result = saveFreight(
    orderId,
    { actualShipping: shipping.value, returnFreight: returning.value, collectionCost: collection.value },
    DEMO_USER.name,
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
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    return { error: "Tu sesión no permite anotar el costo.", orderId };
  }

  const result = applyCatalogCosts(orderId, DEMO_USER.name);
  if (result.error || !result.order) return { error: result.error ?? "No se pudo anotar el costo de la ficha.", orderId };
  if (!result.saved) return { error: null, orderId };

  refreshOrderScreens();
  revalidatePath("/panel/catalogo");
  revalidatePath("/panel/rentabilidad");
  revalidatePath("/panel");
  return { error: null, orderId };
}

export async function saveProviderRefAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    return { error: "Tu sesión no permite anotar el número de Dropi.", orderId };
  }

  const clearing = formData.get("intent") === "quitar";
  const result = saveProviderRef(orderId, clearing ? null : String(formData.get("providerRef") ?? ""), DEMO_USER.name);
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo anotar el número de Dropi.", orderId };
  }

  refreshOrderScreens();
  revalidatePath("/panel");
  return { error: null, orderId };
}

export async function saveClosedDepartmentAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    return { error: "Tu sesión no permite anotar en este pedido.", orderId };
  }

  const result = saveClosedDepartment(orderId, String(formData.get("department") ?? ""), DEMO_USER.name);
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
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    return { error: "Tu sesión no permite corregir este pedido.", orderId };
  }

  const result = saveDelivery(
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
    DEMO_USER.name,
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
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    return { error: "Tu sesión no permite corregir este pedido.", orderId };
  }

  const drafts = lineEditsFrom(formData.get("lines"));
  if (!drafts) return { error: "No se pudieron leer los productos.", orderId };

  const result = saveOrderLines(orderId, drafts, DEMO_USER.name);
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
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    return { error: "Tu sesión no permite corregir este pedido.", orderId };
  }

  const result = addOrderLine(
    orderId,
    {
      sku: String(formData.get("sku") ?? ""),
      variant: String(formData.get("variant") ?? ""),
      quantity: Number(formData.get("quantity")),
    },
    DEMO_USER.name,
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
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    return { error: "Tu sesión no permite anotar en este pedido.", orderId };
  }

  const result = saveIncidenceReason(orderId, String(formData.get("customerReason") ?? ""), DEMO_USER.name);
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
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    return { error: "Tu sesión no permite anotar en este pedido.", orderId };
  }

  const result = saveReturnReason(orderId, String(formData.get("customerReason") ?? ""), DEMO_USER.name);
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
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    return { error: "Tu sesión no permite anotar en este pedido.", orderId };
  }

  const result = saveInternalNote(orderId, String(formData.get("internalNote") ?? ""), DEMO_USER.name);
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo guardar la nota.", orderId };
  }

  refreshOrderScreens();
  revalidatePath("/panel");
  return { error: null, orderId };
}

export async function markCustomerNoticeAction(_state: UpdateOrderState, formData: FormData): Promise<UpdateOrderState> {
  const orderId = String(formData.get("orderId") ?? "");
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    return { error: "Tu sesión no permite anotar en este pedido.", orderId };
  }

  const intent = formData.get("intent") === "quitar" ? "quitar" : "avisar";
  const result = markCustomerNotice(orderId, intent, DEMO_USER.name);
  if (result.error || !result.order) {
    return { error: result.error ?? "No se pudo anotar el aviso.", orderId };
  }

  refreshOrderScreens();
  revalidatePath("/panel");
  return { error: null, orderId };
}
