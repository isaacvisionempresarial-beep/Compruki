import { formatCop } from "@/lib/format";
import { productMargin, type CatalogProduct } from "@/lib/catalog";
import { listProducts } from "@/server/catalog-store";

export type ExplorerProduct = {
  sku: string;
  title: string;
  category: string;
  price: number;
  margin: number;
  published: boolean;
  available: boolean;
  variants: string[];
  sizeKind: string | null;
  externalRef: string;
  source: "catalogo_local";
};

export type ExplorerVia = "local" | "openai";

export type ExplorerShortlist = {
  query: string;
  category: string;
  sourceLabel: string;
  dropiLive: false;
  categories: string[];
  results: ExplorerProduct[];
  via: ExplorerVia;
  costEstimateCop: number;
  bullets: string[];
};

const previewCache = new Map<string, ExplorerShortlist>();

function cacheKey(query: string, category: string) {
  return `${query.trim().toLocaleLowerCase("es")}::${category.trim().toLocaleLowerCase("es")}`;
}

export function rememberExplorerShortlist(shortlist: ExplorerShortlist) {
  previewCache.set(cacheKey(shortlist.query, shortlist.category), shortlist);
}

export function getExplorerShortlistPreview(query = "", category = ""): ExplorerShortlist | null {
  return previewCache.get(cacheKey(query, category)) ?? null;
}

/** Solo tests. */
export function clearExplorerPreviewCache() {
  previewCache.clear();
}

function toExplorer(product: CatalogProduct): ExplorerProduct {
  return {
    sku: product.sku,
    title: product.title,
    category: product.category.trim() || "Sin categoría",
    price: product.price,
    margin: productMargin(product),
    published: product.published,
    available: product.available,
    variants: product.variants,
    sizeKind: product.sizeKind ?? null,
    externalRef: product.externalRef.trim(),
    source: "catalogo_local",
  };
}

/** AG-02 · get_catalog_categories — solo catálogo propio. */
export async function getCatalogCategories(): Promise<string[]> {
  const products = await listProducts();
  const set = new Set<string>();
  for (const product of products) {
    const category = product.category.trim();
    if (category) set.add(category);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/** AG-02 · get_product_details — ficha local por SKU. */
export async function getProductDetails(sku: string): Promise<ExplorerProduct | null> {
  const products = await listProducts();
  const product = products.find((item) => item.sku === sku.trim().toUpperCase());
  return product ? toExplorer(product) : null;
}

export function filterExplorerProducts(products: ExplorerProduct[], query = "", category = "") {
  const q = query.trim().toLocaleLowerCase("es");
  const cat = category.trim().toLocaleLowerCase("es");
  return products
    .filter((product) => {
      if (cat && product.category.toLocaleLowerCase("es") !== cat) return false;
      if (!q) return true;
      const haystack = [product.title, product.sku, product.category, product.externalRef, ...product.variants]
        .join(" ")
        .toLocaleLowerCase("es");
      return haystack.includes(q);
    })
    .sort((a, b) => a.title.localeCompare(b.title, "es"));
}

function buildLocalBullets(results: ExplorerProduct[], query: string, category: string): string[] {
  const filters = [query ? `«${query}»` : null, category ? `categoría ${category}` : null].filter(Boolean).join(", ");
  const bullets = [
    filters
      ? `Shortlist local con ${results.length} producto${results.length === 1 ? "" : "s"} · ${filters}. No es Dropi en vivo.`
      : `Shortlist local con ${results.length} producto${results.length === 1 ? "" : "s"} del catálogo. No es Dropi en vivo.`,
  ];
  if (results[0]) {
    bullets.push(
      `Primero: ${results[0].sku} · ${results[0].title} · margen estimado ${formatCop(results[0].margin)}. No es dinero cobrado.`,
    );
  } else {
    bullets.push("Sin coincidencias en el catálogo local. Buscar no cambia el catálogo.");
  }
  return bullets;
}

/**
 * AG-02 · search_provider_products (modo local).
 * No consulta Dropi. Deja trazado source=catalogo_local.
 */
export async function searchLocalCatalog(query = "", category = ""): Promise<ExplorerShortlist> {
  const products = await listProducts();
  const categories = await getCatalogCategories();
  const mapped = products.map(toExplorer);
  const results = filterExplorerProducts(mapped, query, category);
  const q = query.trim();
  const cat = category.trim();

  return {
    query: q,
    category: cat,
    sourceLabel: "Catálogo local de la tienda piloto",
    dropiLive: false,
    categories,
    results,
    via: "local",
    costEstimateCop: 0,
    bullets: buildLocalBullets(results, q, cat),
  };
}

function scrubExplorerText(text: string) {
  return text
    .replace(/\bDropi\b/gi, "")
    .replace(/\bOpenAI\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Interpreta ranking + bullets de OpenAI sobre shortlist local. */
export function parseOpenAIExplorerPlan(
  raw: string,
  candidates: ExplorerProduct[],
): { skus: string[]; bullets: string[] } | null {
  try {
    const data = JSON.parse(raw) as { skus?: unknown; bullets?: unknown };
    const allowed = new Set(candidates.map((item) => item.sku));
    const skus = Array.isArray(data.skus)
      ? data.skus
          .map((item) => (typeof item === "string" ? item.trim().toUpperCase() : ""))
          .filter((sku) => allowed.has(sku))
      : [];
    const bullets = Array.isArray(data.bullets)
      ? data.bullets
          .map((item) => (typeof item === "string" ? scrubExplorerText(item).slice(0, 220) : ""))
          .filter(Boolean)
          .slice(0, 3)
      : [];
    if (skus.length === 0 && bullets.length === 0) return null;
    return { skus, bullets };
  } catch {
    return null;
  }
}

/**
 * AG-02 · busca local y, si OpenAI responde, reordena y resume.
 * No importa productos ni escribe el catálogo.
 */
export async function exploreCatalog(query = "", category = ""): Promise<ExplorerShortlist> {
  const local = await searchLocalCatalog(query, category);
  const { openAIKeyConfigured } = await import("@/server/openai-client");
  if (!openAIKeyConfigured() || local.results.length === 0) {
    rememberExplorerShortlist(local);
    return local;
  }

  try {
    const { chatJsonCompletion } = await import("@/server/openai-client");
    const payload = local.results.slice(0, 24).map((row) => ({
      sku: row.sku,
      title: row.title,
      category: row.category,
      price: row.price,
      margin: row.margin,
      published: row.published,
      available: row.available,
      variants: row.variants.slice(0, 6),
    }));
    const system = [
      "Eres el Explorador de COMPRUKI (panel dueño, Colombia).",
      "Devuelve SOLO JSON: {skus:string[], bullets:string[]}.",
      "skus: orden de relevancia usando SOLO los SKU del usuario (puedes omitir algunos).",
      "bullets: 1 a 3 frases cortas sobre la shortlist. No inventes productos ni stock.",
      "No menciones Dropi, OpenAI ni proveedores. Español colombiano claro.",
      "Recuerda: es catálogo local; Buscar no cambia el catálogo ni el precio.",
    ].join(" ");
    const completion = await chatJsonCompletion({
      system,
      user: JSON.stringify({
        query: local.query || null,
        category: local.category || null,
        products: payload,
      }),
      maxTokens: 450,
    });
    if (!completion.ok) {
      rememberExplorerShortlist(local);
      return local;
    }
    const parsed = parseOpenAIExplorerPlan(completion.text, local.results);
    if (!parsed) {
      rememberExplorerShortlist(local);
      return local;
    }

    const bySku = new Map(local.results.map((row) => [row.sku, row]));
    const ranked: ExplorerProduct[] = [];
    for (const sku of parsed.skus) {
      const row = bySku.get(sku);
      if (row) {
        ranked.push(row);
        bySku.delete(sku);
      }
    }
    for (const row of local.results) {
      if (bySku.has(row.sku)) ranked.push(row);
    }

    const shortlist: ExplorerShortlist = {
      ...local,
      results: ranked,
      via: "openai",
      costEstimateCop: completion.costEstimateCop,
      bullets:
        parsed.bullets.length > 0
          ? parsed.bullets
          : buildLocalBullets(ranked, local.query, local.category),
    };
    rememberExplorerShortlist(shortlist);
    return shortlist;
  } catch {
    rememberExplorerShortlist(local);
    return local;
  }
}
