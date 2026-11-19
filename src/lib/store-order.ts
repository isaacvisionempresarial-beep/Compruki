import { bogotaNow, sizeChoiceLabel, validSizeName, variantFits, type SizeKind } from "@/lib/catalog";
import { type OrderStatus, type Period } from "@/lib/demo-data";
import { formatCop } from "@/lib/format";

export type OrderLine = {
  sku: string;
  title: string;
  unitPrice: number;
  quantity: number;
  variant?: string;
  sizeKind?: SizeKind;
  unitCost?: number;
  unitShipping?: number;
  unitCommissions?: number;
};

export type OrderEvent = {
  id: string;
  at: string;
  actorName: string;
  summary: string;
};

export type StoreOrder = {
  id: string;
  number: string;
  idempotencyKey: string;
  viewToken: string;
  status: OrderStatus;
  collected: boolean;
  createdAt: string;
  customerName: string;
  phone: string;
  document?: string;
  city: string;
  department?: string;
  address: string;
  reference: string;
  lines: OrderLine[];
  total: number;
  payment: "contra_entrega";
  campaignEntry?: boolean;
  providerRef?: string;
  internalNote?: string;
  customerReason?: string;
  buyerNote?: string;
  customerNotifiedAt?: string;
  actualShipping?: number;
  returnFreight?: number;
  collectionCost?: number;
  history: OrderEvent[];
};

export type CustomerOrder = {
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: string;
  customerName: string;
  phone: string;
  document: string;
  city: string;
  department: string;
  address: string;
  reference: string;
  customerReason: string;
  buyerNote: string;
  cancelledByCustomer: boolean;
  collected: boolean;
  lines: Array<Pick<OrderLine, "sku" | "title" | "unitPrice" | "quantity" | "variant" | "sizeKind">>;
  total: number;
  payment: "contra_entrega";
};

export type OrderAction =
  | "confirmar"
  | "preparar"
  | "despachar"
  | "entregar"
  | "cobrar"
  | "quitar_cobro"
  | "incidencia"
  | "cancelar"
  | "resolver"
  | "devolver";

type ActionSpec = {
  id: OrderAction;
  label: string;
  tone: "primary" | "quiet" | "danger";
  summary: string;
  status?: OrderStatus;
  collected?: boolean;
};

export type CheckoutInput = {
  idempotencyKey: string;
  customerName: string;
  phone: string;
  document: string;
  city: string;
  department: string;
  address: string;
  reference: string;
  accepted: boolean;
  lines: Array<{ sku: string; quantity: number; variant?: string }>;
  campaignSkus?: string[];
};

export function samePhoneMatches<T extends { id: string; phone: string; number: string }>(order: Pick<StoreOrder, "id" | "phone">, orders: T[]) {
  return orders
    .filter((item) => item.id !== order.id && item.phone === order.phone)
    .sort((a, b) => b.number.localeCompare(a.number, "es"));
}

export function needsDepartment(order: Pick<StoreOrder, "department" | "status">) {
  return !order.department?.trim() && canEditDelivery(order);
}

const CLOSED_DEPARTMENT: OrderStatus[] = ["en_transporte", "entregado", "devuelto"];

export function needsClosedDepartment(order: { status: OrderStatus; department?: string }) {
  return CLOSED_DEPARTMENT.includes(order.status) && !order.department?.trim();
}

export function missingDepartmentNote(order: Pick<StoreOrder, "department" | "status">) {
  if (order.department?.trim()) return "";
  if (canEditDelivery(order)) return "Falta el departamento. El texto para Dropi no lo lleva hasta que lo anotes.";
  if (needsClosedDepartment(order)) {
    return "Falta el departamento. La entrega ya no se corrige. El texto para Dropi no lo lleva hasta que lo anotes.";
  }
  return "Este pedido no tiene departamento. El texto para Dropi no lo lleva.";
}

export type SizeGuide = {
  sku: string;
  variants: string[];
  sizeKind: SizeKind | null;
};

export type CostGuide = {
  sku: string;
  cost: number;
  shipping: number;
  commissions: number;
};

function lineNeedsCatalogCost(line: Pick<OrderLine, "unitCost" | "unitShipping" | "unitCommissions">) {
  return typeof line.unitCost !== "number" || typeof line.unitShipping !== "number" || typeof line.unitCommissions !== "number";
}

export function needsCatalogCost(order: Pick<StoreOrder, "lines">) {
  return order.lines.some(lineNeedsCatalogCost);
}

export function catalogCostQueueNote(order: Pick<StoreOrder, "lines">) {
  const titles = order.lines.filter(lineNeedsCatalogCost).map((line) => line.title);
  if (titles.length === 0) return "";
  if (titles.length === 1) return `Falta el costo de ${titles[0]}.`;
  return `Falta el costo de ${titles.slice(0, -1).join(", ")} y ${titles[titles.length - 1]}.`;
}

export function collectedWithoutCost(order: { status: OrderStatus; collected: boolean; lines: StoreOrder["lines"] }) {
  return order.status === "entregado" && order.collected && needsCatalogCost(order);
}

export function costQueueWarning(order: { status: OrderStatus; collected: boolean; lines: StoreOrder["lines"] }) {
  const base = catalogCostQueueNote(order);
  if (!base || !collectedWithoutCost(order)) return base;
  return `${base} Ya está cobrado y no entra en la utilidad realizada.`;
}

function historyClaimedRealizedUtility(history: Array<{ summary: string }> = []) {
  return history.some(
    (event) =>
      event.summary.includes("cuenta como utilidad realizada") ||
      event.summary.includes("Reemplaza las comisiones estimadas en la utilidad realizada"),
  );
}

export function storedUtilityCaveat(order: {
  status: OrderStatus;
  collected: boolean;
  lines: StoreOrder["lines"];
  history?: Array<{ summary: string }>;
}) {
  if (!historyClaimedRealizedUtility(order.history)) return "";
  if (order.status === "entregado" && order.collected && !needsCatalogCost(order)) return "";
  if (collectedWithoutCost(order)) {
    return "Esas notas quedaron guardadas. Hoy no entra en la utilidad realizada: falta el costo del producto.";
  }
  if (order.status === "devuelto") {
    return "Esas notas quedaron guardadas. El pedido está devuelto y no entra en la utilidad realizada.";
  }
  return "";
}

export function collectionMarkSummary(order: Pick<StoreOrder, "lines">, collected: boolean) {
  if (collected) {
    return needsCatalogCost(order)
      ? "Marcó el recaudo contra entrega. Sin el costo del producto no entra en la utilidad realizada. El total guardado no cambió."
      : "Marcó el recaudo contra entrega. Entra en la utilidad realizada. El total guardado no cambió.";
  }
  return needsCatalogCost(order)
    ? "Quitó el recaudo contra entrega. El pedido sigue fuera de la utilidad realizada. El total guardado no cambió."
    : "Quitó el recaudo. Deja de contar como utilidad realizada. El total guardado no cambió.";
}

export function collectionAmountSummary(order: Pick<StoreOrder, "lines">, amount: number | null) {
  if (amount === null) {
    return needsCatalogCost(order)
      ? "Quitó el recaudo real. El pedido sigue fuera de la utilidad realizada."
      : "Quitó el recaudo real. La utilidad vuelve a usar las comisiones estimadas.";
  }
  return needsCatalogCost(order)
    ? `Anotó el recaudo real en ${formatCop(amount)}. Sin el costo del producto no entra en la utilidad realizada.`
    : `Anotó el recaudo real en ${formatCop(amount)}. Reemplaza las comisiones estimadas en la utilidad realizada.`;
}

export function shippingClearedSummary(order: Pick<StoreOrder, "lines">) {
  return needsCatalogCost(order)
    ? "Quitó el flete real. Sin el costo del producto no entra en la utilidad realizada."
    : "Quitó el flete real. La utilidad vuelve a usar el flete estimado.";
}

function readyCostGuide(guide: CostGuide | undefined): guide is CostGuide {
  return Boolean(
    guide &&
      Number.isInteger(guide.cost) &&
      guide.cost >= 0 &&
      Number.isInteger(guide.shipping) &&
      guide.shipping >= 0 &&
      Number.isInteger(guide.commissions) &&
      guide.commissions >= 0,
  );
}

export function catalogCostLines(order: Pick<StoreOrder, "lines">, guides: CostGuide[]) {
  return order.lines.filter(lineNeedsCatalogCost).map((line) => {
    const guide = guides.find((item) => item.sku === line.sku);
    if (!readyCostGuide(guide)) return { title: line.title, sku: line.sku, ready: false as const };
    return {
      title: line.title,
      sku: line.sku,
      ready: true as const,
      cost: guide.cost,
      shipping: guide.shipping,
      commissions: guide.commissions,
    };
  });
}

export function previewMarginsWithCatalogCosts(order: StoreOrder, guides: CostGuide[]) {
  const gaps = catalogCostLines(order, guides);
  if (gaps.length === 0 || gaps.some((row) => !row.ready)) return null;
  let gapIndex = 0;
  const lines = order.lines.map((line) => {
    if (!lineNeedsCatalogCost(line)) return line;
    const row = gaps[gapIndex++];
    if (!row || !row.ready) return line;
    return {
      ...line,
      unitCost: typeof line.unitCost === "number" ? line.unitCost : row.cost,
      unitShipping: typeof line.unitShipping === "number" ? line.unitShipping : row.shipping,
      unitCommissions: typeof line.unitCommissions === "number" ? line.unitCommissions : row.commissions,
    };
  });
  const draft = { ...order, lines };
  return {
    estimated: orderMargin(draft),
    realized: orderRealizedMargin(draft),
  };
}

export function previewMarginsWithFreight(
  order: StoreOrder,
  draft: {
    actualShipping?: number | null;
    collectionCost?: number | null;
    returnFreight?: number | null;
  },
) {
  const next: StoreOrder = { ...order };
  if ("actualShipping" in draft) {
    if (typeof draft.actualShipping === "number") next.actualShipping = draft.actualShipping;
    else delete next.actualShipping;
  }
  if ("collectionCost" in draft) {
    if (typeof draft.collectionCost === "number") next.collectionCost = draft.collectionCost;
    else delete next.collectionCost;
  }
  if ("returnFreight" in draft) {
    if (typeof draft.returnFreight === "number") next.returnFreight = draft.returnFreight;
    else delete next.returnFreight;
  }
  return {
    realized: orderRealizedMargin(next),
    returnFreight: recordedReturnFreight(next),
  };
}

function sizeGaps(order: Pick<StoreOrder, "lines">, guides: SizeGuide[]) {
  return order.lines.flatMap((line) => {
    const guide = guides.find((item) => item.sku === line.sku);
    if (!guide?.sizeKind || guide.variants.length === 0) return [];
    if (variantFits(guide.variants, line.variant ?? "")) return [];
    return [{ kind: guide.sizeKind, title: line.title, chosen: (line.variant ?? "").trim() }];
  });
}

export function needsSize(order: Pick<StoreOrder, "status" | "lines">, guides: SizeGuide[]) {
  return canEditLines(order) && sizeGaps(order, guides).length > 0;
}

export function readyToConfirm(order: Pick<StoreOrder, "status" | "lines">, guides: SizeGuide[]) {
  return order.status === "pendiente_confirmacion" && !needsSize(order, guides);
}

export function confirmQueueNote(
  order: Pick<StoreOrder, "status" | "department" | "lines">,
  guides: SizeGuide[],
) {
  if (!readyToConfirm(order, guides)) return "";
  const gaps: string[] = [];
  if (needsDepartment(order)) gaps.push("el departamento");
  if (needsCatalogCost(order)) gaps.push("el costo");
  if (gaps.length === 0) return "Se puede confirmar desde la ficha. El total guardado no cambia.";
  if (gaps.length === 1) return `Se puede confirmar. Falta ${gaps[0]}. El total guardado no cambia.`;
  return `Se puede confirmar. Faltan ${gaps.join(" y ")}. El total guardado no cambia.`;
}

export function missingSizeQueueNote(order: Pick<StoreOrder, "status" | "lines">, guides: SizeGuide[]) {
  if (!canEditLines(order)) return "";
  const notes = sizeGaps(order, guides)
    .map((gap) => {
      const noun = gap.kind === "tamano" ? "tamaño" : "talla";
      const article = gap.kind === "tamano" ? "el" : "la";
      return gap.chosen ? `${gap.title}: ese ${noun} ya no está.` : `Falta ${article} ${noun} de ${gap.title}.`;
    })
    .join(" ");
  return notes ? `${notes} Confirmar queda bloqueado.` : "";
}

export function missingSizeNote(order: Pick<StoreOrder, "status" | "lines">, guides: SizeGuide[]) {
  return sizeGaps(order, guides)
    .map((gap) => {
      const noun = gap.kind === "tamano" ? "tamaño" : "talla";
      const article = gap.kind === "tamano" ? "el" : "la";
      if (gap.chosen) {
        const lead = `${article === "el" ? "El" : "La"} ${noun} ${gap.chosen} de ${gap.title} ya no está en la ficha.`;
        const change = article === "el" ? "Cámbialo" : "Cámbiala";
        return canEditLines(order)
          ? `${lead} ${change} antes de confirmar: el texto para Dropi sigue con el anterior.`
          : `${lead} El texto para Dropi sigue con ese nombre.`;
      }
      return canEditLines(order)
        ? `Falta ${article} ${noun} de ${gap.title}. El texto para Dropi no lo lleva y el pedido no se confirma hasta que lo anotes.`
        : `Este pedido no tiene ${article} ${noun} de ${gap.title}. El texto para Dropi no lo lleva.`;
    })
    .join(" ");
}

export function confirmSizeError(order: Pick<StoreOrder, "lines">, guides: SizeGuide[]) {
  const notes = sizeGaps(order, guides).map((gap) => {
    const noun = gap.kind === "tamano" ? "tamaño" : "talla";
    const article = gap.kind === "tamano" ? "el" : "la";
    if (gap.chosen) {
      const lead = `${article === "el" ? "El" : "La"} ${noun} ${gap.chosen} de ${gap.title} ya no está en la ficha.`;
      return `${lead} Elige otro antes de confirmar.`;
    }
    return `Elige ${article} ${noun} de ${gap.title} antes de confirmar.`;
  });
  return notes.length > 0 ? notes.join(" ") : null;
}

export function pendingSizeHolds(orders: StoreOrder[], guides: SizeGuide[]) {
  const counts = new Map<string, { orders: number; kind: SizeKind }>();
  for (const order of orders) {
    if (!canEditLines(order)) continue;
    const seen = new Set<string>();
    for (const line of order.lines) {
      const guide = guides.find((item) => item.sku === line.sku);
      if (!guide?.sizeKind || guide.variants.length === 0 || seen.has(line.sku)) continue;
      if (variantFits(guide.variants, line.variant ?? "")) continue;
      seen.add(line.sku);
      const current = counts.get(line.sku) ?? { orders: 0, kind: guide.sizeKind };
      current.orders += 1;
      counts.set(line.sku, current);
    }
  }
  return counts;
}

export function pendingSizeHoldPhrase(count: number, kind: SizeKind, place: "ficha" | "resultado" = "resultado") {
  const noun = kind === "tamano" ? "el tamaño" : "la talla";
  const lead =
    count === 1
      ? `1 pedido pendiente no se confirma: falta ${noun}.`
      : `${count} pedidos pendientes no se confirman: falta ${noun}.`;
  const tail = place === "ficha" ? "Hasta anotarlo no entra en Rentabilidad." : "Queda fuera de estas cifras.";
  return `${lead} ${tail}`;
}

export function lineName(line: { title: string; variant?: string; sizeKind?: SizeKind }) {
  const choice = sizeChoiceLabel(line.sizeKind, line.variant ?? "");
  return choice ? `${line.title} · ${choice}` : line.title;
}

export function orderFocusId(number: string) {
  return `pedido-${number}`;
}

export function orderFocusHref(number: string) {
  return `/panel/pedidos/${encodeURIComponent(number)}`;
}

export function syncFocusHref(number: string) {
  return `/panel/sincronizacion/${encodeURIComponent(number)}`;
}

export function dropiHandoffText(
  order: Pick<StoreOrder, "number" | "customerName" | "phone" | "document" | "department" | "city" | "address" | "reference" | "lines" | "total" | "providerRef">,
) {
  const products = order.lines.map(
    (line) => `${line.quantity} x ${lineName(line)} (${line.sku}) ${formatCop(line.unitPrice * line.quantity)}`,
  );
  return [
    `Pedido ${order.number}`,
    `Quien recibe: ${order.customerName}`,
    `Celular: ${order.phone}`,
    order.document ? `Cédula: ${order.document}` : "",
    order.department?.trim() ? `Departamento: ${order.department.trim()}` : "",
    `Ciudad: ${order.city}`,
    `Dirección: ${order.address}`,
    order.reference.trim() ? `Referencia: ${order.reference.trim()}` : "",
    "Pago: contra entrega. Nadie cobra al copiar este texto.",
    "Productos:",
    ...products,
    `Total guardado: ${formatCop(order.total)}`,
    "El envío no está incluido y se confirma aparte.",
    order.providerRef ? `Número ya anotado en Dropi: ${order.providerRef}` : "",
    "Este texto no crea el pedido en Dropi ni cambia el total guardado.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function orderTotal(lines: Array<Pick<OrderLine, "unitPrice" | "quantity">>) {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) return digits.slice(2);
  return digits;
}

export function normalizeOrderNumber(raw: string) {
  const compact = raw.trim().toUpperCase().replace(/[\s-]+/g, "");
  if (/^P\d{4,6}$/.test(compact)) return `P-${compact.slice(1)}`;
  if (/^\d{4,6}$/.test(compact)) return `P-${compact}`;
  return raw.trim().toUpperCase();
}

export function validateCheckout(input: CheckoutInput) {
  const name = input.customerName.trim();
  const phone = normalizePhone(input.phone);
  const city = input.city.trim();
  const address = input.address.trim();
  const reference = input.reference.trim();

  if (!/^[0-9a-f-]{36}$/i.test(input.idempotencyKey)) return "No se pudo identificar este intento de pedido. Recarga la página.";
  if (name.length < 3 || name.length > 80) return "Escribe el nombre de quien recibe, entre 3 y 80 caracteres.";
  if (!/^3\d{9}$/.test(phone)) return "Escribe un celular de Colombia, de 10 dígitos y que empiece por 3.";
  const document = validateDocument(input.document);
  if (document.error) return document.error;
  if (city.length < 2 || city.length > 60) return "Escribe la ciudad.";
  const departmentError = validateDepartment(input.department, true);
  if (departmentError) return departmentError;
  if (address.length < 8 || address.length > 160) return "Escribe la dirección donde se entrega el pedido.";
  if (reference.length > 120) return "La referencia es demasiado larga.";
  if (!input.accepted) return "Acepta las condiciones para dejar el pedido pendiente de confirmación.";
  if (input.lines.length === 0) return "El carrito está vacío.";
  if (input.lines.length > 20) return "El pedido tiene demasiados productos.";
  if (input.lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 5)) {
    return "Cada producto puede pedirse de 1 a 5 unidades.";
  }
  if (input.lines.some((line) => !validVariantName(line.variant ?? ""))) {
    return "Una talla o un tamaño del carrito no es válido.";
  }
  return null;
}

function validVariantName(variant: string) {
  const name = variant.trim();
  if (!name) return true;
  return validSizeName(name);
}

const CONFIRMED: OrderStatus[] = ["confirmado", "en_preparacion", "en_transporte", "entregado"];

export function lineMargin(line: OrderLine) {
  const cost = line.unitCost;
  const shipping = line.unitShipping;
  const commissions = line.unitCommissions;
  if (typeof cost !== "number" || typeof shipping !== "number" || typeof commissions !== "number") return null;
  return (line.unitPrice - cost - shipping - commissions) * line.quantity;
}

export function orderMargin(order: StoreOrder) {
  let sum = 0;
  for (const line of order.lines) {
    const margin = lineMargin(line);
    if (margin === null) return null;
    sum += margin;
  }
  return sum;
}

export function orderRealizedMargin(order: StoreOrder) {
  if (order.status !== "entregado" || !order.collected) return null;
  let cost = 0;
  let commissions = 0;
  let estimatedShipping = 0;
  for (const line of order.lines) {
    if (typeof line.unitCost !== "number" || typeof line.unitCommissions !== "number") return null;
    if (typeof order.actualShipping !== "number" && typeof line.unitShipping !== "number") return null;
    cost += line.unitCost * line.quantity;
    commissions += line.unitCommissions * line.quantity;
    if (typeof line.unitShipping === "number") estimatedShipping += line.unitShipping * line.quantity;
  }
  const shipping = typeof order.actualShipping === "number" ? order.actualShipping : estimatedShipping;
  const fees = typeof order.collectionCost === "number" ? order.collectionCost : commissions;
  return order.total - cost - fees - shipping;
}

export function appliedCollectionCost(order: StoreOrder) {
  if (typeof order.collectionCost !== "number") return 0;
  return orderRealizedMargin(order) === null ? 0 : order.collectionCost;
}

export function recordedReturnFreight(order: StoreOrder) {
  return order.status === "devuelto" && typeof order.returnFreight === "number" ? order.returnFreight : 0;
}

function orderNumbers(orders: StoreOrder[]) {
  return orders.map((order) => order.number).sort((left, right) => right.localeCompare(left, "es"));
}

function sumTotals(orders: StoreOrder[]) {
  return orders.reduce((sum, order) => sum + order.total, 0);
}

function marginGroups(orders: StoreOrder[], marginFor: (order: StoreOrder) => number | null) {
  const counted: StoreOrder[] = [];
  const missing: StoreOrder[] = [];
  for (const order of orders) {
    if (marginFor(order) === null) missing.push(order);
    else counted.push(order);
  }
  return { counted: orderNumbers(counted), missing: orderNumbers(missing) };
}

function marginOf(orders: StoreOrder[], marginFor: (order: StoreOrder) => number | null) {
  let amount = 0;
  let missing = 0;
  for (const order of orders) {
    const margin = marginFor(order);
    if (margin === null) missing += 1;
    else amount += margin;
  }
  return { amount, missing };
}

export function storeOrdersInPeriod(orders: StoreOrder[], period: Period, today = bogotaNow().slice(0, 10)) {
  const maxDays = period === "hoy" ? 0 : period === "7d" ? 6 : 29;
  const todayMs = Date.parse(`${today}T00:00:00-05:00`);
  return orders.filter((order) => {
    const ms = Date.parse(`${order.createdAt.slice(0, 10)}T00:00:00-05:00`);
    if (Number.isNaN(ms)) return false;
    const days = Math.round((todayMs - ms) / 86_400_000);
    return days >= 0 && days <= maxDays;
  });
}

export function periodPhrase(period: Period) {
  if (period === "hoy") return "hoy";
  if (period === "7d") return "los últimos 7 días";
  return "los últimos 30 días";
}

export function summarizeStoreOrders(orders: StoreOrder[]) {
  const active = orders.filter((order) => order.status !== "cancelado" && order.status !== "devuelto");
  const confirmed = active.filter((order) => CONFIRMED.includes(order.status));
  const delivered = active.filter((order) => order.status === "entregado");
  const collected = delivered.filter((order) => order.collected);
  const returned = orders.filter((order) => order.status === "devuelto");
  const returnFreight = returned.reduce((sum, order) => sum + recordedReturnFreight(order), 0);
  const realized = marginOf(collected, orderRealizedMargin);
  const collectionCost = collected.reduce((sum, order) => sum + appliedCollectionCost(order), 0);
  const estimatedGroups = marginGroups(confirmed, orderMargin);
  const realizedGroups = marginGroups(collected, orderRealizedMargin);

  return {
    registered: { count: active.length, amount: sumTotals(active), numbers: orderNumbers(active) },
    confirmed: { count: confirmed.length, amount: sumTotals(confirmed), numbers: orderNumbers(confirmed) },
    delivered: { count: delivered.length, amount: sumTotals(delivered), numbers: orderNumbers(delivered) },
    collected: { count: collected.length, amount: sumTotals(collected), numbers: orderNumbers(collected) },
    returned: { count: returned.length, amount: sumTotals(returned), numbers: orderNumbers(returned) },
    estimatedMargin: {
      ...marginOf(confirmed, orderMargin),
      numbers: estimatedGroups.counted,
      missingNumbers: estimatedGroups.missing,
    },
    realized: {
      amount: realized.amount - returnFreight,
      missing: realized.missing,
      numbers: realizedGroups.counted,
      missingNumbers: realizedGroups.missing,
    },
    returnFreight,
    returnFreightNumbers: orderNumbers(returned.filter((order) => recordedReturnFreight(order) > 0)),
    collectionCost,
    collectionCostNumbers: orderNumbers(collected.filter((order) => appliedCollectionCost(order) > 0)),
  };
}

export type SizeCount = {
  label: string;
  confirmedUnits: number;
  returnedUnits: number;
};

export type ProductSource = {
  number: string;
  status: OrderStatus;
  confirmed: boolean;
  realized: boolean;
  returned: boolean;
  missingCost: boolean;
};

export type ProductResult = {
  sku: string;
  title: string;
  confirmedUnits: number;
  confirmedAmount: number;
  estimatedMargin: number;
  estimatedMissingUnits: number;
  realizedUnits: number;
  realizedMargin: number;
  realizedMissingUnits: number;
  returnedUnits: number;
  returnedAmount: number;
  returnFreight: number;
  sizes: SizeCount[];
  sources: ProductSource[];
};

export function resultsByProduct(orders: StoreOrder[], guides: SizeGuide[] = []) {
  const rows = new Map<string, ProductResult>();

  for (const order of orders) {
    const returned = order.status === "devuelto";
    const confirmed = CONFIRMED.includes(order.status);
    const realized = order.status === "entregado" && order.collected;
    if (!returned && !confirmed) continue;

    for (const line of order.lines) {
      const current = rows.get(line.sku) ?? {
        sku: line.sku,
        title: line.title,
        confirmedUnits: 0,
        confirmedAmount: 0,
        estimatedMargin: 0,
        estimatedMissingUnits: 0,
        realizedUnits: 0,
        realizedMargin: 0,
        realizedMissingUnits: 0,
        returnedUnits: 0,
        returnedAmount: 0,
        returnFreight: 0,
        sizes: [],
        sources: [],
      };
      const source = current.sources.find((item) => item.number === order.number) ?? {
        number: order.number,
        status: order.status,
        confirmed,
        realized,
        returned,
        missingCost: false,
      };
      if (!current.sources.includes(source)) current.sources.push(source);
      const amount = line.unitPrice * line.quantity;
      const margin = lineMargin(line);
      const realizedMargin = realized ? orderRealizedMargin(order) : null;

      if (margin === null) source.missingCost = true;
      if (confirmed) {
        current.confirmedUnits += line.quantity;
        current.confirmedAmount += amount;
        if (margin === null) current.estimatedMissingUnits += line.quantity;
        else current.estimatedMargin += margin;
      }
      if (realized) {
        current.realizedUnits += line.quantity;
        if (realizedMargin === null) current.realizedMissingUnits += line.quantity;
        else if (order.lines.length === 1) current.realizedMargin += realizedMargin;
        else if (margin !== null) current.realizedMargin += margin;
      }
      if (returned) {
        current.returnedUnits += line.quantity;
        current.returnedAmount += amount;
        if (order.lines.length === 1) current.returnFreight += recordedReturnFreight(order);
      }
      const guide = guides.find((item) => item.sku === line.sku);
      const chosen = (line.variant ?? "").trim();
      const label = chosen
        ? sizeChoiceLabel(line.sizeKind ?? guide?.sizeKind ?? undefined, chosen)
        : guide?.sizeKind && guide.variants.length > 0
          ? guide.sizeKind === "tamano"
            ? "Sin tamaño anotado"
            : "Sin talla anotada"
          : "";
      if (label && (confirmed || returned)) {
        const bucket = current.sizes.find((item) => item.label === label) ?? { label, confirmedUnits: 0, returnedUnits: 0 };
        if (!current.sizes.includes(bucket)) current.sizes.push(bucket);
        if (confirmed) bucket.confirmedUnits += line.quantity;
        if (returned) bucket.returnedUnits += line.quantity;
      }
      rows.set(line.sku, current);
    }
  }

  for (const row of rows.values()) {
    row.sizes.sort((left, right) => {
      const leftMissing = left.label.startsWith("Sin ");
      const rightMissing = right.label.startsWith("Sin ");
      if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
      return left.label.localeCompare(right.label, "es");
    });
    row.sources.sort((left, right) => right.number.localeCompare(left.number, "es"));
  }

  return [...rows.values()].sort((a, b) => a.title.localeCompare(b.title, "es"));
}

const RESULT_PERIODS: Period[] = ["hoy", "7d", "30d"];

export function widerPeriodWithResults(
  orders: StoreOrder[],
  period: Period,
  guides: SizeGuide[] = [],
  today = bogotaNow().slice(0, 10),
) {
  const start = RESULT_PERIODS.indexOf(period);
  for (const candidate of RESULT_PERIODS.slice(start + 1)) {
    if (resultsByProduct(storeOrdersInPeriod(orders, candidate, today), guides).length > 0) return candidate;
  }
  return null;
}

const ACTIONS: ActionSpec[] = [
  {
    id: "confirmar",
    label: "Confirmar pedido",
    tone: "primary",
    summary: "Confirmó el pedido. El total guardado no cambió. Dropi no está conectado: no se envió.",
    status: "confirmado",
  },
  {
    id: "preparar",
    label: "Pasar a preparación",
    tone: "primary",
    summary: "Pasó el pedido a preparación. El total guardado no cambió.",
    status: "en_preparacion",
  },
  {
    id: "despachar",
    label: "Anotar despacho",
    tone: "primary",
    summary: "Anotó el despacho a mano. El total guardado no cambió. Dropi no está conectado: sin guía.",
    status: "en_transporte",
  },
  {
    id: "entregar",
    label: "Marcar entregado",
    tone: "primary",
    summary: "Marcó el pedido como entregado. El total guardado no cambió. El recaudo sigue pendiente. No es utilidad realizada.",
    status: "entregado",
  },
  {
    id: "cobrar",
    label: "Marcar cobrado",
    tone: "primary",
    summary: "Marcó el recaudo contra entrega.",
    collected: true,
  },
  {
    id: "quitar_cobro",
    label: "Quitar el cobro",
    tone: "quiet",
    summary: "Quitó el recaudo contra entrega.",
    collected: false,
  },
  {
    id: "incidencia",
    label: "Marcar incidencia",
    tone: "danger",
    summary: "Marcó una incidencia y dejó un motivo para el cliente. Deja de sumar como venta confirmada.",
    status: "incidencia",
    collected: false,
  },
  {
    id: "cancelar",
    label: "Cancelar pedido",
    tone: "danger",
    summary: "Canceló el pedido y dejó un motivo para el cliente. Deja de sumar en las ventas.",
    status: "cancelado",
    collected: false,
  },
  {
    id: "resolver",
    label: "Resolver incidencia",
    tone: "primary",
    summary: "Resolvió la incidencia y lo dejó confirmado. El total guardado no cambió.",
    status: "confirmado",
  },
  {
    id: "devolver",
    label: "Registrar devolución",
    tone: "danger",
    summary: "Registró la devolución y dejó un motivo para el cliente. Deja de contar como venta entregada y como utilidad realizada.",
    status: "devuelto",
    collected: false,
  },
];

function actionAllowed(order: StoreOrder, action: OrderAction) {
  switch (action) {
    case "confirmar":
      return order.status === "pendiente_confirmacion";
    case "preparar":
      return order.status === "confirmado" && !prepareDropiError(order);
    case "despachar":
      return order.status === "en_preparacion";
    case "entregar":
      return order.status === "en_transporte";
    case "cobrar":
      return order.status === "entregado" && !order.collected;
    case "quitar_cobro":
      return order.status === "entregado" && order.collected;
    case "incidencia":
      return order.status === "confirmado" || order.status === "en_preparacion" || order.status === "en_transporte";
    case "cancelar":
      return (
        order.status === "pendiente_confirmacion" ||
        order.status === "confirmado" ||
        order.status === "en_preparacion" ||
        order.status === "en_transporte" ||
        order.status === "incidencia"
      );
    case "resolver":
      return order.status === "incidencia" && !resolveIncidenceError(order);
    case "devolver":
      return order.status === "entregado";
    default:
      return false;
  }
}

const DROPI_QUEUE: OrderStatus[] = ["confirmado", "en_preparacion", "en_transporte"];
const DROPI_NOTE: OrderStatus[] = [...DROPI_QUEUE, "entregado", "incidencia", "devuelto"];

export function awaitsDropiNumber(order: Pick<StoreOrder, "status" | "providerRef">) {
  return DROPI_QUEUE.includes(order.status) && !normalizeProviderRef(order.providerRef ?? "");
}

const CLOSED_DROPI_NUMBER: OrderStatus[] = ["en_transporte", "entregado", "devuelto"];

export function needsClosedDropiNumber(order: { status: OrderStatus; providerRef?: string }) {
  return CLOSED_DROPI_NUMBER.includes(order.status) && !normalizeProviderRef(order.providerRef ?? "");
}

export function needsIncidenceDropiNumber(order: { status: OrderStatus; providerRef?: string }) {
  return order.status === "incidencia" && !normalizeProviderRef(order.providerRef ?? "");
}

export function prepareDropiError(order: { status: OrderStatus; providerRef?: string }) {
  if (order.status !== "confirmado" || normalizeProviderRef(order.providerRef ?? "")) return null;
  return "Anota el número de Dropi antes de pasarlo a preparación. Dropi no está conectado: anotarlo no lo envía.";
}

export function readyToPrepare(order: { status: OrderStatus; providerRef?: string }) {
  return order.status === "confirmado" && Boolean(normalizeProviderRef(order.providerRef ?? ""));
}

export function readyToDispatch(order: { status: OrderStatus }) {
  return order.status === "en_preparacion";
}

export function prepareQueueNote(order: { status: OrderStatus; providerRef?: string }) {
  if (!readyToPrepare(order)) return "";
  return "Ya tiene el número de Dropi. Se puede pasar a preparación. Dropi no está conectado: eso no lo envía. El total guardado no cambia.";
}

export function dispatchQueueNote(order: { status: OrderStatus }) {
  if (!readyToDispatch(order)) return "";
  return "Está en preparación. Anota el despacho a mano. Dropi no está conectado: sin guía. El total guardado no cambia.";
}

export function resolveIncidenceError(order: { status: OrderStatus; customerReason?: string }) {
  if (order.status !== "incidencia" || order.customerReason?.trim()) return null;
  return "Anota el motivo de la incidencia antes de resolverla. Anotarlo no la resuelve.";
}

export function canNoteDropiNumber(order: Pick<StoreOrder, "status">) {
  return DROPI_NOTE.includes(order.status);
}

export function dropiCopyHint(order: { status: OrderStatus; department?: string }) {
  const missing = order.department?.trim() ? "" : "Falta el departamento. Este texto no lo lleva. ";
  let body: string;
  switch (order.status) {
    case "incidencia":
      body = `${missing}El pedido está detenido. Dropi no está conectado: estos datos no lo resuelven ni lo crean ahí.`;
      break;
    case "entregado":
      body = `${missing}Ya está entregado. Dropi no está conectado: estos datos no crean otro pedido ahí.`;
      break;
    case "devuelto":
      body = `${missing}Ya está devuelto. Dropi no está conectado: estos datos no crean otro pedido ahí.`;
      break;
    default:
      body = `${missing}Nombre, celular, dirección y productos. Sin costos. Dropi no está conectado: pégalo ahí a mano; desde aquí no se crea el pedido.`;
  }
  return `${body} El total guardado no cambia.`;
}

export function dropiNumberHint(order: { status: OrderStatus; providerRef?: string }) {
  if (prepareDropiError(order)) {
    return "Sin este número el pedido no pasa a preparación. Dropi no está conectado: no es una guía y desde aquí no se envía.";
  }
  switch (order.status) {
    case "incidencia":
      return "El pedido está detenido. Dropi no está conectado: anotar el número no lo resuelve ni lo envía.";
    case "entregado":
      return "Ya está entregado. Dropi no está conectado: anotar el número no crea otro pedido ni lo envía.";
    case "devuelto":
      return "Ya está devuelto. Dropi no está conectado: anotar el número no crea otro pedido ni lo envía.";
    default:
      return "El que te muestra Dropi cuando lo creas tú. Dropi no está conectado: no es una guía y desde aquí no se envía.";
  }
}

export function normalizeProviderRef(raw: string) {
  return raw.trim().replace(/\s+/g, "");
}

const EDITABLE_DELIVERY: OrderStatus[] = ["pendiente_confirmacion", "confirmado", "en_preparacion", "incidencia"];

export function canEditDelivery(order: Pick<StoreOrder, "status">) {
  return EDITABLE_DELIVERY.includes(order.status);
}

export function canEditLines(order: Pick<StoreOrder, "status">) {
  return order.status === "pendiente_confirmacion";
}

export function payableTotalLabel(status: OrderStatus) {
  if (status === "cancelado" || status === "devuelto" || status === "entregado" || status === "incidencia") {
    return "Total guardado";
  }
  return "Total al recibir";
}

export function customerPayLine(status: OrderStatus, collected = false) {
  if (status === "cancelado" || status === "devuelto") {
    return "Este pedido ya no se cobra. El total guardado no cambió. ";
  }
  if (status === "entregado") {
    return collected
      ? "La tienda anotó el cobro. El total guardado no cambió. "
      : "El cobro contra entrega todavía no está anotado. El total guardado no cambió. ";
  }
  if (status === "incidencia") {
    return "Mientras dure la incidencia no se cobra. Si continúa, pagas al recibir. El total guardado no cambió. ";
  }
  if (status === "confirmado" || status === "en_preparacion" || status === "en_transporte") {
    return "Pagas al recibir. El total guardado no cambió. ";
  }
  return "Pagas al recibir. ";
}

export type LineEdit = {
  sku: string;
  variant: string;
  nextVariant?: string;
  quantity: number;
};

export type SizeCatalog = {
  variants: string[];
  sizeKind?: SizeKind;
};

export function validateLineEdits(
  order: Pick<StoreOrder, "status" | "lines">,
  drafts: LineEdit[],
  findProduct: (sku: string) => SizeCatalog | null = () => null,
) {
  if (!canEditLines(order)) {
    return { lines: null, error: "Las cantidades solo se corrigen mientras el pedido está pendiente de confirmación." };
  }
  if (drafts.length === 0) return { lines: null, error: "Para anular el pedido usa Cancelar." };
  if (drafts.length > order.lines.length) return { lines: null, error: "No se pueden agregar productos desde aquí." };

  const used = new Set<number>();
  const lines: OrderLine[] = [];
  for (const draft of drafts) {
    if (!Number.isInteger(draft.quantity) || draft.quantity < 1 || draft.quantity > 5) {
      return { lines: null, error: "Cada producto puede pedirse de 1 a 5 unidades." };
    }
    const variant = draft.variant.trim();
    const nextVariant = (draft.nextVariant ?? draft.variant).trim();
    const index = order.lines.findIndex(
      (line, position) => !used.has(position) && line.sku === draft.sku.trim() && (line.variant ?? "") === variant,
    );
    if (index < 0) return { lines: null, error: "Un producto del pedido ya no coincide." };
    used.add(index);
    const current = order.lines[index];
    const product = findProduct(current.sku);
    if (product?.sizeKind && product.variants.length > 0 && !variantFits(product.variants, nextVariant)) {
      return {
        lines: null,
        error: product.sizeKind === "tamano" ? "Elige el tamaño antes de guardar." : "Elige la talla antes de guardar.",
      };
    }
    if (nextVariant === variant) {
      lines.push({ ...current, quantity: draft.quantity });
      continue;
    }
    if (!product?.sizeKind || product.variants.length === 0) {
      return { lines: null, error: "Ese producto no tiene tallas ni tamaños." };
    }
    lines.push({ ...current, quantity: draft.quantity, variant: nextVariant, sizeKind: product.sizeKind });
  }
  const seen = new Set<string>();
  for (const line of lines) {
    const key = `${line.sku}\n${line.variant ?? ""}`;
    if (seen.has(key)) {
      return {
        lines: null,
        error:
          line.sizeKind === "tamano"
            ? "Ese tamaño ya está en el pedido. Cambia la cantidad."
            : line.sizeKind === "talla"
              ? "Esa talla ya está en el pedido. Cambia la cantidad."
              : "Ese producto ya está en el pedido. Cambia la cantidad.",
      };
    }
    seen.add(key);
  }
  return { lines, error: null as string | null };
}

export type DeliveryDraft = {
  customerName: string;
  phone: string;
  city: string;
  department: string;
  address: string;
  reference: string;
  document: string;
};

export function validateDocument(raw: string) {
  const value = raw.trim();
  if (!value) return { value: "", error: null as string | null };
  if (!/^\d{6,10}$/.test(value)) {
    return { value: null, error: "La cédula son entre 6 y 10 dígitos, sin puntos." };
  }
  return { value, error: null };
}

export function validateDepartment(raw: string, required: boolean) {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return required ? "Escribe el departamento." : null;
  if (value.length < 2 || value.length > 40) return "El departamento tiene entre 2 y 40 caracteres.";
  return null;
}

export function validateDelivery(input: DeliveryDraft) {
  const customerName = input.customerName.trim();
  const phone = normalizePhone(input.phone);
  const city = input.city.trim();
  const address = input.address.trim();
  const reference = input.reference.trim();
  if (customerName.length < 3 || customerName.length > 80) {
    return { value: null, error: "Escribe el nombre de quien recibe, entre 3 y 80 caracteres." };
  }
  if (!/^3\d{9}$/.test(phone)) {
    return { value: null, error: "Escribe un celular de Colombia, de 10 dígitos y que empiece por 3." };
  }
  const document = validateDocument(input.document);
  if (document.error || document.value === null) return { value: null, error: document.error };
  if (city.length < 2 || city.length > 60) return { value: null, error: "Escribe la ciudad." };
  const departmentError = validateDepartment(input.department, false);
  if (departmentError) return { value: null, error: departmentError };
  if (address.length < 8 || address.length > 160) {
    return { value: null, error: "Escribe la dirección donde se entrega el pedido." };
  }
  if (reference.length > 120) return { value: null, error: "La referencia es demasiado larga." };
  return {
    value: {
      customerName,
      phone,
      city,
      department: input.department.trim().replace(/\s+/g, " "),
      address,
      reference,
      document: document.value,
    } satisfies DeliveryDraft,
    error: null as string | null,
  };
}

export function validateInternalNote(raw: string) {
  const value = raw.trim();
  if (!value) return { value: null as string | null, error: null as string | null };
  if (value.length > 280) return { value: null, error: "La nota interna puede tener hasta 280 caracteres." };
  return { value, error: null };
}

export function validateProviderRef(raw: string) {
  const value = normalizeProviderRef(raw);
  if (!value) return { value: null as string | null, error: "Escribe el número que te dio Dropi." };
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{2,39}$/.test(value)) {
    return { value: null, error: "El número de Dropi usa letras, números y guiones, entre 3 y 40 caracteres." };
  }
  return { value, error: null as string | null };
}

export function actionsFor(order: StoreOrder, guides: SizeGuide[] = []) {
  return ACTIONS.filter((action) => {
    if (action.id === "confirmar" && confirmSizeError(order, guides)) return false;
    return actionAllowed(order, action.id);
  }).map((action) => ({
    id: action.id,
    label: action.label,
    tone: action.tone,
  }));
}

export function applyOrderAction(order: StoreOrder, action: OrderAction) {
  const spec = ACTIONS.find((item) => item.id === action);
  if (!spec || !actionAllowed(order, action)) {
    return { error: "Esa acción no corresponde al estado del pedido.", order: null };
  }
  return {
    error: null,
    order: {
      ...order,
      status: spec.status ?? order.status,
      collected: spec.collected ?? order.collected,
    },
    summary: spec.summary,
  };
}

export function needsCustomerReason(action: OrderAction) {
  return action === "cancelar" || action === "incidencia" || action === "devolver";
}

export function validateBuyerNote(raw: string) {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length > 160) return { value: null, error: "El aviso puede tener hasta 160 caracteres." };
  return { value, error: null as string | null };
}

export function validateCustomerReason(raw: string) {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return { value: null, error: "Escribe el motivo para el cliente, hasta 160 caracteres." };
  if (value.length > 160) return { value: null, error: "El motivo para el cliente puede tener hasta 160 caracteres." };
  return { value, error: null as string | null };
}

export function cancelledByCustomer(order: { status: OrderStatus; history?: OrderEvent[] }) {
  return order.status === "cancelado" && (order.history ?? []).some((event) => event.summary.startsWith("Canceló su pedido"));
}

const NOTICE_STATUS: OrderStatus[] = ["confirmado", "en_preparacion", "en_transporte", "entregado", "devuelto", "cancelado", "incidencia"];

export function needsIncidenceReason(order: { status: OrderStatus; customerReason?: string }) {
  return order.status === "incidencia" && !order.customerReason?.trim();
}

export function needsReturnReason(order: { status: OrderStatus; customerReason?: string }) {
  return order.status === "devuelto" && !order.customerReason?.trim();
}

export function needsReturnFreight(order: { status: OrderStatus; returnFreight?: number }) {
  return order.status === "devuelto" && typeof order.returnFreight !== "number";
}

export function customerMissingReasonNote(order: { status: OrderStatus; customerReason?: string }) {
  if (order.customerReason?.trim()) return "";
  if (order.status === "incidencia") return "Todavía no dejó el motivo de la incidencia.";
  if (order.status === "devuelto") return "Todavía no dejó el motivo de la devolución.";
  return "";
}

export function needsCustomerNotice(order: { status: OrderStatus; customerNotifiedAt?: string; history?: OrderEvent[] }) {
  if (order.customerNotifiedAt) return false;
  if (cancelledByCustomer(order)) return false;
  return NOTICE_STATUS.includes(order.status);
}

const CUSTOMER_PATH: Array<{ status: OrderStatus; label: string }> = [
  { status: "pendiente_confirmacion", label: "Recibido" },
  { status: "confirmado", label: "Confirmado" },
  { status: "en_preparacion", label: "Preparación" },
  { status: "en_transporte", label: "Despacho" },
  { status: "entregado", label: "Entrega" },
];

export type CustomerStep = { label: string; state: "hecho" | "ahora" | "despues" };

export function customerSteps(status: OrderStatus): CustomerStep[] | null {
  const index = CUSTOMER_PATH.findIndex((step) => step.status === status);
  if (index < 0) return null;
  return CUSTOMER_PATH.map((step, position) => ({
    label: step.label,
    state: position < index ? "hecho" : position === index ? "ahora" : "despues",
  }));
}

export function customerSizeHoldNote(
  lines: Array<Pick<OrderLine, "sku" | "variant">>,
  guides: Array<{ sku: string; sizeKind?: SizeKind; variants: string[] }>,
) {
  const kinds = lines.flatMap((line) => {
    const guide = guides.find((item) => item.sku === line.sku);
    if (!guide?.sizeKind || guide.variants.length === 0) return [];
    if (variantFits(guide.variants, line.variant ?? "")) return [];
    return [guide.sizeKind];
  });
  if (kinds.length === 0) return "";
  const noun = kinds.every((kind) => kind === "tamano")
    ? "el tamaño"
    : kinds.every((kind) => kind === "talla")
      ? "la talla"
      : "la talla o el tamaño";
  return `La tienda no confirma este pedido hasta que elijas ${noun}.`;
}

export function customerProgressNote(status: OrderStatus, collected = false) {
  switch (status) {
    case "pendiente_confirmacion":
      return "No hay guía ni fecha. Pagas al recibir. Dropi no está conectado.";
    case "confirmado":
    case "en_preparacion":
      return "Dropi no está conectado. Todavía no hay guía ni fecha. El despacho se anota a mano. El total guardado no cambió. Pagas al recibir.";
    case "en_transporte":
      return "Dropi no está conectado. Sin guía ni una fecha exacta de llegada. El total guardado no cambió. Pagas al recibir.";
    case "entregado":
      return collected
        ? "La tienda anotó el cobro contra entrega. El total guardado no cambió. Dropi no está conectado: sin guía."
        : "El cobro contra entrega todavía no está anotado. El total guardado no cambió. Dropi no está conectado: sin guía.";
    default:
      return "";
  }
}

export function customerStatusNote(status: OrderStatus, reason = "", byCustomer = false, collected = false) {
  const spoken = reason.trim().replace(/\s+/g, " ");
  const detail = spoken ? ( /[.!?]$/.test(spoken) ? spoken : `${spoken}.`) : "";
  switch (status) {
    case "pendiente_confirmacion":
      return "Quedó pendiente de confirmación. La tienda revisará la dirección antes de despachar. No hay guía ni fecha de entrega: Dropi no está conectado. Si ya no lo quieres, cancélalo al consultar el pedido.";
    case "confirmado":
      return "La tienda confirmó el pedido. Dropi no está conectado. Todavía no hay guía ni fecha de entrega. El despacho se anota a mano. El total guardado no cambió. Pagas al recibir.";
    case "en_preparacion":
      return "La tienda está preparando el pedido. Dropi no está conectado. Todavía no hay guía ni fecha de entrega. El total guardado no cambió. Pagas al recibir.";
    case "en_transporte":
      return "La tienda anotó el despacho. Dropi no está conectado. Sin guía ni una fecha exacta de llegada. El total guardado no cambió. Pagas al recibir.";
    case "entregado":
      return collected
        ? "La tienda marcó el pedido como entregado y anotó el cobro contra entrega. El total guardado no cambió. Dropi no está conectado: sin guía."
        : "La tienda marcó el pedido como entregado. El cobro contra entrega todavía no está anotado. El total guardado no cambió. Dropi no está conectado: sin guía.";
    case "incidencia":
      return detail
        ? `La tienda marcó una incidencia: ${detail} El pedido no sigue su curso hasta que lo resuelva. El total guardado no cambió.`
        : "La tienda marcó una incidencia. El pedido no sigue su curso hasta que lo resuelva. El total guardado no cambió.";
    case "cancelado":
      if (byCustomer) {
        return detail
          ? `Cancelaste este pedido: ${detail} No se va a despachar. El total guardado no cambió.`
          : "Cancelaste este pedido. No se va a despachar. El total guardado no cambió.";
      }
      return detail
        ? `La tienda canceló este pedido: ${detail} No se va a despachar. El total guardado no cambió.`
        : "La tienda canceló este pedido. No se va a despachar. El total guardado no cambió.";
    case "devuelto":
      return detail
        ? `La tienda registró la devolución de este pedido: ${detail} Ya no sigue como entrega cobrada. El total guardado no cambió.`
        : "La tienda registró la devolución de este pedido. Ya no sigue como entrega cobrada. El total guardado no cambió.";
    default:
      return "La tienda está revisando este pedido. Dropi no está conectado. No hay guía ni fecha de entrega.";
  }
}

export function customerMessage(order: Pick<StoreOrder, "number" | "customerName" | "status" | "collected" | "customerReason" | "history">) {
  const first = order.customerName.trim().split(/\s+/)[0] ?? "";
  const hello = first.length >= 2 ? `Hola ${first}.` : "Hola.";
  return `${hello} Tu pedido ${order.number}: ${customerStatusNote(order.status, order.customerReason ?? "", cancelledByCustomer(order), order.collected)}`;
}

export function whatsAppHref(phone: string, text: string) {
  if (!/^3\d{9}$/.test(phone)) return null;
  return `https://wa.me/57${phone}?text=${encodeURIComponent(text)}`;
}

export function toCustomerOrder(order: StoreOrder): CustomerOrder {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    createdAt: order.createdAt,
    customerName: order.customerName,
    phone: order.phone,
    document: order.document ?? "",
    city: order.city,
    department: order.department?.trim() ?? "",
    address: order.address,
    reference: order.reference,
    customerReason: order.customerReason?.trim() ?? "",
    buyerNote: order.buyerNote?.trim() ?? "",
    cancelledByCustomer: cancelledByCustomer(order),
    collected: order.collected,
    lines: order.lines.map((line) => ({
      sku: line.sku,
      title: line.title,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      variant: line.variant,
      ...(line.sizeKind ? { sizeKind: line.sizeKind } : {}),
    })),
    total: order.total,
    payment: order.payment,
  };
}
