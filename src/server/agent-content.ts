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

export type ContentDraftSource = "plantilla" | "openai";

export type ContentDraft = {
  channel: ContentChannel;
  title: string;
  body: string;
  cta: string;
  source: ContentDraftSource;
};

export type DraftReviewStatus = "pending" | "approved" | "rejected";

export type SavedContentDraft = ContentDraft & {
  id: string;
  productSku: string;
  createdAt: string;
  reviewStatus: DraftReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  authorName: string | null;
};

const BRAND_NOTES = [
  "Marca de trabajo COMPRUKI.",
  "No digas que el stock viene de un proveedor en vivo ni nombres plataformas de dropshipping.",
  "El precio se paga al recibir; el envío se confirma aparte.",
  "No inventes medidas, materiales ni promesas no escritas en la ficha.",
];

type DraftPack = { facts: ProductFacts; drafts: ContentDraft[]; costEstimateCop: number; via: ContentDraftSource };

const previewCache = new Map<string, { at: number; pack: DraftPack }>();
const PREVIEW_TTL_MS = 15 * 60_000;

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

function templatePack(facts: ProductFacts): DraftPack {
  const variantLine =
    facts.variants.length > 0
      ? `Opciones: ${facts.variants.slice(0, 6).join(", ")}${facts.variants.length > 6 ? "…" : ""}.`
      : "Sin variantes registradas.";

  const highlightLine =
    firstNonEmptyLine(facts.highlights) || firstNonEmptyLine(facts.description) || "Revisa la ficha antes de publicar.";

  const drafts: ContentDraft[] = [
    {
      channel: "ficha",
      title: facts.title,
      body: [
        facts.description.trim() || `${facts.title} en ${facts.category || "el catálogo"}.`,
        highlightLine,
        variantLine,
        `Precio: ${facts.priceLabel}. Pagas al recibir. El envío se acuerda aparte.`,
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
        "Información del catálogo local de COMPRUKI.",
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
        "¿Te confirmo disponibilidad y datos de envío?",
      ].join(" "),
      cta: "Quiero pedirlo",
      source: "plantilla",
    },
  ];

  return { facts, drafts, costEstimateCop: 0, via: "plantilla" };
}

/** Borradores plantilla a partir de hechos verificables. No usa OpenAI. */
export async function buildTemplateDrafts(sku: string): Promise<{ facts: ProductFacts; drafts: ContentDraft[] } | null> {
  const facts = await getProductFacts(sku);
  if (!facts) return null;
  const pack = templatePack(facts);
  return { facts: pack.facts, drafts: pack.drafts };
}

function previewKey(sku: string) {
  return sku.trim().toUpperCase();
}

export function rememberContentPreview(sku: string, pack: DraftPack) {
  previewCache.set(previewKey(sku), { at: Date.now(), pack });
}

export async function getContentDraftPreview(sku: string): Promise<DraftPack | null> {
  const key = previewKey(sku);
  if (!key) return null;
  const cached = previewCache.get(key);
  if (cached && Date.now() - cached.at < PREVIEW_TTL_MS) return cached.pack;

  const facts = await getProductFacts(key);
  if (!facts) return null;
  return templatePack(facts);
}

/** AG-03 · genera con OpenAI si responde; si no, plantilla. Solo hechos de catálogo. */
export async function generateContentDrafts(sku: string): Promise<DraftPack | null> {
  const facts = await getProductFacts(sku);
  if (!facts) return null;

  const { openAIKeyConfigured } = await import("@/server/openai-client");
  if (!openAIKeyConfigured()) {
    const pack = templatePack(facts);
    rememberContentPreview(facts.sku, pack);
    return pack;
  }

  try {
    const { chatJsonCompletion } = await import("@/server/openai-client");
    const system = [
      "Eres el Creador de contenido de COMPRUKI (tienda Colombia).",
      "Devuelve SOLO JSON con clave drafts: array de 3 objetos {channel,title,body,cta}.",
      "channels exactos: ficha, anuncio, whatsapp.",
      "Usa únicamente los hechos del usuario. No inventes stock, medidas, materiales ni promesas.",
      "No menciones Dropi, OpenAI ni proveedores. Español colombiano claro.",
      "Pagas al recibir. Envío aparte. Nadie cobra en la tienda web.",
      "title ≤ 80 caracteres, body ≤ 600, cta ≤ 40.",
    ].join(" ");

    const user = JSON.stringify({
      sku: facts.sku,
      title: facts.title,
      category: facts.category,
      priceLabel: facts.priceLabel,
      published: facts.published,
      available: facts.available,
      variants: facts.variants,
      sizeKind: facts.sizeKind,
      description: facts.description.slice(0, 800),
      highlights: facts.highlights.slice(0, 500),
      brandNotes: facts.brandNotes,
    });

    const completion = await chatJsonCompletion({ system, user, maxTokens: 1000 });
    if (!completion.ok) {
      const pack = templatePack(facts);
      rememberContentPreview(facts.sku, pack);
      return pack;
    }

    const parsed = parseOpenAIDrafts(completion.text, facts);
    if (!parsed) {
      const pack = templatePack(facts);
      rememberContentPreview(facts.sku, pack);
      return pack;
    }

    const pack: DraftPack = {
      facts,
      drafts: parsed,
      costEstimateCop: completion.costEstimateCop,
      via: "openai",
    };
    rememberContentPreview(facts.sku, pack);
    return pack;
  } catch {
    const pack = templatePack(facts);
    rememberContentPreview(facts.sku, pack);
    return pack;
  }
}

function parseOpenAIDrafts(raw: string, facts: ProductFacts): ContentDraft[] | null {
  try {
    const data = JSON.parse(raw) as { drafts?: unknown };
    if (!Array.isArray(data.drafts)) return null;
    const byChannel = new Map<ContentChannel, ContentDraft>();
    for (const item of data.drafts) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const channel = row.channel;
      if (channel !== "ficha" && channel !== "anuncio" && channel !== "whatsapp") continue;
      const title = scrubPublicDraft(String(row.title ?? "").trim()).slice(0, 80);
      const body = scrubPublicDraft(String(row.body ?? "").trim()).slice(0, 600);
      const cta = scrubPublicDraft(String(row.cta ?? "").trim()).slice(0, 40);
      if (!title || !body || !cta) continue;
      byChannel.set(channel, { channel, title, body, cta, source: "openai" });
    }
    const ordered: ContentChannel[] = ["ficha", "anuncio", "whatsapp"];
    const drafts = ordered.map((channel) => byChannel.get(channel)).filter(Boolean) as ContentDraft[];
    if (drafts.length !== 3) return null;
    // Ancla mínima al producto real
    if (!drafts.some((draft) => draft.body.includes(facts.priceLabel) || draft.title.includes(facts.title.slice(0, 12)))) {
      return null;
    }
    return drafts;
  } catch {
    return null;
  }
}

function scrubPublicDraft(value: string) {
  return value
    .replace(/\bDropi\b/gi, "")
    .replace(/\bOpenAI\b/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/** AG-03 · save_content_draft */
export async function saveContentDraft(input: {
  sku: string;
  channel: ContentChannel;
  title: string;
  body: string;
  cta: string;
  source?: ContentDraftSource;
  createdBy?: string | null;
  authorName?: string | null;
}): Promise<{ error: string | null; draft: SavedContentDraft | null }> {
  const facts = await getProductFacts(input.sku);
  if (!facts) return { error: "No encontré ese producto en el catálogo local.", draft: null };

  const channel = input.channel;
  if (channel !== "ficha" && channel !== "anuncio" && channel !== "whatsapp") {
    return { error: "Canal no válido.", draft: null };
  }
  const source: ContentDraftSource = input.source === "openai" ? "openai" : "plantilla";

  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const authorName = input.authorName?.trim().slice(0, 120) || null;
    const row = {
      tenant_id: tenantId,
      product_sku: facts.sku,
      channel,
      title: input.title.trim().slice(0, 200),
      body: input.body.trim().slice(0, 4000),
      cta: input.cta.trim().slice(0, 120),
      source,
      review_status: "pending",
      created_by: input.createdBy ?? null,
      ...(authorName ? { author_name: authorName } : {}),
    };
    let storedAuthor = authorName;
    let { data, error } = await supabase
      .from("content_drafts")
      .insert(row)
      .select("id, product_sku, channel, title, body, cta, source, review_status, created_at")
      .single();
    if (error && authorName && error.message.includes("author_name")) {
      storedAuthor = null;
      const withoutAuthor = {
        tenant_id: row.tenant_id,
        product_sku: row.product_sku,
        channel: row.channel,
        title: row.title,
        body: row.body,
        cta: row.cta,
        source: row.source,
        review_status: row.review_status,
        created_by: row.created_by,
      };
      ({ data, error } = await supabase
        .from("content_drafts")
        .insert(withoutAuthor)
        .select("id, product_sku, channel, title, body, cta, source, review_status, created_at")
        .single());
    }

    if (error || !data) {
      const message = error?.message ?? "No se pudo guardar el borrador.";
      return {
        error:
          message.includes("schema cache") || message.includes("does not exist")
            ? "Falta la tabla content_drafts. Ejecuta supabase/migrations/005_content_drafts.sql."
            : message.includes("review_status")
              ? "Falta review_status. Ejecuta supabase/migrations/007_content_draft_review.sql."
              : `No se pudo guardar: ${message}`,
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
        source: data.source === "openai" ? "openai" : "plantilla",
        createdAt: String(data.created_at),
        reviewStatus: mapReviewStatus(data.review_status),
        reviewedBy: null,
        reviewedAt: null,
        authorName: storedAuthor,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el borrador.";
    return { error: message, draft: null };
  }
}

export async function listContentDrafts(sku?: string, limit = 12): Promise<SavedContentDraft[]> {
  try {
    const rows = await loadDraftRows({ sku, limit });
    return rows.map((row) => mapSavedDraft(row));
  } catch {
    return [];
  }
}

export async function listPendingContentDrafts(limit = 8): Promise<SavedContentDraft[]> {
  try {
    const rows = await loadDraftRows({ pendingOnly: true, limit });
    return rows.map((row) => mapSavedDraft(row));
  } catch {
    return [];
  }
}

const DRAFT_LIST_COLUMNS =
  "id, product_sku, channel, title, body, cta, source, review_status, reviewed_by, reviewed_at, author_name, created_at";
const DRAFT_LIST_COLUMNS_WITHOUT_AUTHOR =
  "id, product_sku, channel, title, body, cta, source, review_status, reviewed_by, reviewed_at, created_at";
const DRAFT_LIST_COLUMNS_WITHOUT_REVIEWER =
  "id, product_sku, channel, title, body, cta, source, review_status, created_at";

async function loadDraftRows(options: { sku?: string; pendingOnly?: boolean; limit: number }) {
  const tenantId = await getPilotTenantId();
  const supabase = createAdminSupabase();
  const columnSets = [DRAFT_LIST_COLUMNS, DRAFT_LIST_COLUMNS_WITHOUT_AUTHOR, DRAFT_LIST_COLUMNS_WITHOUT_REVIEWER];

  for (const columns of columnSets) {
    let query = supabase
      .from("content_drafts")
      .select(columns)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(options.limit);
    if (options.pendingOnly) query = query.eq("review_status", "pending");
    if (options.sku?.trim()) query = query.eq("product_sku", options.sku.trim().toUpperCase());
    const { data, error } = await query;
    if (!error) return (data ?? []) as unknown as DraftListRow[];
    if (!isOptionalDraftColumn(error.message)) return [];
  }

  return [];
}

type DraftListRow = {
  id: unknown;
  product_sku: unknown;
  channel: unknown;
  title: unknown;
  body: unknown;
  cta: unknown;
  source?: unknown;
  created_at: unknown;
  review_status?: unknown;
  reviewed_by?: unknown;
  reviewed_at?: unknown;
  author_name?: unknown;
};

function mapSavedDraft(row: DraftListRow): SavedContentDraft {
  return {
    id: String(row.id),
    productSku: String(row.product_sku),
    channel: row.channel as ContentChannel,
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    cta: String(row.cta ?? ""),
    source: row.source === "openai" ? "openai" : "plantilla",
    createdAt: String(row.created_at),
    reviewStatus: mapReviewStatus(row.review_status),
    reviewedBy: typeof row.reviewed_by === "string" && row.reviewed_by.trim() ? row.reviewed_by.trim() : null,
    reviewedAt: typeof row.reviewed_at === "string" && row.reviewed_at ? row.reviewed_at : null,
    authorName: typeof row.author_name === "string" && row.author_name.trim() ? row.author_name.trim() : null,
  };
}

function isOptionalDraftColumn(message: string) {
  return message.includes("author_name") || message.includes("reviewed_by") || message.includes("reviewed_at");
}

function mapReviewStatus(value: unknown): DraftReviewStatus {
  if (value === "approved" || value === "rejected" || value === "pending") return value;
  return "pending";
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
