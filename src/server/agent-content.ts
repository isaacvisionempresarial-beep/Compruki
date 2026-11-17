import { formatCop } from "@/lib/format";
import { productMargin, type CatalogProduct } from "@/lib/catalog";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { listProducts } from "@/server/catalog-store";
import { getPilotTenantId } from "@/server/tenant";

export type ContentChannel = "ficha" | "anuncio" | "whatsapp";

export type ProductFacts = {
  sku: string;
  title: string;
  category: string;
  price: number;
  priceLabel: string;
  margin: number;
  published: boolean;
  available: boolean;
  variants: string[];
  sizeKind: string | null;
  description: string;
  highlights: string;
  externalRef: string;
  brandNotes: string[];
};

export type ContentDraft = {
  channel: ContentChannel;
  title: string;
  body: string;
  cta: string;
  source: "plantilla";
};

export type SavedContentDraft = ContentDraft & {
  id: string;
  productSku: string;
  createdAt: string;
};

const BRAND_NOTES = [
  "Marca de trabajo COMPRUKI.",
  "Dropi no está conectado: no digas que el stock viene del proveedor en vivo.",
  "El precio se paga al recibir; el envío se confirma aparte.",
  "No inventes medidas, materiales ni promesas no escritas en la ficha.",
];

/** AG-03 · get_product_facts */
export async function getProductFacts(sku: string): Promise<ProductFacts | null> {
  const product = await findProduct(sku);
  if (!product) return null;
  return factsFromProduct(product);
}

/** AG-03 · get_brand_guidelines (estáticas del piloto) */
export function getBrandGuidelines() {
  return [...BRAND_NOTES];
}

/** Borradores plantilla a partir de hechos verificables. No usa OpenAI. */
export async function buildTemplateDrafts(sku: string): Promise<{ facts: ProductFacts; drafts: ContentDraft[] } | null> {
  const facts = await getProductFacts(sku);
  if (!facts) return null;

  const variantLine =
    facts.variants.length > 0
      ? `Opciones: ${facts.variants.slice(0, 6).join(", ")}${facts.variants.length > 6 ? "…" : ""}.`
      : "Sin variantes registradas.";

  const highlightLine = firstNonEmptyLine(facts.highlights) || firstNonEmptyLine(facts.description) || "Revisa la ficha antes de publicar.";

  const drafts: ContentDraft[] = [
    {
      channel: "ficha",
      title: facts.title,
      body: [
        facts.description.trim() || `${facts.title} en ${facts.category || "el catálogo"}.`,
        highlightLine,
        variantLine,
        `Precio: ${facts.priceLabel}. Pagas al recibir. El envío se confirma aparte.`,
        "Dropi no está conectado.",
      ].join("\n\n"),
      cta: "Ver producto",
      source: "plantilla",
    },
    {
      channel: "anuncio",
      title: `${facts.title} · ${facts.priceLabel}`,
      body: [
        highlightLine,
        variantLine,
        `Precio ${facts.priceLabel}. Contra entrega. Envío por confirmar.`,
        "Información del catálogo local de COMPRUKI. Dropi no está conectado.",
      ].join(" "),
      cta: "Pedir ahora",
      source: "plantilla",
    },
    {
      channel: "whatsapp",
      title: `Consulta ${facts.sku}`,
      body: [
        `Hola, te escribo por ${facts.title} (${facts.sku}).`,
        `Va en ${facts.priceLabel}, pago contra entrega.`,
        variantLine,
        "¿Te confirmo disponibilidad y datos de envío? Dropi no está conectado desde aquí.",
      ].join(" "),
      cta: "Quiero pedirlo",
      source: "plantilla",
    },
  ];

  return { facts, drafts };
}

/** AG-03 · save_content_draft */
export async function saveContentDraft(input: {
  sku: string;
  channel: ContentChannel;
  title: string;
  body: string;
  cta: string;
  createdBy?: string | null;
}): Promise<{ error: string | null; draft: SavedContentDraft | null }> {
  const facts = await getProductFacts(input.sku);
  if (!facts) return { error: "No encontré ese producto en el catálogo local.", draft: null };

  const channel = input.channel;
  if (channel !== "ficha" && channel !== "anuncio" && channel !== "whatsapp") {
    return { error: "Canal no válido.", draft: null };
  }

  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("content_drafts")
      .insert({
        tenant_id: tenantId,
        product_sku: facts.sku,
        channel,
        title: input.title.trim().slice(0, 200),
        body: input.body.trim().slice(0, 4000),
        cta: input.cta.trim().slice(0, 120),
        source: "plantilla",
        created_by: input.createdBy ?? null,
      })
      .select("id, product_sku, channel, title, body, cta, source, created_at")
      .single();

    if (error) {
      return {
        error:
          error.message.includes("schema cache") || error.message.includes("does not exist")
            ? "Falta la tabla content_drafts. Ejecuta supabase/migrations/005_content_drafts.sql."
            : `No se pudo guardar: ${error.message}`,
        draft: null,
      };
    }

    return {
      error: null,
      draft: {
        id: String(data.id),
        productSku: String(data.product_sku),
        channel: data.channel as ContentChannel,
        title: String(data.title ?? ""),
        body: String(data.body ?? ""),
        cta: String(data.cta ?? ""),
        source: "plantilla",
        createdAt: String(data.created_at),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el borrador.";
    return { error: message, draft: null };
  }
}

export async function listContentDrafts(sku?: string, limit = 12): Promise<SavedContentDraft[]> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    let query = supabase
      .from("content_drafts")
      .select("id, product_sku, channel, title, body, cta, source, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (sku?.trim()) query = query.eq("product_sku", sku.trim().toUpperCase());

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row) => ({
      id: String(row.id),
      productSku: String(row.product_sku),
      channel: row.channel as ContentChannel,
      title: String(row.title ?? ""),
      body: String(row.body ?? ""),
      cta: String(row.cta ?? ""),
      source: "plantilla" as const,
      createdAt: String(row.created_at),
    }));
  } catch {
    return [];
  }
}

export async function listDraftableProducts() {
  const products = await listProducts();
  return products
    .map((product) => ({ sku: product.sku, title: product.title }))
    .sort((a, b) => a.title.localeCompare(b.title, "es"));
}

async function findProduct(sku: string) {
  const products = await listProducts();
  return products.find((product) => product.sku === sku.trim().toUpperCase()) ?? null;
}

function factsFromProduct(product: CatalogProduct): ProductFacts {
  return {
    sku: product.sku,
    title: product.title,
    category: product.category.trim(),
    price: product.price,
    priceLabel: formatCop(product.price),
    margin: productMargin(product),
    published: product.published,
    available: product.available,
    variants: product.variants,
    sizeKind: product.sizeKind ?? null,
    description: product.description,
    highlights: product.highlights,
    externalRef: product.externalRef.trim(),
    brandNotes: getBrandGuidelines(),
  };
}

function firstNonEmptyLine(text: string) {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}
