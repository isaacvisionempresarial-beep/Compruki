import { productMargin, type CatalogProduct } from "@/lib/catalog";
import { listProducts } from "@/server/catalog-store";
import { listOrders } from "@/server/order-store";

export type MarginBreakdown = {
  sku: string;
  title: string;
  price: number;
  cost: number;
  shipping: number;
  commissions: number;
  margin: number;
  marginRate: number | null;
  published: boolean;
  available: boolean;
};

export type PriceScenario = {
  label: string;
  price: number;
  margin: number;
  marginRate: number | null;
};

export type ProductScenarios = {
  sku: string;
  title: string;
  base: MarginBreakdown;
  scenarios: PriceScenario[];
};

export type OrderFinancials = {
  orderCount: number;
  lineCount: number;
  revenue: number;
  estimatedCost: number;
  estimatedShipping: number;
  estimatedCommissions: number;
  estimatedMargin: number;
  missingCostLines: number;
};

function rate(margin: number, price: number) {
  if (price <= 0) return null;
  return margin / price;
}

function breakdown(product: CatalogProduct): MarginBreakdown {
  const margin = productMargin(product);
  return {
    sku: product.sku,
    title: product.title,
    price: product.price,
    cost: product.cost,
    shipping: product.shipping,
    commissions: product.commissions,
    margin,
    marginRate: rate(margin, product.price),
    published: product.published,
    available: product.available,
  };
}

/** AG-04 · calculate_margin — solo cifras del catálogo. */
export async function calculateMargin(sku?: string): Promise<MarginBreakdown[]> {
  const products = await listProducts();
  const rows = products.map(breakdown);
  if (!sku) return rows;
  const needle = sku.trim().toUpperCase();
  return rows.filter((row) => row.sku === needle);
}

/** AG-04 · compare_price_scenarios — ±10 % sobre el precio actual. */
export async function comparePriceScenarios(sku?: string): Promise<ProductScenarios[]> {
  const products = await listProducts();
  const selected = sku ? products.filter((product) => product.sku === sku.trim().toUpperCase()) : products;

  return selected.map((product) => {
    const base = breakdown(product);
    const down = Math.max(0, Math.round(product.price * 0.9));
    const up = Math.round(product.price * 1.1);
    const at = (price: number, label: string): PriceScenario => {
      const margin = price - product.cost - product.shipping - product.commissions;
      return { label, price, margin, marginRate: rate(margin, price) };
    };
    return {
      sku: product.sku,
      title: product.title,
      base,
      scenarios: [at(down, "Precio −10 %"), at(product.price, "Precio actual"), at(up, "Precio +10 %")],
    };
  });
}

/** AG-04 · get_order_financials — estimado a partir de líneas con costo. */
export async function getOrderFinancials(): Promise<OrderFinancials> {
  const orders = await listOrders();
  let lineCount = 0;
  let revenue = 0;
  let estimatedCost = 0;
  let estimatedShipping = 0;
  let estimatedCommissions = 0;
  let missingCostLines = 0;

  for (const order of orders) {
    for (const line of order.lines) {
      lineCount += 1;
      revenue += line.unitPrice * line.quantity;
      if (typeof line.unitCost === "number") {
        estimatedCost += line.unitCost * line.quantity;
        estimatedShipping += (line.unitShipping ?? 0) * line.quantity;
        estimatedCommissions += (line.unitCommissions ?? 0) * line.quantity;
      } else {
        missingCostLines += 1;
      }
    }
  }

  const estimatedMargin = revenue - estimatedCost - estimatedShipping - estimatedCommissions;
  return {
    orderCount: orders.length,
    lineCount,
    revenue,
    estimatedCost,
    estimatedShipping,
    estimatedCommissions,
    estimatedMargin,
    missingCostLines,
  };
}

export async function getAnalystToolkit() {
  const [margins, scenarios, orders] = await Promise.all([
    calculateMargin(),
    comparePriceScenarios(),
    getOrderFinancials(),
  ]);
  return { margins, scenarios, orders };
}

export type AnalystToolkit = Awaited<ReturnType<typeof getAnalystToolkit>>;
