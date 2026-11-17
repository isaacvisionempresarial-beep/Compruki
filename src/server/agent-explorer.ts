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

export type ExplorerShortlist = {
  query: string;
  category: string;
  sourceLabel: string;
  dropiLive: false;
  categories: string[];
  results: ExplorerProduct[];
};

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

/**
 * AG-02 · search_provider_products (modo local).
 * No consulta Dropi. Deja trazado source=catalogo_local.
 */
export async function searchLocalCatalog(query = "", category = ""): Promise<ExplorerShortlist> {
  const products = await listProducts();
  const categories = await getCatalogCategories();
  const mapped = products.map(toExplorer);
  const results = filterExplorerProducts(mapped, query, category);

  return {
    query: query.trim(),
    category: category.trim(),
    sourceLabel: "Catálogo local de la tienda piloto",
    dropiLive: false,
    categories,
    results,
  };
}
