import { productMargin, publicationLabel, type CatalogProduct } from "@/lib/catalog";
import { orderRealizedMargin, type OrderLine, type StoreOrder } from "@/lib/store-order";

export type BackupProduct = Pick<
  CatalogProduct,
  "sku" | "title" | "price" | "cost" | "shipping" | "commissions" | "published" | "available" | "externalRef"
>;

function cell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (/[",\n\r]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}

function csv(headers: string[], rows: Array<Array<string | number | null>>) {
  const lines = [headers.join(","), ...rows.map((row) => row.map((value) => cell(value)).join(","))];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function lineLabel(line: OrderLine) {
  const size = line.variant?.trim() ? `, ${line.variant.trim()}` : "";
  return `${line.quantity} x ${line.title} (${line.sku}${size})`;
}

export function ordersToBackupCsv(orders: StoreOrder[]) {
  const rows = [...orders].sort((left, right) => right.number.localeCompare(left.number, "es"));
  return csv(
    [
      "pedido",
      "estado",
      "cobrado",
      "creado",
      "cliente",
      "celular",
      "cedula",
      "departamento",
      "ciudad",
      "direccion",
      "referencia",
      "productos",
      "total_guardado",
      "flete_anotado",
      "flete_de_devolucion",
      "costo_de_recaudo",
      "utilidad_realizada",
      "numero_anotado",
      "nota_interna",
    ],
    rows.map((order) => {
      const realized = orderRealizedMargin(order);
      return [
        order.number,
        order.status,
        order.collected ? "si" : "no",
        order.createdAt,
        order.customerName,
        order.phone,
        order.document ?? "",
        order.department ?? "",
        order.city,
        order.address,
        order.reference,
        order.lines.map(lineLabel).join("; "),
        order.total,
        order.actualShipping ?? "",
        order.status === "devuelto" && typeof order.returnFreight === "number" ? order.returnFreight : "",
        order.collectionCost ?? "",
        realized ?? "",
        order.providerRef ?? "",
        order.internalNote ?? "",
      ];
    }),
  );
}

export function catalogToBackupCsv(products: BackupProduct[]) {
  const rows = [...products].sort((left, right) => left.sku.localeCompare(right.sku, "es"));
  return csv(
    ["sku", "titulo", "precio_publicado", "costo", "envio_estimado", "comisiones", "margen_estimado", "publicacion", "referencia_externa"],
    rows.map((product) => [
      product.sku,
      product.title,
      product.price,
      product.cost,
      product.shipping,
      product.commissions,
      productMargin(product),
      publicationLabel(product),
      product.externalRef,
    ]),
  );
}
