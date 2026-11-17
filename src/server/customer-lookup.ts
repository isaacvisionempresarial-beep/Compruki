"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeOrderNumber, normalizePhone } from "@/lib/store-order";
import { cancelOrderByCustomer, chooseSizeByCustomer, correctDeliveryByCustomer, findOrderForCustomer, saveBuyerNoteByCustomer } from "@/server/order-store";

export type LookupOrderState = { error: string | null };

export async function lookupOrderAction(_state: LookupOrderState, formData: FormData): Promise<LookupOrderState> {
  const number = normalizeOrderNumber(String(formData.get("number") ?? ""));
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!/^P-\d{4,6}$/.test(number)) return { error: "Escribe el número del pedido, por ejemplo P-2001." };
  if (!/^3\d{9}$/.test(phone)) return { error: "Escribe el celular de 10 dígitos que dejaste en el pedido." };

  const order = await findOrderForCustomer(number, phone);
  if (!order) return { error: "No encontramos un pedido con ese número y ese celular." };

  redirect(`/tienda/pedido/${order.id}?t=${order.viewToken}`);
}

export type CancelCustomerOrderState = { error: string | null };

export async function cancelCustomerOrderAction(
  _state: CancelCustomerOrderState,
  formData: FormData,
): Promise<CancelCustomerOrderState> {
  const id = String(formData.get("orderId") ?? "");
  const token = String(formData.get("token") ?? "");
  const result = await cancelOrderByCustomer(id, token, String(formData.get("reason") ?? ""));
  if (result.error || !result.order) return { error: result.error ?? "No se pudo cancelar el pedido." };

  revalidatePath("/panel");
  revalidatePath("/panel/pedidos");
  revalidatePath("/panel/pedidos/[number]", "page");
  revalidatePath("/panel/sincronizacion");
  revalidatePath("/panel/sincronizacion/[number]", "page");
  revalidatePath("/panel/catalogo");
  revalidatePath("/panel/rentabilidad");
  revalidatePath(`/tienda/pedido/${result.order.id}`);
  redirect(`/tienda/pedido/${result.order.id}?t=${token}`);
}

export type CorrectDeliveryState = { error: string | null };

export async function correctCustomerDeliveryAction(
  _state: CorrectDeliveryState,
  formData: FormData,
): Promise<CorrectDeliveryState> {
  const id = String(formData.get("orderId") ?? "");
  const token = String(formData.get("token") ?? "");
  const result = await correctDeliveryByCustomer(id, token, {
    customerName: String(formData.get("customerName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    document: String(formData.get("document") ?? ""),
    city: String(formData.get("city") ?? ""),
    department: String(formData.get("department") ?? ""),
    address: String(formData.get("address") ?? ""),
    reference: String(formData.get("reference") ?? ""),
  });
  if (result.error || !result.order) return { error: result.error ?? "No se pudieron guardar los datos de entrega." };

  revalidatePath("/panel");
  revalidatePath("/panel/pedidos");
  revalidatePath("/panel/pedidos/[number]", "page");
  revalidatePath("/panel/sincronizacion");
  revalidatePath("/panel/sincronizacion/[number]", "page");
  revalidatePath("/panel/catalogo");
  revalidatePath("/panel/rentabilidad");
  revalidatePath(`/tienda/pedido/${result.order.id}`);
  redirect(`/tienda/pedido/${result.order.id}?t=${token}`);
}

export type ChooseSizeState = { error: string | null };

export async function chooseCustomerSizeAction(_state: ChooseSizeState, formData: FormData): Promise<ChooseSizeState> {
  const id = String(formData.get("orderId") ?? "");
  const token = String(formData.get("token") ?? "");
  const skus = formData.getAll("sku").map(String);
  const variants = formData.getAll("variant").map(String);
  const nexts = formData.getAll("next").map(String);
  if (skus.length !== variants.length || skus.length !== nexts.length) {
    return { error: "Un producto del pedido ya no coincide." };
  }
  const result = await chooseSizeByCustomer(
    id,
    token,
    skus.map((sku, index) => ({ sku, variant: variants[index] ?? "", nextVariant: nexts[index] ?? "" })),
  );
  if (result.error || !result.order) return { error: result.error ?? "No se pudo guardar la talla o el tamaño." };
  if (!result.saved) return { error: null };

  revalidatePath("/panel");
  revalidatePath("/panel/pedidos");
  revalidatePath("/panel/pedidos/[number]", "page");
  revalidatePath("/panel/sincronizacion");
  revalidatePath("/panel/sincronizacion/[number]", "page");
  revalidatePath("/panel/catalogo");
  revalidatePath("/panel/rentabilidad");
  revalidatePath(`/tienda/pedido/${result.order.id}`);
  redirect(`/tienda/pedido/${result.order.id}?t=${token}`);
}

export type BuyerNoteState = { error: string | null };

export async function saveBuyerNoteAction(_state: BuyerNoteState, formData: FormData): Promise<BuyerNoteState> {
  const id = String(formData.get("orderId") ?? "");
  const token = String(formData.get("token") ?? "");
  const result = await saveBuyerNoteByCustomer(id, token, String(formData.get("buyerNote") ?? ""));
  if (result.error || !result.order) return { error: result.error ?? "No se pudo guardar el aviso." };

  revalidatePath("/panel");
  revalidatePath("/panel/pedidos");
  revalidatePath("/panel/pedidos/[number]", "page");
  revalidatePath("/panel/sincronizacion");
  revalidatePath("/panel/sincronizacion/[number]", "page");
  revalidatePath("/panel/catalogo");
  revalidatePath("/panel/rentabilidad");
  revalidatePath(`/tienda/pedido/${result.order.id}`);
  redirect(`/tienda/pedido/${result.order.id}?t=${token}`);
}
