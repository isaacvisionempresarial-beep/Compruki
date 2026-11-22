import { bogotaNow, sizeChoiceLabel, validSizeName, variantFits, type SizeKind } from "@/lib/catalog";
import { STATUS_LABEL, type OrderStatus, type Period } from "@/lib/demo-data";
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
  if (canEditDelivery(order)) return "Falta el departamento. El texto para Dropi no lo lleva hasta que lo anotes. El total guardado no cambia.";
  if (needsClosedDepartment(order)) {
    return "Falta el departamento. La entrega ya no se corrige. El texto para Dropi no lo lleva hasta que lo anotes. El total guardado no cambia.";
  }
  return "Este pedido no tiene departamento. El texto para Dropi no lo lleva. El total guardado no cambia.";
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
  if (!base) return base;
  const kept = " El total guardado no cambia.";
  if (!collectedWithoutCost(order)) return `${base}${kept}`;
  return `${base} Ya está cobrado y no entra en la utilidad realizada.${kept}`;
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
      ? "Marcó el recaudo contra entrega. Sin el costo del producto no entra en la utilidad realizada. El total guardado no cambió. No es dinero cobrado."
      : "Marcó el recaudo contra entrega. Entra en la utilidad realizada. El total guardado no cambió. No es dinero cobrado.";
  }
  return needsCatalogCost(order)
    ? "Quitó el recaudo contra entrega. El pedido sigue fuera de la utilidad realizada. El total guardado no cambió. No es dinero cobrado."
    : "Quitó el recaudo. Deja de contar como utilidad realizada. El total guardado no cambió. No es dinero cobrado.";
}

export function collectionAmountSummary(order: Pick<StoreOrder, "lines">, amount: number | null) {
  if (amount === null) {
    return needsCatalogCost(order)
      ? "Quitó el recaudo real. El pedido sigue fuera de la utilidad realizada. No es dinero cobrado."
      : "Quitó el recaudo real. La utilidad vuelve a usar las comisiones estimadas. No es dinero cobrado.";
  }
  return needsCatalogCost(order)
    ? `Anotó el recaudo real en ${formatCop(amount)}. Sin el costo del producto no entra en la utilidad realizada. No es dinero cobrado.`
    : `Anotó el recaudo real en ${formatCop(amount)}. Reemplaza las comisiones estimadas en la utilidad realizada. No es dinero cobrado.`;
}

export function shippingClearedSummary(order: Pick<StoreOrder, "lines">) {
  return needsCatalogCost(order)
    ? "Quitó el flete real. Sin el costo del producto no entra en la utilidad realizada. No es dinero cobrado."
    : "Quitó el flete real. La utilidad vuelve a usar el flete estimado. No es dinero cobrado.";
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

export function adoptCatalogCosts(order: Pick<StoreOrder, "lines">, guides: CostGuide[]) {
  let filled = false;
  let replaced = false;
  const lines: OrderLine[] = [];
  for (const line of order.lines) {
    const guide = guides.find((item) => item.sku === line.sku);
    const ready = readyCostGuide(guide);
    const missingCost = typeof line.unitCost !== "number";
    const missingShipping = typeof line.unitShipping !== "number";
    const missingCommissions = typeof line.unitCommissions !== "number";
    const costDiffers = ready && typeof line.unitCost === "number" && line.unitCost !== guide.cost;
    const shippingDiffers = ready && typeof line.unitShipping === "number" && line.unitShipping !== guide.shipping;
    const commissionsDiffer = ready && typeof line.unitCommissions === "number" && line.unitCommissions !== guide.commissions;
    const missing = missingCost || missingShipping || missingCommissions;
    const differs = Boolean(costDiffers || shippingDiffers || commissionsDiffer);
    if (!missing && !differs) {
      lines.push(line);
      continue;
    }
    if (!readyCostGuide(guide)) {
      return {
        lines: order.lines,
        mode: "igual" as const,
        error: `La ficha de ${line.title} ya no tiene el costo, el envío y las comisiones.`,
      };
    }
    if (missing) filled = true;
    if (differs) replaced = true;
    lines.push({
      ...line,
      unitCost: guide.cost,
      unitShipping: guide.shipping,
      unitCommissions: guide.commissions,
    });
  }
  const mode: "igual" | "anotar" | "reemplazar" = replaced ? "reemplazar" : filled ? "anotar" : "igual";
  return { lines, mode, error: null as string | null };
}

export function adoptSkuCosts(order: Pick<StoreOrder, "lines" | "total">, sku: string, guide: CostGuide | undefined) {
  const needle = sku.trim().toUpperCase();
  let replaced = false;
  const lines: OrderLine[] = [];
  for (const line of order.lines) {
    if (line.sku !== needle) {
      lines.push(line);
      continue;
    }
    if (!readyCostGuide(guide)) {
      const hasStored =
        typeof line.unitCost === "number" || typeof line.unitShipping === "number" || typeof line.unitCommissions === "number";
      if (!hasStored) {
        lines.push(line);
        continue;
      }
      return {
        lines: order.lines,
        total: order.total,
        mode: "igual" as const,
        error: `La ficha de ${line.title} ya no tiene el costo, el envío y las comisiones.`,
      };
    }
    const differs =
      (typeof line.unitCost === "number" && line.unitCost !== guide.cost) ||
      (typeof line.unitShipping === "number" && line.unitShipping !== guide.shipping) ||
      (typeof line.unitCommissions === "number" && line.unitCommissions !== guide.commissions);
    if (!differs) {
      lines.push(line);
      continue;
    }
    replaced = true;
    lines.push({
      ...line,
      unitCost: guide.cost,
      unitShipping: guide.shipping,
      unitCommissions: guide.commissions,
    });
  }
  if (!replaced) return { lines: order.lines, total: order.total, mode: "igual" as const, error: null as string | null };
  return { lines, total: order.total, mode: "reemplazar" as const, error: null as string | null };
}

export function catalogCostSummary(mode: "anotar" | "reemplazar") {
  if (mode === "reemplazar") {
    return "Reemplazó el costo guardado con las cifras de la ficha de hoy. El precio del pedido no cambió. El total guardado no cambió. No es dinero cobrado.";
  }
  return "Anotó el costo, el envío y las comisiones de la ficha. El precio del pedido no cambió. El total guardado no cambió. No es dinero cobrado.";
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
  return notes ? `${notes} Confirmar queda bloqueado. El total guardado no cambia.` : "";
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

export type PriceGuide = { sku: string; price: number };

export function priceDrift(order: Pick<StoreOrder, "lines">, guides: PriceGuide[]) {
  const drifts: Array<{ sku: string; title: string; stored: number; current: number }> = [];
  for (const line of order.lines) {
    const guide = guides.find((item) => item.sku === line.sku);
    if (!guide || guide.price === line.unitPrice) continue;
    drifts.push({ sku: line.sku, title: line.title, stored: line.unitPrice, current: guide.price });
  }
  return drifts;
}

export type StoredSkuLine = {
  number: string;
  status?: OrderStatus;
  collected?: boolean;
  unitPrice: number;
  unitCost?: number;
  unitShipping?: number;
  unitCommissions?: number;
};

export function storedSkuLines(
  orders: Array<{
    number: string;
    status?: OrderStatus;
    collected?: boolean;
    lines: Array<Pick<OrderLine, "sku" | "unitPrice" | "unitCost" | "unitShipping" | "unitCommissions">>;
  }>,
  sku: string,
): StoredSkuLine[] {
  const needle = sku.trim().toUpperCase();
  if (!needle) return [];
  const lines: StoredSkuLine[] = [];
  for (const order of orders) {
    for (const line of order.lines) {
      if (line.sku !== needle) continue;
      lines.push({
        number: order.number,
        ...(order.status ? { status: order.status } : {}),
        ...(order.collected ? { collected: true } : {}),
        unitPrice: line.unitPrice,
        ...(typeof line.unitCost === "number" ? { unitCost: line.unitCost } : {}),
        ...(typeof line.unitShipping === "number" ? { unitShipping: line.unitShipping } : {}),
        ...(typeof line.unitCommissions === "number" ? { unitCommissions: line.unitCommissions } : {}),
      });
    }
  }
  return lines;
}

export function fichaDrift(
  lines: StoredSkuLine[],
  current: { price: number | null; cost: number | null; shipping: number | null; commissions: number | null },
) {
  const priceNumbers: string[] = [];
  const storedPrices = new Set<number>();
  const costNumbers: string[] = [];
  const pendingNumbers: string[] = [];
  const cancelNumbers: string[] = [];
  const incidenceNumbers: string[] = [];
  const returnedNumbers: string[] = [];
  const holdLists: Partial<Record<OrderStatus, string[]>> = {
    pendiente_confirmacion: pendingNumbers,
    cancelado: cancelNumbers,
    incidencia: incidenceNumbers,
    devuelto: returnedNumbers,
  };
  const costBuckets = new Map<string, { label: string; current: number; stored: number[] }>();
  const remember = (key: string, label: string, currentValue: number | null, stored: number | undefined) => {
    if (currentValue === null || typeof stored !== "number" || stored === currentValue) return false;
    const field = costBuckets.get(key) ?? { label, current: currentValue, stored: [] };
    if (!field.stored.includes(stored)) field.stored.push(stored);
    costBuckets.set(key, field);
    return true;
  };
  for (const line of lines) {
    if (current.price !== null && line.unitPrice !== current.price) {
      if (!priceNumbers.includes(line.number)) priceNumbers.push(line.number);
      storedPrices.add(line.unitPrice);
    }
    const costDiffers =
      remember("cost", "el costo", current.cost, line.unitCost) ||
      remember("shipping", "el envío estimado", current.shipping, line.unitShipping) ||
      remember("commissions", "las comisiones estimadas", current.commissions, line.unitCommissions);
    if (costDiffers && !costNumbers.includes(line.number)) costNumbers.push(line.number);
    const drifted = priceNumbers.includes(line.number) || costNumbers.includes(line.number);
    const hold = line.status ? holdLists[line.status] : undefined;
    if (drifted && hold && !hold.includes(line.number)) hold.push(line.number);
  }
  return {
    priceNumbers,
    storedPrices: [...storedPrices],
    costNumbers,
    pendingNumbers,
    cancelNumbers,
    incidenceNumbers,
    returnedNumbers,
    costFields: ["cost", "shipping", "commissions"].flatMap((key) => {
      const field = costBuckets.get(key);
      return field ? [field] : [];
    }),
  };
}

export function fichaDriftNote(
  drift: {
    priceNumbers: string[];
    storedPrices: number[];
    costNumbers: string[];
    pendingNumbers: string[];
    cancelNumbers: string[];
    incidenceNumbers: string[];
    returnedNumbers: string[];
    costFields: Array<{ label: string; current: number; stored: number[] }>;
  },
  price: number | null,
) {
  const parts: string[] = [];
  if (price !== null && drift.priceNumbers.length > 0) {
    const count = drift.priceNumbers.length === 1 ? "1 pedido guardó" : `${drift.priceNumbers.length} pedidos guardaron`;
    const stored = drift.storedPrices.length === 1 ? formatCop(drift.storedPrices[0]) : "precios distintos";
    parts.push(
      `La ficha está en ${formatCop(price)}. ${count} ${stored}. Guardar la ficha no reescribe el total. No es dinero cobrado.`,
    );
  }
  if (drift.costFields.length > 0) {
    const today = drift.costFields.map((field) => `${field.label} en ${formatCop(field.current)}`).join(", ");
    const stored = drift.costFields
      .map((field) => `${field.label} en ${field.stored.length === 1 ? formatCop(field.stored[0]) : "cifras distintas"}`)
      .join(", ");
    const who = drift.costNumbers.length === 1 ? "Ese pedido guardó" : "Esos pedidos guardaron";
    parts.push(`La ficha hoy tiene ${today}. ${who} ${stored}. Guardar la ficha no lo reescribe. El total guardado no cambia.`);
  }
  if (drift.pendingNumbers.length === 1) {
    parts.push(`${drift.pendingNumbers[0]} sigue pendiente y no entra al margen ni a la utilidad.`);
  } else if (drift.pendingNumbers.length > 1) {
    parts.push(`${drift.pendingNumbers.join(", ")} siguen pendientes y no entran al margen ni a la utilidad.`);
  }
  if (drift.cancelNumbers.length === 1) {
    parts.push(`${drift.cancelNumbers[0]} está cancelado y no entra al margen ni a la utilidad.`);
  } else if (drift.cancelNumbers.length > 1) {
    parts.push(`${drift.cancelNumbers.join(", ")} están cancelados y no entran al margen ni a la utilidad.`);
  }
  if (drift.incidenceNumbers.length === 1) {
    parts.push(`${drift.incidenceNumbers[0]} está en incidencia y no suma como venta confirmada mientras dure.`);
  } else if (drift.incidenceNumbers.length > 1) {
    parts.push(`${drift.incidenceNumbers.join(", ")} están en incidencia y no suman como venta confirmada mientras dure.`);
  }
  if (drift.returnedNumbers.length === 1) {
    parts.push(`${drift.returnedNumbers[0]} está devuelto y el total guardado no entra a la utilidad.`);
  } else if (drift.returnedNumbers.length > 1) {
    parts.push(`${drift.returnedNumbers.join(", ")} están devueltos y el total guardado no entra a la utilidad.`);
  }
  return parts.join(" ");
}

const COST_COUNTED: OrderStatus[] = ["confirmado", "en_preparacion", "en_transporte", "entregado"];
const COST_OUTSIDE: OrderStatus[] = ["pendiente_confirmacion", "cancelado", "incidencia", "devuelto"];

function nameList(numbers: string[]) {
  if (numbers.length <= 1) return numbers[0] ?? "";
  if (numbers.length === 2) return `${numbers[0]} y ${numbers[1]}`;
  return `${numbers.slice(0, -1).join(", ")} y ${numbers[numbers.length - 1]}`;
}

export function skuCostGroups(
  lines: StoredSkuLine[],
  current: { cost: number; shipping: number; commissions: number },
) {
  const drift = fichaDrift(lines, { price: null, ...current });
  const counted: string[] = [];
  const outside: string[] = [];
  const collected: string[] = [];
  for (const number of drift.costNumbers) {
    const line = lines.find((item) => item.number === number);
    if (line?.status && COST_OUTSIDE.includes(line.status)) outside.push(number);
    else if (line?.status && COST_COUNTED.includes(line.status)) counted.push(number);
    if (line?.status === "entregado" && line.collected) collected.push(number);
  }
  return { counted, outside, collected };
}

function pesosAt(rows: Array<{ number: string; amount: number }>) {
  const parts = rows.map((row) => `${formatCop(row.amount)} en ${row.number}`);
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} y en ${parts[1]}`;
  return `${parts.slice(0, -1).join(", en ")} y en ${parts[parts.length - 1]}`;
}

export function skuCostPreviewNote(
  orders: Array<{
    number: string;
    status?: OrderStatus;
    collected?: boolean;
    total?: number;
    actualShipping?: number;
    collectionCost?: number;
    lines: Array<Pick<OrderLine, "sku" | "unitPrice" | "unitCost" | "unitShipping" | "unitCommissions"> & Partial<Pick<OrderLine, "quantity" | "title">>>;
  }>,
  sku: string,
  guide: CostGuide,
  place = "",
) {
  if (!readyCostGuide(guide)) return "";
  const margins: Array<{ number: string; amount: number }> = [];
  const open: string[] = [];
  const realized: Array<{ number: string; amount: number }> = [];
  const realizedOpen: string[] = [];
  for (const order of orders) {
    if (skuCostScope(order.status) !== "cuentan") continue;
    if (order.lines.some((line) => typeof line.quantity !== "number")) continue;
    const adopted = adoptSkuCosts({ lines: order.lines as OrderLine[], total: order.total ?? 0 }, sku, guide);
    if (adopted.error || adopted.mode !== "reemplazar") continue;
    const next = { ...order, lines: adopted.lines, total: order.total ?? 0 } as StoreOrder;
    const margin = orderMargin(next);
    if (margin === null) open.push(order.number);
    else margins.push({ number: order.number, amount: margin });
    if (order.status === "entregado" && order.collected) {
      if (typeof order.total !== "number") realizedOpen.push(order.number);
      else {
        const profit = orderRealizedMargin(next);
        if (profit === null) realizedOpen.push(order.number);
        else realized.push({ number: order.number, amount: profit });
      }
    }
  }
  const countedWhere = place ? ` de ${place}` : "";
  const parts: string[] = [];
  if (margins.length === 1) {
    parts.push(
      `Si copias en los que ya cuentan${countedWhere}, el margen estimado de ${margins[0].number} queda en ${formatCop(margins[0].amount)}. No es dinero cobrado. El total guardado no cambia.`,
    );
  } else if (margins.length > 1) {
    const sum = margins.reduce((total, row) => total + row.amount, 0);
    parts.push(
      `Si copias en los que ya cuentan${countedWhere}, el margen estimado queda en ${pesosAt(margins)}. Sumados, ${formatCop(sum)}. No es dinero cobrado. El total guardado no cambia.`,
    );
  }
  if (open.length === 1) {
    parts.push(`${open[0]} no cierra el margen estimado: otra línea no tiene costo, envío o comisiones. El total guardado no cambia.`);
  } else if (open.length > 1) {
    parts.push(`${nameList(open)} no cierran el margen estimado: otra línea no tiene costo, envío o comisiones. El total guardado no cambia.`);
  }
  if (realized.length === 1) {
    parts.push(
      `${realized[0].number} ya está cobrado. Si copias, su utilidad realizada queda en ${formatCop(realized[0].amount)}, con el flete y el recaudo ya anotados. No es un cobro nuevo. El total guardado no cambia.`,
    );
  } else if (realized.length > 1) {
    const sum = realized.reduce((total, row) => total + row.amount, 0);
    parts.push(
      `${nameList(realized.map((row) => row.number))} ya están cobrados. Si copias, la utilidad realizada queda en ${pesosAt(realized)}. Sumadas, ${formatCop(sum)}. No es un cobro nuevo. El total guardado no cambia.`,
    );
  }
  if (realizedOpen.length === 1) {
    parts.push(`${realizedOpen[0]} ya está cobrado, pero la utilidad realizada no cierra: falta el costo de otra línea. No es un cobro nuevo. El total guardado no cambia.`);
  } else if (realizedOpen.length > 1) {
    parts.push(
      `${nameList(realizedOpen)} ya están cobrados, pero la utilidad realizada no cierra: falta el costo de otra línea. No es un cobro nuevo. El total guardado no cambia.`,
    );
  }
  if (parts.length > 0 && place) {
    parts.push(`La ficha también copia los que ya cuentan fuera de ${place}. Esta vista no guarda el costo.`);
  }
  return parts.join(" ");
}

export function skuCostGroupNote(groups: { counted: string[]; outside: string[]; collected: string[] }) {
  const parts: string[] = [];
  if (groups.counted.length === 1) {
    parts.push(`${groups.counted[0]} ya cuenta. Si copias el costo de hoy, su margen estimado pasa a usarlo. El total guardado no cambia.`);
  } else if (groups.counted.length > 1) {
    parts.push(`${nameList(groups.counted)} ya cuentan. Si copias el costo de hoy, su margen estimado pasa a usarlo. El total guardado no cambia.`);
  }
  if (groups.collected.length === 1) {
    parts.push(`${groups.collected[0]} ya está cobrado. La utilidad pasa a usar el costo de hoy. No es un cobro nuevo. El total guardado no cambia.`);
  } else if (groups.collected.length > 1) {
    parts.push(`${nameList(groups.collected)} ya están cobrados. La utilidad pasa a usar el costo de hoy. No es un cobro nuevo. El total guardado no cambia.`);
  }
  if (groups.outside.length === 1) {
    parts.push(`${groups.outside[0]} sigue fuera de la cuenta. Copiar el costo no lo mete al margen ni a la utilidad.`);
  } else if (groups.outside.length > 1) {
    parts.push(`${nameList(groups.outside)} siguen fuera de la cuenta. Copiar el costo no los mete al margen ni a la utilidad.`);
  }
  return parts.join(" ");
}

export type SkuCostScope = "cuentan" | "fuera";

export function skuCostScope(status: OrderStatus | undefined): SkuCostScope | null {
  if (!status) return null;
  if (COST_COUNTED.includes(status)) return "cuentan";
  if (COST_OUTSIDE.includes(status)) return "fuera";
  return null;
}

export function accountHoldNote(status: OrderStatus) {
  if (status === "pendiente_confirmacion") return "Sigue pendiente: no entra al margen ni a la utilidad.";
  if (status === "cancelado") return "Está cancelado: no entra al margen ni a la utilidad.";
  if (status === "incidencia") return "Está en incidencia: no suma como venta confirmada mientras dure.";
  if (status === "devuelto") return "Está devuelto: el total guardado no entra a la utilidad.";
  return "";
}

export function catalogDriftText(
  products: Array<{ sku: string; title: string; price: number; cost: number; shipping: number; commissions: number }>,
  orders: Array<{
    number: string;
    status?: OrderStatus;
    collected?: boolean;
    lines: Array<Pick<OrderLine, "sku" | "unitPrice" | "unitCost" | "unitShipping" | "unitCommissions">>;
  }>,
) {
  const blocks: string[] = [];
  for (const product of products) {
    const drift = fichaDrift(storedSkuLines(orders, product.sku), {
      price: product.price,
      cost: product.cost,
      shipping: product.shipping,
      commissions: product.commissions,
    });
    const note = fichaDriftNote(drift, product.price);
    if (!note) continue;
    const numbers = [...new Set([...drift.priceNumbers, ...drift.costNumbers])];
    const plan = skuCostGroupNote(
      skuCostGroups(storedSkuLines(orders, product.sku), {
        cost: product.cost,
        shipping: product.shipping,
        commissions: product.commissions,
      }),
    );
    const preview = skuCostPreviewNote(orders, product.sku, {
      sku: product.sku,
      cost: product.cost,
      shipping: product.shipping,
      commissions: product.commissions,
    });
    blocks.push(
      product.title + " (" + product.sku + ")",
      note,
      ...(plan ? [plan] : []),
      ...(preview ? [preview] : []),
      numbers.length > 0 ? "Pedidos: " + numbers.join(", ") + "." : "",
    );
  }
  if (blocks.length === 0) return "";
  return [
    "Fichas con otro precio o costo guardado",
    "Copiar este texto no cobra, no reescribe los pedidos y no cambia el total guardado. Si el costo guardado es otro, la ficha tiene un botón para los que ya cuentan y otro para los que siguen fuera. Esta lista no lo guarda. Si aparece un margen, es el que quedaría en los que ya cuentan. El precio del pedido no cambia.",
    "Un pedido pendiente o cancelado no entra al margen ni a la utilidad. En incidencia no suma como venta confirmada. Devuelto, el total guardado no entra a la utilidad.",
    "",
    ...blocks,
    "",
    "Guardar la ficha no reescribe lo guardado. No es dinero cobrado.",
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function priceDriftNote(drifts: Array<{ title: string; stored: number; current: number }>) {
  if (drifts.length === 0) return "";
  if (drifts.length === 1) {
    const drift = drifts[0];
    return `La ficha de ${drift.title} hoy está en ${formatCop(drift.current)}. Este pedido guardó ${formatCop(drift.stored)}. Cambiar la ficha no reescribe el total guardado. No es dinero cobrado.`;
  }
  return `La ficha cambió en ${drifts.map((drift) => drift.title).join(", ")}. Este pedido conserva el precio guardado. Cambiar la ficha no reescribe el total guardado. No es dinero cobrado.`;
}

export function costDrift(order: Pick<StoreOrder, "lines">, guides: CostGuide[]) {
  const drifts: Array<{ sku: string; title: string; fields: Array<{ label: string; stored: number; current: number }> }> = [];
  for (const line of order.lines) {
    const guide = guides.find((item) => item.sku === line.sku);
    if (!readyCostGuide(guide)) continue;
    const fields: Array<{ label: string; stored: number; current: number }> = [];
    if (typeof line.unitCost === "number" && line.unitCost !== guide.cost) {
      fields.push({ label: "el costo", stored: line.unitCost, current: guide.cost });
    }
    if (typeof line.unitShipping === "number" && line.unitShipping !== guide.shipping) {
      fields.push({ label: "el envío estimado", stored: line.unitShipping, current: guide.shipping });
    }
    if (typeof line.unitCommissions === "number" && line.unitCommissions !== guide.commissions) {
      fields.push({ label: "las comisiones estimadas", stored: line.unitCommissions, current: guide.commissions });
    }
    if (fields.length === 0) continue;
    drifts.push({ sku: line.sku, title: line.title, fields });
  }
  return drifts;
}

export function costDriftNote(drifts: Array<{ title: string; fields: Array<{ label: string; stored: number; current: number }> }>) {
  if (drifts.length === 0) return "";
  const tail = "Cambiar la ficha no reescribe lo guardado. No es dinero cobrado. El total guardado no cambia.";
  if (drifts.length === 1) {
    const drift = drifts[0];
    const today = drift.fields.map((field) => `${field.label} en ${formatCop(field.current)}`).join(", ");
    const stored = drift.fields.map((field) => `${field.label} en ${formatCop(field.stored)}`).join(", ");
    return `La ficha de ${drift.title} hoy tiene ${today}. Este pedido guardó ${stored}. ${tail}`;
  }
  return `La ficha cambió el costo guardado en ${drifts.map((drift) => drift.title).join(", ")}. Este pedido conserva esas cifras. ${tail}`;
}

function resultEntries(orders: StoreOrder[], sku: string) {
  return orders
    .filter((order) => CONFIRMED.includes(order.status) || order.status === "devuelto")
    .flatMap((order) => order.lines.filter((line) => line.sku === sku).map((line) => ({ number: order.number, line })));
}

function driftingNumbers(entries: Array<{ number: string; line: OrderLine }>, differs: (line: OrderLine) => boolean) {
  const numbers: string[] = [];
  for (const entry of entries) {
    if (!differs(entry.line) || numbers.includes(entry.number)) continue;
    numbers.push(entry.number);
  }
  return numbers;
}

function orderPhrase(numbers: string[]) {
  if (numbers.length === 0) return "Estos pedidos";
  if (numbers.length === 1) return numbers[0];
  if (numbers.length === 2) return `${numbers[0]} y ${numbers[1]}`;
  return `${numbers.slice(0, -1).join(", ")} y ${numbers[numbers.length - 1]}`;
}

function storedAmounts(lines: OrderLine[], pick: (line: OrderLine) => number | undefined, current: number) {
  const values = new Set<number>();
  for (const line of lines) {
    const value = pick(line);
    if (typeof value === "number" && value !== current) values.add(value);
  }
  return [...values];
}

export function resultDriftNote(
  orders: StoreOrder[],
  sku: string,
  priceGuides: PriceGuide[] = [],
  costGuides: CostGuide[] = [],
) {
  const entries = resultEntries(orders, sku);
  const lines = entries.map((entry) => entry.line);
  if (lines.length === 0) return "";
  const parts: string[] = [];
  const price = priceGuides.find((guide) => guide.sku === sku);
  if (price) {
    const stored = storedAmounts(lines, (line) => line.unitPrice, price.price);
    const numbers = driftingNumbers(entries, (line) => line.unitPrice !== price.price);
    const who = `${orderPhrase(numbers)} ${numbers.length === 1 ? "guardó" : "guardaron"}`;
    if (stored.length === 1) {
      parts.push(
        `La ficha hoy está en ${formatCop(price.price)}. ${who} ${formatCop(stored[0])}. El margen estimado y la utilidad siguen con el precio guardado. Cambiar la ficha no los reescribe. No es dinero cobrado.`,
      );
    } else if (stored.length > 1) {
      parts.push(
        `La ficha hoy está en ${formatCop(price.price)}. ${who} precios distintos. El margen estimado y la utilidad siguen con el precio guardado. Cambiar la ficha no los reescribe. No es dinero cobrado.`,
      );
    }
  }
  const cost = costGuides.find((guide) => guide.sku === sku);
  if (readyCostGuide(cost)) {
    const fields = [
      { label: "el costo", current: cost.cost, stored: storedAmounts(lines, (line) => line.unitCost, cost.cost) },
      { label: "el envío estimado", current: cost.shipping, stored: storedAmounts(lines, (line) => line.unitShipping, cost.shipping) },
      { label: "las comisiones estimadas", current: cost.commissions, stored: storedAmounts(lines, (line) => line.unitCommissions, cost.commissions) },
    ].filter((field) => field.stored.length > 0);
    if (fields.length > 0) {
      const today = fields.map((field) => `${field.label} en ${formatCop(field.current)}`).join(", ");
      const stored = fields
        .map((field) => `${field.label} en ${field.stored.length === 1 ? formatCop(field.stored[0]) : "cifras distintas"}`)
        .join(", ");
      const numbers = driftingNumbers(
        entries,
        (line) =>
          (typeof line.unitCost === "number" && line.unitCost !== cost.cost) ||
          (typeof line.unitShipping === "number" && line.unitShipping !== cost.shipping) ||
          (typeof line.unitCommissions === "number" && line.unitCommissions !== cost.commissions),
      );
      const who = `${orderPhrase(numbers)} ${numbers.length === 1 ? "guardó" : "guardaron"}`;
      parts.push(
        `La ficha hoy tiene ${today}. ${who} ${stored}. El margen estimado y la utilidad siguen con lo guardado. Cambiar la ficha no los reescribe. No es dinero cobrado. El total guardado no cambia.`,
      );
    }
  }
  return parts.join(" ");
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

export const PENDING_PHONE_LIMIT = 3;

/** Siguiente P- libre. Usa el mayor número ya usado, no la cantidad de filas. */
export function nextOrderNumber(numbers: string[]) {
  let max = 2000;
  for (const raw of numbers) {
    const match = /^P-(\d{4,6})$/.exec(normalizeOrderNumber(raw));
    if (!match) continue;
    const value = Number(match[1]);
    if (value > max && value < 1_000_000) max = value;
  }
  const next = max + 1;
  if (next > 999_999) return null;
  return `P-${next}`;
}

export function pendingPhoneIsFull(orders: Array<{ status: OrderStatus; phone: string }>, phone: string) {
  const normalized = normalizePhone(phone);
  if (!/^3\d{9}$/.test(normalized)) return false;
  const pending = orders.filter((order) => order.status === "pendiente_confirmacion" && order.phone === normalized).length;
  return pending >= PENDING_PHONE_LIMIT;
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

const REPEAT_WINDOW_MS = 30 * 60 * 1000;

function samePlace(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

function lineKey(lines: Array<{ sku: string; quantity: number; variant?: string }>) {
  return lines
    .map((line) => `${line.sku.trim().toUpperCase()}|${(line.variant ?? "").trim().toLocaleLowerCase("es")}|${line.quantity}`)
    .sort()
    .join(";");
}

/** Mismo celular, dirección y productos, todavía pendiente y dejado en la última media hora. */
export function pendingCheckoutMatch(
  order: Pick<StoreOrder, "status" | "phone" | "city" | "address" | "department" | "lines" | "createdAt">,
  input: CheckoutInput,
  nowIso: string,
) {
  if (order.status !== "pendiente_confirmacion") return false;
  if (order.phone !== normalizePhone(input.phone)) return false;
  if (samePlace(order.city) !== samePlace(input.city)) return false;
  if (samePlace(order.department ?? "") !== samePlace(input.department)) return false;
  if (samePlace(order.address) !== samePlace(input.address)) return false;
  const incoming = lineKey(input.lines.map((line) => ({ sku: line.sku, quantity: line.quantity, variant: line.variant })));
  if (lineKey(order.lines) !== incoming) return false;
  const age = Date.parse(nowIso) - Date.parse(order.createdAt);
  return Number.isFinite(age) && age >= 0 && age <= REPEAT_WINDOW_MS;
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

function dateInSpan(iso: string, span: Period, today: string) {
  const todayMs = Date.parse(`${today}T00:00:00-05:00`);
  const ms = Date.parse(`${iso.slice(0, 10)}T00:00:00-05:00`);
  if (Number.isNaN(todayMs) || Number.isNaN(ms)) return false;
  const days = Math.round((todayMs - ms) / 86_400_000);
  const maxDays = span === "hoy" ? 0 : span === "7d" ? 6 : 29;
  return days >= 0 && days <= maxDays;
}

export function storeOrdersInPeriod(orders: StoreOrder[], period: Period, today = bogotaNow().slice(0, 10)) {
  return orders.filter((order) => dateInSpan(order.createdAt, period, today));
}

export function periodPhrase(period: Period) {
  if (period === "hoy") return "hoy";
  if (period === "7d") return "los últimos 7 días";
  return "los últimos 30 días";
}

export type OrderSpan = Period | "todo";
export type CloseBasis = "creados" | "movidos";

export function orderTouchedInSpan(
  order: Pick<StoreOrder, "createdAt" | "history">,
  span: OrderSpan,
  today = bogotaNow().slice(0, 10),
) {
  if (span === "todo") return true;
  if (dateInSpan(order.createdAt, span, today)) return true;
  return (order.history ?? []).some((event) => dateInSpan(event.at, span, today));
}

export function ordersInSpan(
  orders: StoreOrder[],
  span: OrderSpan,
  today = bogotaNow().slice(0, 10),
  basis: CloseBasis = "creados",
) {
  if (span === "todo") return orders;
  if (basis === "movidos") return orders.filter((order) => orderTouchedInSpan(order, span, today));
  return storeOrdersInPeriod(orders, span, today);
}

export function spanPhrase(span: OrderSpan) {
  if (span === "todo") return "todos los pedidos";
  return periodPhrase(span);
}

export function closePhrase(period: Period, basis: CloseBasis = "creados") {
  const when = periodPhrase(period);
  if (basis === "movidos") return `movimientos de ${when}`;
  return when === "hoy" ? "pedidos creados hoy" : `pedidos creados en ${when}`;
}

export function closeSpanPhrase(span: OrderSpan, basis: CloseBasis = "creados") {
  if (span === "todo") return "todos los pedidos";
  return closePhrase(span, basis);
}

const DISPATCH_SHEET: OrderStatus[] = ["confirmado", "en_preparacion", "en_transporte"];

export function dispatchSheetOrders(orders: StoreOrder[]) {
  return orders
    .filter((order) => DISPATCH_SHEET.includes(order.status))
    .sort((left, right) => right.number.localeCompare(left.number, "es"));
}

export function dispatchSheetText(orders: StoreOrder[]) {
  const rows = dispatchSheetOrders(orders);
  if (rows.length === 0) return "";
  return rows.map((order) => dropiHandoffText(order)).join("\n\n---\n\n");
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

function orderCountPhrase(count: number) {
  return count === 1 ? "1 pedido" : `${count} pedidos`;
}

function listedNumbers(numbers: string[]) {
  return numbers.length > 0 ? ` ${numbers.join(", ")}.` : "";
}

export function closeSheetText(
  orders: StoreOrder[],
  span: OrderSpan,
  basis: CloseBasis = "creados",
  guides: SizeGuide[] = [],
  priceGuides: PriceGuide[] = [],
  costGuides: CostGuide[] = [],
) {
  const summary = summarizeStoreOrders(orders);
  const products = resultsByProduct(orders, guides);
  const lines = [
    `Cierre · ${closeSpanPhrase(span, basis)}`,
    "Copiar este texto no cobra ni cambia pedidos. Dropi no está conectado: desde aquí no se crea el pedido.",
  ];
  if (span !== "todo" && basis === "movidos") lines.push("El total guardado es el del pedido, no lo cobrado en ese día.");
  const holdSeen = new Set<string>();
  const driftLine = (order: StoreOrder, note: string) => {
    const hold = accountHoldNote(order.status);
    const extra = hold && !holdSeen.has(order.number) ? ` ${hold}` : "";
    if (extra) holdSeen.add(order.number);
    return `${order.number}. ${note}${extra}`;
  };
  const drifted = orders.flatMap((order) => {
    const note = priceDriftNote(priceDrift(order, priceGuides));
    return note ? [driftLine(order, note)] : [];
  });
  if (drifted.length > 0) {
    lines.push(
      "En estos pedidos la ficha de hoy no es el precio guardado. El cierre sigue con el total guardado. Cambiar la ficha no lo reescribe. No es dinero cobrado.",
      ...drifted,
    );
  }
  const costDrifted = orders.flatMap((order) => {
    const note = costDriftNote(costDrift(order, costGuides));
    return note ? [driftLine(order, note)] : [];
  });
  if (costDrifted.length > 0) {
    lines.push(
      "En estos pedidos la ficha de hoy no es el costo guardado. El cierre sigue con el costo guardado y el total guardado. Cambiar la ficha no los reescribe. No es dinero cobrado.",
      ...costDrifted,
    );
  }
  lines.push(
    "",
    `Registrados: ${formatCop(summary.registered.amount)} · ${orderCountPhrase(summary.registered.count)}.${listedNumbers(summary.registered.numbers)} Total guardado. Sin cancelados ni devueltos. No es dinero cobrado.`,
    `Confirmados: ${formatCop(summary.confirmed.amount)} · ${orderCountPhrase(summary.confirmed.count)}.${listedNumbers(summary.confirmed.numbers)} Total guardado. Ya confirmados. No es dinero cobrado.`,
    `Entregados: ${formatCop(summary.delivered.amount)} · ${orderCountPhrase(summary.delivered.count)}.${listedNumbers(summary.delivered.numbers)} Total guardado. Estado entregado. No es dinero cobrado.`,
    `Cobrados: ${formatCop(summary.collected.amount)} · ${orderCountPhrase(summary.collected.count)}.${listedNumbers(summary.collected.numbers)} Total guardado de los marcados como cobrados. No es un cobro de este sitio ni la utilidad.`,
    "",
    `Margen estimado: ${formatCop(summary.estimatedMargin.amount)}.${listedNumbers(summary.estimatedMargin.numbers)} Margen de confirmados. No es dinero cobrado ni el total guardado.`,
  );
  if (summary.estimatedMargin.missingNumbers.length > 0) {
    lines.push(`Sin costo, no entra al margen estimado:${listedNumbers(summary.estimatedMargin.missingNumbers)}`);
  }
  lines.push(
    `Utilidad realizada: ${formatCop(summary.realized.amount)}.${listedNumbers(summary.realized.numbers)} Utilidad de pedidos entregados y marcados como cobrados. No es un cobro de este sitio ni el total guardado.`,
  );
  if (summary.realized.missingNumbers.length > 0) {
    lines.push(`Cobrado sin costo, no entra a la utilidad:${listedNumbers(summary.realized.missingNumbers)}`);
  }
  if (summary.returnFreight > 0) {
    lines.push(`Flete de devolución: ${formatCop(summary.returnFreight)}.${listedNumbers(summary.returnFreightNumbers)} Resta de la utilidad.`);
  }
  if (summary.collectionCost > 0) {
    lines.push(`Recaudo real: ${formatCop(summary.collectionCost)}.${listedNumbers(summary.collectionCostNumbers)} No es el total guardado.`);
  }
  lines.push(
    `Devueltos: ${formatCop(summary.returned.amount)} · ${orderCountPhrase(summary.returned.count)}.${listedNumbers(summary.returned.numbers)} Total guardado. No entra a la utilidad.`,
    "",
    "Por producto",
  );
  if (products.length === 0) {
    lines.push(span === "todo" ? "No hay pedidos confirmados ni devueltos." : "En este período no hay pedidos confirmados ni devueltos.");
  } else {
    if (products.some((row) => resultDriftNote(orders, row.sku, priceGuides, costGuides))) {
      lines.push("Si la ficha de hoy no es el precio o el costo guardado, va bajo ese producto. El margen y la utilidad siguen con lo guardado.");
    }
    for (const row of products) {
      const sources = row.sources.map((source) => `${source.number} ${STATUS_LABEL[source.status]}`).join(", ");
      const estimated =
        row.confirmedUnits > 0
          ? `${formatCop(row.estimatedMargin)} · ${row.confirmedUnits === 1 ? "1 unidad confirmada" : `${row.confirmedUnits} unidades confirmadas`} · total guardado ${formatCop(row.confirmedAmount)}`
          : "sin unidades confirmadas";
      const realized =
        row.realizedUnits > 0 && row.realizedMissingUnits === row.realizedUnits
          ? "sin costo, no entra"
          : row.realizedUnits > 0
            ? `${formatCop(row.realizedMargin)} · ${row.realizedUnits === 1 ? "1 unidad entregada y cobrada" : `${row.realizedUnits} unidades entregadas y cobradas`}`
            : "todavía no entra";
      const returned =
        row.returnFreight > 0
          ? `${formatCop(row.returnedAmount)} · total guardado · flete de devolución ${formatCop(row.returnFreight)} resta de la utilidad`
          : `${formatCop(row.returnedAmount)} · total guardado · no entra a la utilidad`;
      const drift = resultDriftNote(orders, row.sku, priceGuides, costGuides);
      const guide = costGuides.find((item) => item.sku === row.sku);
      const preview = guide ? skuCostPreviewNote(orders, row.sku, guide, span === "todo" ? "" : "este período") : "";
      lines.push(
        `${row.title} (${row.sku})`,
        sources ? `Pedidos: ${sources}.` : "Sin pedidos en la cuenta.",
        `Margen estimado: ${estimated}. No es dinero cobrado.`,
        `Utilidad realizada: ${realized}. No es el total guardado.`,
        `Devuelto: ${returned}.`,
        ...(drift ? [drift] : []),
        ...(preview ? [preview] : []),
        "",
      );
    }
  }
  lines.push("Copiar no cobra. El total guardado no cambia.");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export type AttentionRow = {
  order: StoreOrder;
  note: string;
  also: string[];
  cta: string;
};

const OWNER_MONEY_QUEUE = new Set(["cola-cobro", "cola-flete-devolucion", "cola-costo", "cola-costo-hoy"]);

export function attentionQueueIsOwnerMoney(id: string) {
  return OWNER_MONEY_QUEUE.has(id);
}

export function attentionQueues(
  orders: StoreOrder[],
  guides: SizeGuide[] = [],
  canManageOrderMoney = true,
  costGuides: CostGuide[] = [],
) {
  const defs: Array<{
    id: string;
    title: string;
    hint: string;
    short: string;
    cta: string;
    match: (order: StoreOrder) => boolean;
    note: (order: StoreOrder) => string;
  }> = [
    {
      id: "cola-confirmar",
      title: "Se pueden confirmar",
      hint: "Pendientes listos para confirmar. Puede faltar departamento o costo; no bloquean la confirmación. El total guardado no cambia.",
      short: "confirmar",
      cta: "Confirmar",
      match: (order) => readyToConfirm(order, guides),
      note: (order) => confirmQueueNote(order, guides) || "Listo para confirmar.",
    },
    {
      id: "cola-talla",
      title: "Falta la talla o el tamaño",
      hint: "Pendientes que no se confirman hasta anotar la talla o el tamaño. El total guardado no cambia.",
      short: "talla",
      cta: "Anotar talla",
      match: (order) => needsSize(order, guides),
      note: (order) => missingSizeQueueNote(order, guides),
    },
    {
      id: "cola-departamento",
      title: "Falta el departamento",
      hint: "Pedidos que todavía se pueden corregir y no tienen departamento. El total guardado no cambia.",
      short: "departamento",
      cta: "Anotar departamento",
      match: needsDepartment,
      note: () => "Falta el departamento. El total guardado no cambia.",
    },
    {
      id: "cola-departamento-cerrado",
      title: "Falta el departamento y la entrega ya no se corrige",
      hint: "Están en transporte, entregados o devueltos. Anotar el departamento no cambia el estado ni el cobro. El total guardado no cambia.",
      short: "departamento cerrado",
      cta: "Anotar departamento",
      match: needsClosedDepartment,
      note: () => "Falta el departamento. La entrega ya no se corrige. El total guardado no cambia.",
    },
    {
      id: "cola-preparacion",
      title: "Listos para preparación",
      hint: "Confirmados con número de Dropi anotado. Pasarlos a preparación no los envía. El total guardado no cambia.",
      short: "preparación",
      cta: "Preparar",
      match: readyToPrepare,
      note: (order) => prepareQueueNote(order),
    },
    {
      id: "cola-despacho",
      title: "Por anotar despacho",
      hint: "Pedidos en preparación. El despacho se anota a mano. El total guardado no cambia.",
      short: "despacho",
      cta: "Anotar despacho",
      match: readyToDispatch,
      note: (order) => dispatchQueueNote(order),
    },
    {
      id: "cola-entrega",
      title: "Por marcar entregado",
      hint: "Están en transporte. Marcarlos no cobra y el recaudo sigue pendiente. El total guardado no cambia.",
      short: "entregado",
      cta: "Marcar entregado",
      match: readyToDeliver,
      note: () => "Está en transporte. Marcarlo como entregado no cobra. El recaudo sigue pendiente. El total guardado no cambia.",
    },
    {
      id: "cola-numero-dropi",
      title: "Falta el número de Dropi",
      hint: "En un confirmado, sin número no pasa a preparación. Anotarlo no lo envía ni crea el pedido. El total guardado no cambia.",
      short: "número Dropi",
      cta: "Anotar número",
      match: awaitsDropiNumber,
      note: (order) =>
        order.status === "confirmado"
          ? "Sin el número de Dropi no pasa a preparación. Anotarlo no lo envía ni crea el pedido. El total guardado no cambia."
          : "Falta el número de Dropi. Anotarlo no lo envía ni crea el pedido. El total guardado no cambia.",
    },
    {
      id: "cola-motivo",
      title: "Falta el motivo de la incidencia",
      hint: "Sin motivo no se resuelve. El cliente ve que se detuvo, sin la causa. El total guardado no cambia.",
      short: "motivo incidencia",
      cta: "Anotar motivo",
      match: needsIncidenceReason,
      note: () => "Falta el motivo. El cliente no ve la causa. Sin él no se resuelve. El total guardado no cambia.",
    },
    {
      id: "cola-resolver",
      title: "Lista para resolver la incidencia",
      hint: "Ya tiene motivo. Resolverla la deja confirmada. No la envía a Dropi. El total guardado no cambia.",
      short: "resolver",
      cta: "Resolver",
      match: readyToResolve,
      note: () => "Ya tiene motivo. Resolverla la deja confirmada. No la envía a Dropi. El total guardado no cambia.",
    },
    {
      id: "cola-devolucion",
      title: "Falta el motivo de la devolución",
      hint: "El cliente ve la devolución sin la causa. Anotarla no cambia el estado. El total guardado no cambia.",
      short: "motivo devolución",
      cta: "Anotar motivo",
      match: needsReturnReason,
      note: () => "Falta el motivo. El cliente no ve la causa. El total guardado no cambia.",
    },
    {
      id: "cola-cobro",
      title: "Falta anotar el recaudo",
      hint: canManageOrderMoney
        ? "Entregados sin la marca de cobro. Marcarla no es un cobro de este sitio. El total guardado no cambia."
        : "Entregados sin la marca de cobro. La marca la guarda el propietario. El total guardado no cambia.",
      short: "recaudo",
      cta: canManageOrderMoney ? "Marcar cobrado" : "Ver pedido",
      match: readyToCollect,
      note: () =>
        canManageOrderMoney
          ? "Está entregado y el recaudo no está anotado. Marcarlo no es un cobro de este sitio. El total guardado no cambia."
          : "Está entregado y el recaudo no está anotado. Lo marca el propietario. El total guardado no cambia.",
    },
    {
      id: "cola-flete-devolucion",
      title: "Falta anotar el flete de la devolución",
      hint: canManageOrderMoney
        ? "Vacío no resta. Si no hubo flete, anota 0; si lo hubo, anótalo. El total guardado no cambia."
        : "Vacío no resta. Lo anota el propietario. El total guardado no cambia.",
      short: "flete devolución",
      cta: canManageOrderMoney ? "Anotar flete" : "Ver pedido",
      match: needsReturnFreight,
      note: () =>
        canManageOrderMoney
          ? "El flete no está anotado. Vacío no resta. El total guardado no cambia."
          : "El flete no está anotado. Lo anota el propietario. El total guardado no cambia.",
    },
    {
      id: "cola-costo",
      title: "Sin costo en el pedido",
      hint: canManageOrderMoney
        ? "Sin costo, envío o comisiones de la ficha. Si ya está cobrado, falta para la utilidad realizada. Copiarlas no cambia el total guardado."
        : "Sin costo, envío o comisiones de la ficha. Lo copia el propietario. El total guardado no cambia.",
      short: "costo",
      cta: canManageOrderMoney ? "Copiar costo" : "Ver pedido",
      match: needsCatalogCost,
      note: (order) =>
        canManageOrderMoney ? costQueueWarning(order) : "Falta el costo en el pedido. Lo copia el propietario. El total guardado no cambia.",
    },
    {
      id: "cola-costo-hoy",
      title: "La ficha de hoy tiene otro costo",
      hint: canManageOrderMoney
        ? "El pedido conserva el costo guardado. El botón del pedido copia las cifras de hoy. No cambia el precio ni el total guardado."
        : "El pedido conserva el costo guardado. Lo copia el propietario. No cambia el precio ni el total guardado.",
      short: "costo de hoy",
      cta: canManageOrderMoney ? "Usar las cifras de hoy" : "Ver pedido",
      match: (order) => costDrift(order, costGuides).length > 0,
      note: (order) => {
        const detail = costDriftNote(costDrift(order, costGuides));
        return canManageOrderMoney
          ? `${detail} El botón del pedido copia esas cifras. Esta lista no las guarda.`
          : `${detail} Lo copia el propietario.`;
      },
    },
    {
      id: "cola-aviso",
      title: "Falta avisarle al cliente",
      hint: "El estado ya cambió y todavía no marcaste que le avisaste. Esa marca no envía el mensaje. El total guardado no cambia.",
      short: "aviso al cliente",
      cta: "Marcar aviso",
      match: needsCustomerNotice,
      note: () => "Falta avisarle. El mensaje está en la ficha. El total guardado no cambia.",
    },
    {
      id: "cola-numero-cerrado",
      title: "Falta el número en un pedido ya cerrado",
      hint: "Incidencia, entregado o devuelto. Anotarlo no resuelve, no crea otro pedido y no lo envía. El total guardado no cambia.",
      short: "número Dropi",
      cta: "Anotar número",
      match: needsLateDropiNumber,
      note: () => "Falta el número de Dropi. Anotarlo no crea otro pedido ni lo envía. El total guardado no cambia.",
    },
  ];

  const claimed = new Set<string>();
  const ordered = canManageOrderMoney
    ? defs
    : [
        ...defs.filter((def) => !attentionQueueIsOwnerMoney(def.id)),
        ...defs.filter((def) => attentionQueueIsOwnerMoney(def.id)),
      ];
  return ordered
    .map((def) => {
      const rows: AttentionRow[] = [];
      for (const order of orders) {
        if (!def.match(order) || claimed.has(order.id)) continue;
        claimed.add(order.id);
        const also = defs.filter((other) => other.id !== def.id && other.match(order)).map((other) => other.short);
        rows.push({ order, note: def.note(order), also, cta: def.cta });
      }
      return { id: def.id, title: def.title, hint: def.hint, rows };
    })
    .filter((queue) => queue.rows.length > 0);
}

export function attentionSheetText(
  orders: StoreOrder[],
  guides: SizeGuide[] = [],
  canManageOrderMoney = true,
  priceGuides: PriceGuide[] = [],
  costGuides: CostGuide[] = [],
) {
  const queues = attentionQueues(orders, guides, canManageOrderMoney, costGuides);
  const lines = [
    "Por atender · un pedido, un siguiente paso",
    "Esta lista no se recorta por fecha. Copiarla no cobra, no envía el mensaje y no cambia pedidos. Dropi no está conectado: desde aquí no se crea el pedido.",
  ];
  if (queues.some((queue) => queue.rows.some((row) => row.cta === "Marcar aviso"))) {
    lines.push("Si el paso es avisar, el mensaje va en ese pedido. Copiarlo no lo envía.");
  }
  if (queues.some((queue) => queue.rows.some((row) => row.cta === "Anotar número" || row.cta === "Anotar despacho"))) {
    lines.push("Si el paso es anotar el número o el despacho, va el texto para Dropi, con celular y dirección. Copiarlo no crea el pedido.");
  }
  if (queues.some((queue) => queue.rows.some((row) => priceDrift(row.order, priceGuides).length > 0))) {
    lines.push("Si la ficha de hoy no es el precio guardado, van los dos montos en ese pedido. Copiarlos no reescribe el total.");
  }
  if (queues.some((queue) => queue.rows.some((row) => costDrift(row.order, costGuides).length > 0))) {
    lines.push("Si la ficha de hoy no es el costo guardado, van las dos cifras en ese pedido. Copiarlas no reescribe lo guardado ni el total.");
  }
  if (queues.some((queue) => queue.rows.some((row) => row.cta === "Usar las cifras de hoy"))) {
    lines.push("Si el paso es usar las cifras de hoy, esta lista no las guarda. El precio y el total guardado no cambian.");
  }
  lines.push("");
  if (queues.length === 0) {
    lines.push("No hay pedidos esperando un dato o una acción.");
  } else {
    for (const queue of queues) {
      lines.push(`${queue.title} (${queue.rows.length})`);
      for (const row of queue.rows) {
        const place = [row.order.city, row.order.department].filter(Boolean).join(" · ");
        lines.push(`${row.order.number} · ${row.order.customerName}${place ? ` · ${place}` : ""}`);
        lines.push(row.note);
        if (row.also.length > 0) lines.push(`También: ${row.also.join(", ")}.`);
        lines.push(`Siguiente paso: ${row.cta}.`);
        if (row.cta === "Marcar aviso") {
          lines.push("Mensaje para copiar. Copiarlo no lo envía:");
          lines.push(customerMessage(row.order));
        }
        if (row.cta === "Anotar número" || row.cta === "Anotar despacho") {
          lines.push("Texto para Dropi. Copiarlo no crea el pedido:");
          lines.push(dropiHandoffText(row.order));
        }
        const drift = priceDriftNote(priceDrift(row.order, priceGuides));
        if (drift) lines.push(drift);
        const costNote = costDriftNote(costDrift(row.order, costGuides));
        if (costNote) lines.push(costNote);
        if ((drift || costNote) && accountHoldNote(row.order.status)) lines.push(accountHoldNote(row.order.status));
      }
      lines.push("");
    }
  }
  lines.push("Copiar no cobra. El total guardado no cambia. No envía el mensaje.");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const RESULT_PERIODS: Period[] = ["hoy", "7d", "30d"];

export function widerPeriodWithResults(
  orders: StoreOrder[],
  period: Period,
  guides: SizeGuide[] = [],
  today = bogotaNow().slice(0, 10),
  basis: CloseBasis = "creados",
) {
  const start = RESULT_PERIODS.indexOf(period);
  for (const candidate of RESULT_PERIODS.slice(start + 1)) {
    if (resultsByProduct(ordersInSpan(orders, candidate, today, basis), guides).length > 0) return candidate;
  }
  return null;
}

const ACTIONS: ActionSpec[] = [
  {
    id: "confirmar",
    label: "Confirmar pedido",
    tone: "primary",
    summary: "Confirmó el pedido. El total guardado no cambió. Nadie cobra en el sitio. Dropi no está conectado: no se envió.",
    status: "confirmado",
  },
  {
    id: "preparar",
    label: "Pasar a preparación",
    tone: "primary",
    summary: "Pasó el pedido a preparación. El total guardado no cambió. Nadie cobra en el sitio.",
    status: "en_preparacion",
  },
  {
    id: "despachar",
    label: "Anotar despacho",
    tone: "primary",
    summary: "Anotó el despacho a mano. El total guardado no cambió. Nadie cobra en el sitio. Dropi no está conectado: sin guía.",
    status: "en_transporte",
  },
  {
    id: "entregar",
    label: "Marcar entregado",
    tone: "primary",
    summary: "Marcó el pedido como entregado. El total guardado no cambió. El recaudo sigue pendiente. No es utilidad realizada. Nadie cobra en el sitio.",
    status: "entregado",
  },
  {
    id: "cobrar",
    label: "Marcar cobrado",
    tone: "primary",
    summary: "Marcó el recaudo contra entrega. El total guardado no cambió. No es dinero cobrado.",
    collected: true,
  },
  {
    id: "quitar_cobro",
    label: "Quitar el cobro",
    tone: "quiet",
    summary: "Quitó el recaudo contra entrega. El total guardado no cambió. No es dinero cobrado.",
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
    summary: "Resolvió la incidencia y lo dejó confirmado. El total guardado no cambió. Nadie cobra en el sitio.",
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

export function readyToDeliver(order: { status: OrderStatus }) {
  return order.status === "en_transporte";
}

export function readyToCollect(order: { status: OrderStatus; collected: boolean }) {
  return order.status === "entregado" && !order.collected;
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

export function readyToResolve(order: { status: OrderStatus; customerReason?: string }) {
  return order.status === "incidencia" && !resolveIncidenceError(order);
}

export function needsLateDropiNumber(order: { status: OrderStatus; providerRef?: string }) {
  if (awaitsDropiNumber(order)) return false;
  return needsIncidenceDropiNumber(order) || needsClosedDropiNumber(order);
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
    return "Ya no se paga al recibir. Nadie cobra en la tienda. El total guardado no cambió. ";
  }
  if (status === "entregado") {
    return collected
      ? "La tienda anotó el cobro contra entrega. Nadie lo cobró en esta tienda. El total guardado no cambió. "
      : "El cobro contra entrega todavía no está anotado. Nadie cobra en la tienda. El total guardado no cambió. ";
  }
  if (status === "incidencia") {
    return "Mientras dure, no se paga al recibir. Si continúa, pagas al recibir. Nadie cobra en la tienda. El total guardado no cambió. ";
  }
  if (
    status === "pendiente_confirmacion" ||
    status === "confirmado" ||
    status === "en_preparacion" ||
    status === "en_transporte"
  ) {
    return "Pagas al recibir. Nadie cobra en la tienda. El total guardado no cambió. ";
  }
  return "Pagas al recibir. Nadie cobra en la tienda. ";
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

export function ownerOnlyOrderIntent(action: string) {
  return action === "cobrar" || action === "quitar_cobro";
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
      return "No hay guía ni fecha. Pagas al recibir. Nadie cobra en la tienda. El total guardado no cambió. Dropi no está conectado.";
    case "confirmado":
    case "en_preparacion":
      return "Dropi no está conectado. Todavía no hay guía ni fecha. El despacho se anota a mano. El total guardado no cambió. Pagas al recibir. Nadie cobra en la tienda.";
    case "en_transporte":
      return "Dropi no está conectado. Sin guía ni una fecha exacta de llegada. El total guardado no cambió. Pagas al recibir. Nadie cobra en la tienda.";
    case "entregado":
      return collected
        ? "La tienda anotó el cobro contra entrega. Nadie lo cobró en esta tienda. El total guardado no cambió. Dropi no está conectado: sin guía."
        : "El cobro contra entrega todavía no está anotado. Nadie cobra en la tienda. El total guardado no cambió. Dropi no está conectado: sin guía.";
    default:
      return "";
  }
}

export function customerStatusNote(status: OrderStatus, reason = "", byCustomer = false, collected = false) {
  const spoken = reason.trim().replace(/\s+/g, " ");
  const detail = spoken ? ( /[.!?]$/.test(spoken) ? spoken : `${spoken}.`) : "";
  switch (status) {
    case "pendiente_confirmacion":
      return "Quedó pendiente de confirmación. La tienda revisará la dirección antes de despachar. No hay guía ni fecha de entrega: Dropi no está conectado. El total guardado no cambió. Pagas al recibir. Nadie cobra en la tienda. Si ya no lo quieres, cancélalo al consultar el pedido.";
    case "confirmado":
      return "La tienda confirmó el pedido. Dropi no está conectado. Todavía no hay guía ni fecha de entrega. El despacho se anota a mano. El total guardado no cambió. Pagas al recibir. Nadie cobra en la tienda.";
    case "en_preparacion":
      return "La tienda está preparando el pedido. Dropi no está conectado. Todavía no hay guía ni fecha de entrega. El total guardado no cambió. Pagas al recibir. Nadie cobra en la tienda.";
    case "en_transporte":
      return "La tienda anotó el despacho. Dropi no está conectado. Sin guía ni una fecha exacta de llegada. El total guardado no cambió. Pagas al recibir. Nadie cobra en la tienda.";
    case "entregado":
      return collected
        ? "La tienda marcó el pedido como entregado y anotó el cobro contra entrega. Nadie lo cobró en esta tienda. El total guardado no cambió. Dropi no está conectado: sin guía."
        : "La tienda marcó el pedido como entregado. El cobro contra entrega todavía no está anotado. Nadie cobra en la tienda. El total guardado no cambió. Dropi no está conectado: sin guía.";
    case "incidencia":
      return detail
        ? `La tienda marcó una incidencia: ${detail} El pedido no sigue su curso hasta que lo resuelva. Mientras dure, no se paga al recibir. Nadie cobra en la tienda. El total guardado no cambió.`
        : "La tienda marcó una incidencia. El pedido no sigue su curso hasta que lo resuelva. Mientras dure, no se paga al recibir. Nadie cobra en la tienda. El total guardado no cambió.";
    case "cancelado":
      if (byCustomer) {
        return detail
          ? `Cancelaste este pedido: ${detail} No se va a despachar. Ya no se paga al recibir. Nadie cobra en la tienda. El total guardado no cambió.`
          : "Cancelaste este pedido. No se va a despachar. Ya no se paga al recibir. Nadie cobra en la tienda. El total guardado no cambió.";
      }
      return detail
        ? `La tienda canceló este pedido: ${detail} No se va a despachar. Ya no se paga al recibir. Nadie cobra en la tienda. El total guardado no cambió.`
        : "La tienda canceló este pedido. No se va a despachar. Ya no se paga al recibir. Nadie cobra en la tienda. El total guardado no cambió.";
    case "devuelto":
      return detail
        ? `La tienda registró la devolución de este pedido: ${detail} Ya no se paga al recibir. Nadie cobra en la tienda. El total guardado no cambió.`
        : "La tienda registró la devolución de este pedido. Ya no se paga al recibir. Nadie cobra en la tienda. El total guardado no cambió.";
    default:
      return "La tienda está revisando este pedido. Dropi no está conectado. No hay guía ni fecha de entrega. Nadie cobra en la tienda.";
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
