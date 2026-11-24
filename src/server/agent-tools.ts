import { formatCop } from "@/lib/format";
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

export type AnalystReadingSource = "cifras" | "openai";

export type AnalystReading = {
  focusSku: string;
  bullets: string[];
  via: AnalystReadingSource;
  costEstimateCop: number;
};

const readingCache = new Map<string, AnalystReading>();

function readingCacheKey(sku?: string) {
  const trimmed = sku?.trim().toUpperCase() ?? "";
  return trimmed || "__all__";
}

export function rememberAnalystReading(reading: AnalystReading) {
  readingCache.set(readingCacheKey(reading.focusSku), reading);
}

export function getAnalystReadingPreview(sku?: string): AnalystReading | null {
  return readingCache.get(readingCacheKey(sku)) ?? null;
}

/** Solo tests. */
export function clearAnalystReadingCache() {
  readingCache.clear();
}

function scrubAnalystText(text: string) {
  return text
    .replace(/\bDropi\b/gi, "")
    .replace(/\bOpenAI\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lectura determinista a partir de cifras locales. Sin OpenAI. */
export function buildCifrasReading(
  margins: MarginBreakdown[],
  scenarios: ProductScenarios[],
  orders: OrderFinancials,
  focusSku = "",
): AnalystReading {
  const bullets: string[] = [];
  const focus = focusSku.trim().toUpperCase();
  const row = focus ? margins.find((item) => item.sku === focus) : null;
  const scenario = focus ? scenarios.find((item) => item.sku === focus) : null;

  if (focus && !row) {
    bullets.push(`SKU ${focus} no está en el catálogo local.`);
  } else if (row) {
    bullets.push(
      `${row.sku}: margen estimado ${formatCop(row.margin)} sobre precio de ficha ${formatCop(row.price)}. No es dinero cobrado.`,
    );
    const down = scenario?.scenarios[0];
    const up = scenario?.scenarios[2];
    if (down && up) {
      bullets.push(
        `Escenarios ±10 %: ${formatCop(down.margin)} / ${formatCop(up.margin)}. Lectura: no guarda el precio ni es utilidad realizada.`,
      );
    }
  } else {
    const positive = margins.filter((item) => item.margin > 0).length;
    bullets.push(
      `Catálogo: ${margins.length} productos; ${positive} con margen estimado positivo de la ficha. No es dinero cobrado.`,
    );
    const weak = [...margins].sort((a, b) => a.margin - b.margin).slice(0, 2);
    if (weak[0]) {
      bullets.push(
        `Menor margen estimado en ficha: ${weak.map((item) => `${item.sku} ${formatCop(item.margin)}`).join(" · ")}. Solo lectura.`,
      );
    }
  }

  bullets.push(
    `Pedidos: margen estimado ${formatCop(orders.estimatedMargin)} en ${orders.orderCount} pedido${orders.orderCount === 1 ? "" : "s"}${
      orders.missingCostLines > 0 ? ` · ${orders.missingCostLines} línea(s) sin costo` : ""
    }. No es utilidad realizada.`,
  );

  return {
    focusSku: focus,
    bullets,
    via: "cifras",
    costEstimateCop: 0,
  };
}

/** Interpreta JSON de OpenAI para la lectura del Analista. */
export function parseOpenAIAnalystReading(raw: string): string[] | null {
  try {
    const data = JSON.parse(raw) as { bullets?: unknown };
    if (!Array.isArray(data.bullets)) return null;
    const bullets = data.bullets
      .map((item) => (typeof item === "string" ? scrubAnalystText(item).slice(0, 220) : ""))
      .filter(Boolean)
      .slice(0, 4);
    return bullets.length >= 1 ? bullets : null;
  } catch {
    return null;
  }
}

/**
 * AG-04 · lectura: OpenAI comenta cifras locales si responde; si no, plantilla de cifras.
 * No cambia precios ni pedidos.
 */
export async function generateAnalystReading(sku?: string): Promise<AnalystReading> {
  const focus = sku?.trim().toUpperCase() ?? "";
  const [margins, scenarios, orders] = await Promise.all([
    calculateMargin(focus || undefined),
    comparePriceScenarios(focus || undefined),
    getOrderFinancials(),
  ]);
  const cifras = buildCifrasReading(margins, scenarios, orders, focus);
  if (focus && margins.length === 0) {
    rememberAnalystReading(cifras);
    return cifras;
  }

  const { openAIKeyConfigured } = await import("@/server/openai-client");
  if (!openAIKeyConfigured()) {
    rememberAnalystReading(cifras);
    return cifras;
  }

  try {
    const { chatJsonCompletion } = await import("@/server/openai-client");
    const productPayload = (focus ? margins : margins.slice(0, 8)).map((row) => ({
      sku: row.sku,
      title: row.title,
      price: row.price,
      margin: row.margin,
      marginRate: row.marginRate,
      published: row.published,
    }));
    const scenarioPayload = (focus ? scenarios : scenarios.slice(0, 8)).map((row) => ({
      sku: row.sku,
      downMargin: row.scenarios[0]?.margin ?? null,
      upMargin: row.scenarios[2]?.margin ?? null,
    }));

    const system = [
      "Eres el Analista de rentabilidad de COMPRUKI (panel dueño, Colombia).",
      "Devuelve SOLO JSON: {bullets: string[]} con 2 a 3 frases cortas.",
      "Usa únicamente las cifras del usuario. No inventes ventas, stock ni costos.",
      "Recuerda que es lectura: no es dinero cobrado ni utilidad realizada; Calcular no guarda precios.",
      "No menciones Dropi, OpenAI ni proveedores. Español colombiano claro.",
    ].join(" ");

    const completion = await chatJsonCompletion({
      system,
      user: JSON.stringify({
        focusSku: focus || null,
        products: productPayload,
        scenarios: scenarioPayload,
        orders: {
          orderCount: orders.orderCount,
          revenue: orders.revenue,
          estimatedMargin: orders.estimatedMargin,
          missingCostLines: orders.missingCostLines,
        },
      }),
      maxTokens: 400,
    });

    if (!completion.ok) {
      rememberAnalystReading(cifras);
      return cifras;
    }

    const bullets = parseOpenAIAnalystReading(completion.text);
    if (!bullets) {
      rememberAnalystReading(cifras);
      return cifras;
    }

    const reading: AnalystReading = {
      focusSku: focus,
      bullets,
      via: "openai",
      costEstimateCop: completion.costEstimateCop,
    };
    rememberAnalystReading(reading);
    return reading;
  } catch {
    rememberAnalystReading(cifras);
    return cifras;
  }
}
