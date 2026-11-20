import { randomUUID } from "node:crypto";
import { campaignSkusInOrder } from "@/lib/campaign";
import { bogotaNow, sizeChoiceLabel, variantFits } from "@/lib/catalog";
import { formatCop } from "@/lib/format";
import {
  applyOrderAction,
  normalizeOrderNumber,
  canEditDelivery,
  needsClosedDepartment,
  validateDepartment,
  canEditLines,
  canNoteDropiNumber,
  collectionAmountSummary,
  confirmSizeError,
  lineName,
  normalizePhone,
  normalizeProviderRef,
  needsCustomerReason,
  shippingClearedSummary,
  collectionMarkSummary,
  orderTotal,
  prepareDropiError,
  resolveIncidenceError,
  validateCheckout,
  validateBuyerNote,
  validateCustomerReason,
  validateDelivery,
  validateDocument,
  validateInternalNote,
  validateLineEdits,
  validateProviderRef,
  type DeliveryDraft,
  type LineEdit,
  type CheckoutInput,
  type OrderAction,
  type OrderLine,
  type StoreOrder,
} from "@/lib/store-order";
import { listProducts } from "@/server/catalog-store";
import { loadOrders, saveOrders } from "@/server/pg-persistence";

export async function listOrders() {
  return (await readOrders()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countOrdersForSku(sku: string) {
  const needle = sku.trim().toUpperCase();
  if (!needle) return 0;
  return (await readOrders()).filter((order) => order.lines.some((line) => line.sku === needle)).length;
}

export async function skusWithOrders() {
  const skus = new Set<string>();
  for (const order of await readOrders()) {
    for (const line of order.lines) skus.add(line.sku);
  }
  return skus;
}

export async function getOrder(id: string) {
  return (await readOrders()).find((order) => order.id === id) ?? null;
}

export async function findOrderForCustomer(number: string, phone: string) {
  const normalizedNumber = normalizeOrderNumber(number);
  const normalizedPhone = normalizePhone(phone);
  if (!/^P-\d{4,6}$/.test(normalizedNumber) || !/^3\d{9}$/.test(normalizedPhone)) return null;
  return (await readOrders()).find((order) => order.number === normalizedNumber && order.phone === normalizedPhone) ?? null;
}

export async function placeOrder(input: CheckoutInput) {
  const orders = await readOrders();
  const existing = orders.find((order) => order.idempotencyKey === input.idempotencyKey);
  if (existing) return { error: null, order: existing };

  const error = validateCheckout(input);
  if (error) return { error, order: null };

  const catalog = await listProducts();
  const lines = [];
  for (const line of input.lines) {
    const product = catalog.find((item) => item.sku === line.sku.toUpperCase());
    const variant = (line.variant ?? "").trim();
    if (!product || !product.published || !product.available || !variantFits(product.variants, variant)) {
      return {
        error: "Un producto del carrito ya no se puede pedir. Vuelve a la tienda y revísalo.",
        order: null,
      };
    }
    lines.push({
      sku: product.sku,
      title: product.title,
      unitPrice: product.price,
      unitCost: product.cost,
      unitShipping: product.shipping,
      unitCommissions: product.commissions,
      quantity: line.quantity,
      ...(variant ? { variant, ...(product.sizeKind ? { sizeKind: product.sizeKind } : {}) } : {}),
    });
  }

  const createdAt = bogotaNow();
  const customerName = input.customerName.trim();
  const campaignSkus = campaignSkusInOrder(lines, input.campaignSkus ?? []);
  const document = validateDocument(input.document).value;
  const order: StoreOrder = {
    id: `ord_${randomUUID().slice(0, 8)}`,
    number: `P-${2000 + orders.length + 1}`,
    idempotencyKey: input.idempotencyKey,
    viewToken: randomUUID(),
    status: "pendiente_confirmacion",
    collected: false,
    createdAt,
    customerName,
    phone: normalizePhone(input.phone),
    ...(document ? { document } : {}),
    city: input.city.trim(),
    department: input.department.trim().replace(/\s+/g, " "),
    address: input.address.trim(),
    reference: input.reference.trim(),
    lines,
    total: orderTotal(lines),
    payment: "contra_entrega",
    ...(campaignSkus.length > 0 ? { campaignEntry: true } : {}),
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: createdAt,
        actorName: customerName,
        summary:
          campaignSkus.length > 0
            ? "Dejó el pedido, pendiente de confirmación. Entró por el enlace de campaña. No es gasto publicitario. El total guardado es el precio publicado de ese momento. Nadie cobró aquí."
            : "Dejó el pedido, pendiente de confirmación. El total guardado es el precio publicado de ese momento. Nadie cobró aquí.",
      },
    ],
  };

  await writeOrders([order, ...orders]);
  return { error: null, order };
}

export async function updateOrder(id: string, action: OrderAction, actorName: string, rawReason = "") {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current) return { error: "No encontré ese pedido.", order: null };

  if (action === "preparar") {
    const dropiError = prepareDropiError(current);
    if (dropiError) return { error: dropiError, order: null };
  }

  if (action === "resolver") {
    const reasonError = resolveIncidenceError(current);
    if (reasonError) return { error: reasonError, order: null };
  }

  const result = applyOrderAction(current, action);
  if (result.error || !result.order) return { error: result.error ?? "No se pudo actualizar el pedido.", order: null };

  if (action === "confirmar") {
    const sizeError = confirmSizeError(
      current,
      (await listProducts()).map((product) => ({
        sku: product.sku,
        variants: product.variants,
        sizeKind: product.sizeKind ?? null,
      })),
    );
    if (sizeError) return { error: sizeError, order: null };
  }

  let customerReason: string | undefined;
  if (needsCustomerReason(action)) {
    const checked = validateCustomerReason(rawReason);
    if (checked.error || !checked.value) return { error: checked.error ?? "Escribe el motivo para el cliente.", order: null };
    customerReason = checked.value;
  }

  const order: StoreOrder = {
    ...result.order,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName,
        summary:
          action === "cobrar" || action === "quitar_cobro"
            ? collectionMarkSummary(current, action === "cobrar")
            : saleStopSummary(action, result.summary, current.collected),
      },
      ...current.history,
    ],
  };
  if (customerReason) order.customerReason = customerReason;
  else if (action !== "resolver") delete order.customerReason;
  if (order.status !== current.status || order.collected !== current.collected) delete order.customerNotifiedAt;

  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order };
}

function saleStopSummary(action: OrderAction, summary: string, wasCollected: boolean) {
  if (action !== "incidencia" && action !== "cancelar" && action !== "devolver") return summary;
  const note = `${summary} El total guardado no cambió. Nadie cobra en el sitio.`;
  if (action === "devolver" && wasCollected) return `${note} Se quitó la marca de cobro.`;
  return note;
}

function keptTotalNote(summary: string) {
  return `${summary} El total guardado no cambió. Nadie cobra en el sitio.`;
}

export async function cancelOrderByCustomer(id: string, token: string, rawReason: string) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current || !token || current.viewToken !== token) return { error: "No encontré ese pedido.", order: null };
  if (current.status !== "pendiente_confirmacion") {
    return { error: "Este pedido ya lo está atendiendo la tienda. Para cancelarlo, escríbele.", order: null };
  }

  const checked = validateCustomerReason(rawReason);
  if (checked.error || !checked.value) {
    return {
      error: rawReason.trim()
        ? "El motivo puede tener hasta 160 caracteres."
        : "Escribe por qué lo cancelas, hasta 160 caracteres.",
      order: null,
    };
  }

  const result = applyOrderAction(current, "cancelar");
  if (result.error || !result.order) return { error: result.error ?? "No se pudo cancelar el pedido.", order: null };

  const order: StoreOrder = {
    ...result.order,
    customerReason: checked.value,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName: current.customerName,
        summary: "Canceló su pedido antes de la confirmación. Deja de sumar en las ventas. El total guardado no cambió. Nadie cobra en la tienda.",
      },
      ...current.history,
    ],
  };
  delete order.customerNotifiedAt;
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order };
}

export async function correctDeliveryByCustomer(id: string, token: string, input: DeliveryDraft) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current || !token || current.viewToken !== token) return { error: "No encontré ese pedido.", order: null };
  if (current.status !== "pendiente_confirmacion") {
    return { error: "La tienda ya está atendiendo este pedido. Para cambiar la entrega, escríbele.", order: null };
  }

  const checked = validateDelivery(input);
  if (checked.error || !checked.value) return { error: checked.error ?? "Revisa los datos de entrega.", order: null };
  const next = checked.value;
  const same =
    current.customerName === next.customerName &&
    current.phone === next.phone &&
    current.city === next.city &&
    (current.department?.trim() ?? "") === next.department &&
    (current.document ?? "") === next.document &&
    current.address === next.address &&
    current.reference === next.reference;
  if (same) return { error: null, order: current };

  const order: StoreOrder = {
    ...current,
    ...next,
    department: next.department || undefined,
    document: next.document || undefined,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName: current.customerName,
        summary: keptTotalNote("Corrigió sus datos de entrega. Dropi no está conectado: no se entera desde aquí."),
      },
      ...current.history,
    ],
  };
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order };
}

export async function chooseSizeByCustomer(
  id: string,
  token: string,
  drafts: Array<{ sku: string; variant: string; nextVariant: string }>,
) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current || !token || current.viewToken !== token) return { error: "No encontré ese pedido.", order: null, saved: false };
  if (!canEditLines(current)) {
    return {
      error: "La tienda ya está atendiendo este pedido. Para cambiar la talla o el tamaño, escríbele.",
      order: null,
      saved: false,
    };
  }
  if (drafts.length !== current.lines.length) return { error: "Un producto del pedido ya no coincide.", order: null, saved: false };

  const products = (await listProducts()).filter((product) => product.published);
  const used = new Set<number>();
  const lines: OrderLine[] = [];
  const changes: Array<{ line: OrderLine; hadChoice: boolean }> = [];

  for (const draft of drafts) {
    const variant = draft.variant.trim();
    const index = current.lines.findIndex(
      (line, position) => !used.has(position) && line.sku === draft.sku.trim() && (line.variant ?? "") === variant,
    );
    if (index < 0) return { error: "Un producto del pedido ya no coincide.", order: null, saved: false };
    used.add(index);
    const line = current.lines[index];
    const product = products.find((item) => item.sku === line.sku);
    const next = draft.nextVariant.trim();
    if (!product?.sizeKind || product.variants.length === 0) {
      if (next !== (line.variant ?? "")) return { error: "Ese producto no tiene tallas ni tamaños.", order: null, saved: false };
      lines.push(line);
      continue;
    }
    if (!variantFits(product.variants, next)) {
      return { error: product.sizeKind === "tamano" ? "Elige el tamaño." : "Elige la talla.", order: null, saved: false };
    }
    const updated: OrderLine = { ...line, variant: next, sizeKind: product.sizeKind };
    const hadChoice = variantFits(product.variants, line.variant ?? "");
    if (!hadChoice || (line.variant ?? "") !== next || line.sizeKind !== product.sizeKind) changes.push({ line: updated, hadChoice });
    lines.push(updated);
  }

  if (changes.length === 0) return { error: null, order: current, saved: false };

  const only = changes.length === 1 ? changes[0] : null;
  const lead = only
    ? `${only.hadChoice ? "Cambió" : "Eligió"} ${only.line.sizeKind === "tamano" ? "el tamaño" : "la talla"} de ${only.line.title}: quedó ${sizeChoiceLabel(only.line.sizeKind, only.line.variant ?? "")}.`
    : "Actualizó las tallas o tamaños del pedido.";
  const order: StoreOrder = {
    ...current,
    lines,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName: current.customerName,
        summary: `${lead} El total guardado no cambió. El precio de la línea tampoco. Nadie cobra en la tienda. El catálogo no cambió. Dropi no está conectado: no se entera desde aquí.`,
      },
      ...current.history,
    ],
  };
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order, saved: true };
}

export async function saveBuyerNoteByCustomer(id: string, token: string, raw: string) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current || !token || current.viewToken !== token) return { error: "No encontré ese pedido.", order: null };
  if (current.status !== "pendiente_confirmacion") {
    return { error: "La tienda ya está atendiendo este pedido. Para avisarle, escríbele.", order: null };
  }

  const checked = validateBuyerNote(raw);
  if (checked.error || checked.value === null) return { error: checked.error ?? "No se pudo guardar el aviso.", order: null };
  const previous = current.buyerNote?.trim() ?? "";
  if (checked.value === previous) return { error: null, order: current };

  const order: StoreOrder = {
    ...current,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName: current.customerName,
        summary: keptTotalNote(
          checked.value
            ? previous
              ? "Actualizó el aviso para la tienda."
              : "Dejó un aviso para la tienda."
            : "Quitó el aviso para la tienda.",
        ),
      },
      ...current.history,
    ],
  };
  if (checked.value) order.buyerNote = checked.value;
  else delete order.buyerNote;
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order };
}

export async function saveIncidenceReason(id: string, rawReason: string, actorName: string) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current) return { error: "No encontré ese pedido.", order: null, saved: false };
  if (current.status !== "incidencia") {
    return { error: "Este pedido no está en incidencia.", order: null, saved: false };
  }

  const checked = validateCustomerReason(rawReason);
  if (checked.error || !checked.value) {
    return { error: checked.error ?? "Escribe el motivo para el cliente.", order: null, saved: false };
  }
  if ((current.customerReason ?? "") === checked.value) return { error: null, order: current, saved: false };

  const order: StoreOrder = {
    ...current,
    customerReason: checked.value,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName,
        summary: keptTotalNote("Anotó el motivo de la incidencia. El cliente lo ve en el pedido. Dropi no está conectado: no se entera desde aquí."),
      },
      ...current.history,
    ],
  };
  delete order.customerNotifiedAt;
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order, saved: true };
}

export async function saveReturnReason(id: string, rawReason: string, actorName: string) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current) return { error: "No encontré ese pedido.", order: null, saved: false };
  if (current.status !== "devuelto") {
    return { error: "Este pedido no está devuelto.", order: null, saved: false };
  }

  const checked = validateCustomerReason(rawReason);
  if (checked.error || !checked.value) {
    return { error: checked.error ?? "Escribe el motivo para el cliente.", order: null, saved: false };
  }
  if ((current.customerReason ?? "") === checked.value) return { error: null, order: current, saved: false };

  const order: StoreOrder = {
    ...current,
    customerReason: checked.value,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName,
        summary: keptTotalNote("Anotó el motivo de la devolución. El cliente lo ve en el pedido. Dropi no está conectado: no se entera desde aquí."),
      },
      ...current.history,
    ],
  };
  delete order.customerNotifiedAt;
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order, saved: true };
}

export async function applyCatalogCosts(id: string, actorName: string) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current) return { error: "No encontré ese pedido.", order: null, saved: false };

  const products = await listProducts();
  let changed = false;
  const lines: OrderLine[] = [];
  for (const line of current.lines) {
    const missingCost = typeof line.unitCost !== "number";
    const missingShipping = typeof line.unitShipping !== "number";
    const missingCommissions = typeof line.unitCommissions !== "number";
    if (!missingCost && !missingShipping && !missingCommissions) {
      lines.push(line);
      continue;
    }
    const product = products.find((item) => item.sku === line.sku);
    if (
      !product ||
      !Number.isInteger(product.cost) ||
      product.cost < 0 ||
      !Number.isInteger(product.shipping) ||
      product.shipping < 0 ||
      !Number.isInteger(product.commissions) ||
      product.commissions < 0
    ) {
      return { error: `La ficha de ${line.title} ya no tiene el costo, el envío y las comisiones.`, order: null, saved: false };
    }
    changed = true;
    lines.push({
      ...line,
      unitCost: missingCost ? product.cost : line.unitCost,
      unitShipping: missingShipping ? product.shipping : line.unitShipping,
      unitCommissions: missingCommissions ? product.commissions : line.unitCommissions,
    });
  }
  if (!changed) return { error: null, order: current, saved: false };

  const order: StoreOrder = {
    ...current,
    lines,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName,
        summary: "Anotó el costo, el envío y las comisiones de la ficha. El precio del pedido no cambió. El total guardado no cambió. No es dinero cobrado.",
      },
      ...current.history,
    ],
  };
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order, saved: true };
}

export async function saveFreight(
  id: string,
  input: { actualShipping: number | null; returnFreight: number | null; collectionCost: number | null },
  actorName: string,
) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current) return { error: "No encontré ese pedido.", order: null };
  if (current.status !== "entregado" && current.status !== "devuelto") {
    return { error: "El flete se anota cuando el pedido está entregado o devuelto.", order: null };
  }
  if (invalidPesos(input.actualShipping) || invalidPesos(input.returnFreight)) {
    return { error: "Escribe el flete en pesos, sin centavos, hasta $5.000.000.", order: null };
  }
  if (invalidPesos(input.collectionCost)) {
    return { error: "Escribe el recaudo en pesos, sin centavos, hasta $5.000.000.", order: null };
  }

  const next: StoreOrder = { ...current };
  const notes: string[] = [];

  if (current.status === "entregado" && input.actualShipping !== (current.actualShipping ?? null)) {
    if (input.actualShipping === null) {
      delete next.actualShipping;
      notes.push(shippingClearedSummary(next));
    } else {
      next.actualShipping = input.actualShipping;
      notes.push(`Anotó el flete real del envío en ${formatCop(input.actualShipping)}.`);
    }
  }

  if (current.status === "entregado" && current.collected && input.collectionCost !== (current.collectionCost ?? null)) {
    if (input.collectionCost === null) {
      delete next.collectionCost;
      notes.push(collectionAmountSummary(next, null));
    } else {
      next.collectionCost = input.collectionCost;
      notes.push(collectionAmountSummary(next, input.collectionCost));
    }
  }

  if (current.status === "devuelto" && input.returnFreight !== (current.returnFreight ?? null)) {
    if (input.returnFreight === null) {
      delete next.returnFreight;
      notes.push("Quitó el flete de la devolución.");
    } else {
      next.returnFreight = input.returnFreight;
      notes.push(`Anotó el flete de la devolución en ${formatCop(input.returnFreight)}. Resta de la utilidad realizada.`);
    }
  }

  if (notes.length === 0) return { error: null, order: current };

  const order: StoreOrder = {
    ...next,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName,
        summary: `${notes.join(" ")} El total guardado no cambió. No es dinero cobrado.`,
      },
      ...current.history,
    ],
  };
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order };
}

export async function saveProviderRef(id: string, raw: string | null, actorName: string) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current) return { error: "No encontré ese pedido.", order: null };
  if (!canNoteDropiNumber(current)) {
    return { error: "Confirma el pedido antes de anotar un número de Dropi.", order: null };
  }

  if (raw === null) {
    if (!current.providerRef) return { error: null, order: current };
    const cleared: StoreOrder = { ...current };
    delete cleared.providerRef;
    const order: StoreOrder = {
      ...cleared,
      history: [
        {
          id: `evt_${randomUUID().slice(0, 8)}`,
          at: bogotaNow(),
          actorName,
          summary: keptTotalNote("Quitó el número de Dropi anotado a mano."),
        },
        ...current.history,
      ],
    };
    await writeOrders(orders.map((item) => (item.id === id ? order : item)));
    return { error: null, order };
  }

  const checked = validateProviderRef(raw);
  if (checked.error || !checked.value) return { error: checked.error ?? "Escribe el número que te dio Dropi.", order: null };
  if (normalizeProviderRef(current.providerRef ?? "") === checked.value) return { error: null, order: current };

  const order: StoreOrder = {
    ...current,
    providerRef: checked.value,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName,
        summary: keptTotalNote(`Anotó el número de Dropi cargado a mano: ${checked.value}. Desde aquí no se envió el pedido.`),
      },
      ...current.history,
    ],
  };
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order };
}

export async function saveClosedDepartment(id: string, raw: string, actorName: string) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current) return { error: "No encontré ese pedido.", order: null };
  if (current.department?.trim()) return { error: "Este pedido ya tiene departamento.", order: null };
  if (!needsClosedDepartment(current)) {
    return { error: "Este pedido todavía se corrige en la entrega.", order: null };
  }

  const departmentError = validateDepartment(raw, true);
  if (departmentError) return { error: departmentError, order: null };
  const department = raw.trim().replace(/\s+/g, " ");
  const order: StoreOrder = {
    ...current,
    department,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName,
        summary: keptTotalNote("Anotó el departamento. El texto para Dropi lo lleva. El estado no cambia y Dropi no está conectado: no se entera desde aquí."),
      },
      ...current.history,
    ],
  };
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order };
}

export async function saveDelivery(id: string, input: DeliveryDraft, actorName: string) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current) return { error: "No encontré ese pedido.", order: null };
  if (!canEditDelivery(current)) {
    return {
      error: "Estos datos ya no se corrigen: el pedido salió, se entregó, se canceló o se devolvió.",
      order: null,
    };
  }

  const checked = validateDelivery(input);
  if (checked.error || !checked.value) return { error: checked.error ?? "Revisa los datos de entrega.", order: null };
  const next = checked.value;
  const same =
    current.customerName === next.customerName &&
    current.phone === next.phone &&
    current.city === next.city &&
    (current.department?.trim() ?? "") === next.department &&
    (current.document ?? "") === next.document &&
    current.address === next.address &&
    current.reference === next.reference;
  if (same) return { error: null, order: current };

  const order: StoreOrder = {
    ...current,
    ...next,
    department: next.department || undefined,
    document: next.document || undefined,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName,
        summary: keptTotalNote("Actualizó los datos de entrega. Dropi no está conectado: no se entera desde aquí."),
      },
      ...current.history,
    ],
  };
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order };
}

export async function saveOrderLines(
  id: string,
  drafts: LineEdit[],
  actorName: string,
  options?: { restrictMoney?: boolean },
) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current) return { error: "No encontré ese pedido.", order: null };

  const products = await listProducts();
  const checked = validateLineEdits(current, drafts, (sku) => {
    const product = products.find((item) => item.sku === sku);
    return product ? { variants: product.variants, sizeKind: product.sizeKind } : null;
  });
  if (checked.error || !checked.lines) return { error: checked.error ?? "Revisa las cantidades.", order: null };
  const lines = checked.lines;
  if (options?.restrictMoney && lineMoneyTouched(current.lines, drafts)) {
    return { error: "Solo el propietario puede cambiar la cantidad o quitar productos.", order: null };
  }
  const same =
    current.lines.length === lines.length &&
    current.lines.every(
      (line, index) =>
        line.sku === lines[index]?.sku &&
        (line.variant ?? "") === (lines[index]?.variant ?? "") &&
        (line.sizeKind ?? "") === (lines[index]?.sizeKind ?? "") &&
        line.quantity === lines[index]?.quantity,
    );
  if (same) return { error: null, order: current };

  const total = orderTotal(lines);
  const removed = current.lines.length - lines.length;
  const changedQuantity = drafts.some((draft) => {
    const previous = current.lines.find((item) => item.sku === draft.sku.trim() && (item.variant ?? "") === draft.variant.trim());
    return previous !== undefined && previous.quantity !== draft.quantity;
  });
  const sizeChanges = drafts.flatMap((draft) => {
    const next = (draft.nextVariant ?? draft.variant).trim();
    if (next === draft.variant.trim()) return [];
    const line = lines.find((item) => item.sku === draft.sku.trim() && (item.variant ?? "") === next);
    return line ? [line] : [];
  });
  const lead =
    removed > 0 && (changedQuantity || sizeChanges.length > 0)
      ? "Actualizó los productos del pedido."
      : removed > 0
        ? removed === 1
          ? "Quitó un producto del pedido."
          : "Quitó productos del pedido."
        : changedQuantity
          ? sizeChanges.length > 0
            ? "Actualizó los productos del pedido."
            : "Actualizó las cantidades del pedido."
          : sizeChanges.length === 1
            ? `Cambió ${sizeChanges[0].sizeKind === "tamano" ? "el tamaño" : "la talla"} de ${sizeChanges[0].title}: quedó ${sizeChoiceLabel(sizeChanges[0].sizeKind, sizeChanges[0].variant ?? "")}.`
            : "Actualizó las tallas o tamaños del pedido.";
  const order: StoreOrder = {
    ...current,
    lines,
    total,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName,
        summary: `${lead} ${total === current.total ? "El total guardado no cambió." : `El total guardado quedó en ${formatCop(total)}.`} No es dinero cobrado. El precio guardado de cada línea que sigue no cambió. El catálogo no cambió. Dropi no está conectado: no se entera desde aquí.`,
      },
      ...current.history,
    ],
  };
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order };
}

function lineMoneyTouched(lines: StoreOrder["lines"], drafts: LineEdit[]) {
  if (drafts.length !== lines.length) return true;
  return drafts.some((draft) => {
    const previous = lines.find((item) => item.sku === draft.sku.trim() && (item.variant ?? "") === draft.variant.trim());
    return previous !== undefined && previous.quantity !== draft.quantity;
  });
}

export async function addOrderLine(
  id: string,
  input: { sku: string; variant: string; quantity: number },
  actorName: string,
) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current) return { error: "No encontré ese pedido.", order: null };
  if (!canEditLines(current)) {
    return { error: "Solo puedes agregar un producto mientras el pedido está pendiente de confirmación.", order: null };
  }
  if (current.lines.length >= 20) return { error: "El pedido ya tiene el máximo de productos.", order: null };
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 5) {
    return { error: "Cada producto puede pedirse de 1 a 5 unidades.", order: null };
  }

  const sku = input.sku.trim().toUpperCase();
  if (!sku) return { error: "Elige un producto.", order: null };
  const product = (await listProducts()).find((item) => item.sku === sku);
  const variant = input.variant.trim();
  if (!product || !product.published || !product.available) {
    return { error: "Ese producto no se puede agregar. Tiene que estar publicado y disponible.", order: null };
  }
  if (!variantFits(product.variants, variant)) {
    return { error: product.sizeKind === "tamano" ? "Elige el tamaño." : "Elige la talla.", order: null };
  }
  if (current.lines.some((line) => line.sku === product.sku && (line.variant ?? "") === variant)) {
    return { error: "Ese producto ya está en el pedido. Cambia la cantidad.", order: null };
  }

  const line = {
    sku: product.sku,
    title: product.title,
    unitPrice: product.price,
    unitCost: product.cost,
    unitShipping: product.shipping,
    unitCommissions: product.commissions,
    quantity: input.quantity,
    ...(variant ? { variant, ...(product.sizeKind ? { sizeKind: product.sizeKind } : {}) } : {}),
  };
  const lines = [...current.lines, line];
  const total = orderTotal(lines);
  const order: StoreOrder = {
    ...current,
    lines,
    total,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName,
        summary: `Agregó ${lineName(line)}. Copió el precio de la ficha de hoy. El catálogo no cambió. El total guardado quedó en ${formatCop(total)}. No es dinero cobrado. Dropi no está conectado: no se entera desde aquí.`,
      },
      ...current.history,
    ],
  };
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order };
}

export async function saveInternalNote(id: string, raw: string, actorName: string) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current) return { error: "No encontré ese pedido.", order: null };

  const checked = validateInternalNote(raw);
  if (checked.error) return { error: checked.error, order: null };
  const nextNote = checked.value;
  const previous = current.internalNote ?? "";
  if ((nextNote ?? "") === previous) return { error: null, order: current };

  const stored: StoreOrder = { ...current };
  if (nextNote) stored.internalNote = nextNote;
  else delete stored.internalNote;

  const order: StoreOrder = {
    ...stored,
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName,
        summary: keptTotalNote(nextNote ? (previous ? "Actualizó la nota interna." : "Anotó una nota interna.") : "Quitó la nota interna."),
      },
      ...current.history,
    ],
  };
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order };
}

export async function markCustomerNotice(id: string, intent: "avisar" | "quitar", actorName: string) {
  const orders = await readOrders();
  const current = orders.find((order) => order.id === id);
  if (!current) return { error: "No encontré ese pedido.", order: null };

  if (intent === "quitar") {
    if (!current.customerNotifiedAt) return { error: null, order: current };
    const cleared: StoreOrder = { ...current };
    delete cleared.customerNotifiedAt;
    const order: StoreOrder = {
      ...cleared,
      history: [
        {
          id: `evt_${randomUUID().slice(0, 8)}`,
          at: bogotaNow(),
          actorName,
          summary: keptTotalNote("Quitó la marca de aviso al cliente."),
        },
        ...current.history,
      ],
    };
    await writeOrders(orders.map((item) => (item.id === id ? order : item)));
    return { error: null, order };
  }

  if (current.customerNotifiedAt) return { error: null, order: current };
  const order: StoreOrder = {
    ...current,
    customerNotifiedAt: bogotaNow(),
    history: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        at: bogotaNow(),
        actorName,
        summary: keptTotalNote("Marcó que avisó al cliente. Desde aquí no se envió el mensaje."),
      },
      ...current.history,
    ],
  };
  await writeOrders(orders.map((item) => (item.id === id ? order : item)));
  return { error: null, order };
}

function invalidPesos(value: number | null) {
  return value !== null && (!Number.isInteger(value) || value < 0 || value > 5_000_000);
}

async function readOrders() {
  const parsed = await loadOrders();
  return parsed.map((order) => ({
    ...order,
    collected: order.collected === true,
    department:
      typeof order.department === "string" && order.department.trim()
        ? order.department.trim().replace(/\s+/g, " ")
        : undefined,
    document: typeof order.document === "string" && /^\d{6,10}$/.test(order.document.trim()) ? order.document.trim() : undefined,
    providerRef: typeof order.providerRef === "string" && normalizeProviderRef(order.providerRef) ? normalizeProviderRef(order.providerRef) : undefined,
    internalNote: typeof order.internalNote === "string" && order.internalNote.trim() ? order.internalNote.trim() : undefined,
    customerReason: typeof order.customerReason === "string" && order.customerReason.trim() ? order.customerReason.trim().replace(/\s+/g, " ") : undefined,
    buyerNote:
      typeof order.buyerNote === "string" && order.buyerNote.trim() && order.buyerNote.trim().replace(/\s+/g, " ").length <= 160
        ? order.buyerNote.trim().replace(/\s+/g, " ")
        : undefined,
    customerNotifiedAt: typeof order.customerNotifiedAt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(order.customerNotifiedAt) ? order.customerNotifiedAt : undefined,
    history: Array.isArray(order.history) ? order.history : [],
  }));
}

async function writeOrders(orders: StoreOrder[]) {
  await saveOrders(orders);
}
