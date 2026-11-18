import { randomUUID } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import {
  bogotaNow,
  changeSummary,
  isSizeKind,
  MAX_PRODUCT_IMAGES,
  normalizeAssets,
  PRODUCT_IMAGE_TYPES,
  validateProduct,
  type CatalogProduct,
  type ProductDraft,
  type SizeKind,
  type ProductImageType,
} from "@/lib/catalog";
import { DEMO_USER } from "@/lib/demo-account";
import { loadProducts, saveProducts } from "@/server/pg-persistence";
import {
  downloadProductMedia,
  localAssetPath,
  mediaObjectKey,
  removeAllProductMedia,
  removeProductMediaKeys,
  uploadProductMedia,
  type MediaContentType,
} from "@/server/product-media";
import { getPilotTenantId } from "@/server/tenant";

export type ImageUpdate = { kind: "keep" } | { kind: "clear" } | { kind: "set"; bytes: Buffer; type: ProductImageType };

export type MediaUpdate = {
  addImages: { bytes: Buffer; type: ProductImageType }[];
  video: Buffer | null;
  clearVideo: boolean;
  removeIds: string[];
};

export async function listProducts() {
  return (await readProducts()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title, "es"));
}

export async function getProductBySku(sku: string) {
  const normalized = sku.trim().toUpperCase();
  if (!normalized) return null;
  const products = await readProducts();
  return products.find((product) => product.sku === normalized) ?? null;
}

export type ContentDraftApplyInput = {
  sku: string;
  channel: "ficha" | "anuncio" | "whatsapp";
  title: string;
  body: string;
  cta: string;
};

export type CatalogFieldDiff = {
  field: string;
  before: string;
  after: string;
  changed: boolean;
};

export type ContentDraftComparison = {
  error: string | null;
  diffs: CatalogFieldDiff[];
  applyTarget: string;
  /** Título actual del producto. Si el borrador deja el título vacío, se conserva este. */
  fallbackTitle: string;
};

/** Calcula el texto que quedaría en catálogo si se aprueba el borrador. */
export async function previewContentDraftAgainstCatalog(input: ContentDraftApplyInput): Promise<ContentDraftComparison> {
  return compareDraftToProduct(await getProductBySku(input.sku), input);
}

/** Una sola lectura del catálogo para varios borradores pendientes. */
export async function previewContentDraftsAgainstCatalog(
  inputs: ContentDraftApplyInput[],
): Promise<ContentDraftComparison[]> {
  if (inputs.length === 0) return [];
  const products = await readProducts();
  const bySku = new Map(products.map((product) => [product.sku, product]));
  return inputs.map((input) => compareDraftToProduct(bySku.get(input.sku.trim().toUpperCase()) ?? null, input));
}

function compareDraftToProduct(product: CatalogProduct | null, input: ContentDraftApplyInput): ContentDraftComparison {
  if (!product) {
    return {
      error: `No encontré ${input.sku} en el catálogo local.`,
      diffs: [],
      applyTarget: applyTargetLabel(input.channel),
      fallbackTitle: "",
    };
  }

  const proposed = proposeDraftFields(product, input);
  const diffs: CatalogFieldDiff[] =
    input.channel === "ficha"
      ? [
          fieldDiff("Título", product.title, proposed.title),
          fieldDiff("Descripción", product.description, proposed.description),
        ]
      : input.channel === "anuncio"
        ? [fieldDiff("Destacados", product.highlights, proposed.highlights)]
        : [fieldDiff("Respuestas / WhatsApp", product.answers, proposed.answers)];

  return { error: null, diffs, applyTarget: applyTargetLabel(input.channel), fallbackTitle: product.title };
}

/** Aplica un borrador aprobado al catálogo local (escritura supervisada). */
export async function applyApprovedContentDraft(
  input: ContentDraftApplyInput,
  actorName: string,
): Promise<{ error: string | null; applied: boolean }> {
  const product = await getProductBySku(input.sku);
  if (!product) return { error: `No encontré ${input.sku} en el catálogo local.`, applied: false };

  const proposed = proposeDraftFields(product, input);
  const sameText =
    proposed.title.trim() === product.title.trim() &&
    proposed.description.trim() === product.description.trim() &&
    proposed.highlights.trim() === product.highlights.trim() &&
    proposed.answers.trim() === product.answers.trim();
  if (sameText) return { error: null, applied: false };

  const draft: ProductDraft = {
    id: product.id,
    title: proposed.title,
    description: proposed.description,
    highlights: proposed.highlights,
    answers: proposed.answers,
    sku: product.sku,
    externalRef: product.externalRef,
    category: product.category,
    price: product.price,
    cost: product.cost,
    shipping: product.shipping,
    commissions: product.commissions,
    published: product.published,
    available: product.available,
    variants: product.variants,
    sizeKind: product.sizeKind ?? "",
  };

  const lead =
    input.channel === "ficha"
      ? "Borrador de ficha aprobado."
      : input.channel === "anuncio"
        ? "Borrador de anuncio aprobado."
        : "Borrador de WhatsApp aprobado.";
  const result = await saveProduct(draft, actorName, emptyMedia(), lead);
  if (result.error || !result.product) {
    return { error: result.error ?? "No se pudo aplicar el borrador al catálogo.", applied: false };
  }
  return { error: null, applied: true };
}

function proposeDraftFields(product: CatalogProduct, input: ContentDraftApplyInput) {
  const title = input.title.trim().slice(0, 200) || product.title;
  const body = input.body.trim().slice(0, 4000);
  const cta = input.cta.trim().slice(0, 120);
  const next = {
    title: product.title,
    description: product.description,
    highlights: product.highlights,
    answers: product.answers,
  };

  if (input.channel === "ficha") {
    next.title = title;
    next.description = [body, cta ? `CTA: ${cta}` : ""].filter(Boolean).join("\n\n");
  } else if (input.channel === "anuncio") {
    next.highlights = [title, body, cta ? `CTA: ${cta}` : ""].filter(Boolean).join("\n");
  } else {
    next.answers = [title, body, cta ? `CTA: ${cta}` : ""].filter(Boolean).join("\n\n");
  }
  return next;
}

function applyTargetLabel(channel: ContentDraftApplyInput["channel"]) {
  if (channel === "ficha") return "título y descripción del producto";
  if (channel === "anuncio") return "destacados del producto";
  return "respuestas / WhatsApp del producto";
}

function fieldDiff(field: string, before: string, after: string): CatalogFieldDiff {
  const left = before.trim() || "(vacío)";
  const right = after.trim() || "(vacío)";
  return { field, before: left, after: right, changed: left !== right };
}

export type PublicProduct = {
  id: string;
  title: string;
  description: string;
  highlights: string;
  answers: string;
  sku: string;
  category: string;
  price: number;
  available: boolean;
  hasImage: boolean;
  images: { id: string }[];
  hasVideo: boolean;
  variants: string[];
  sizeKind: SizeKind | null;
};

export async function listPublicProducts(): Promise<PublicProduct[]> {
  return (await listProducts())
    .filter((product) => product.published)
    .map(toPublicProduct)
    .sort((a, b) => a.title.localeCompare(b.title, "es"));
}

export type OrderableProduct = {
  sku: string;
  title: string;
  price: number;
  variants: string[];
  sizeKind: SizeKind | null;
};

export async function listOrderableProducts(): Promise<OrderableProduct[]> {
  return (await listProducts())
    .filter((product) => product.published && product.available)
    .map((product) => ({
      sku: product.sku,
      title: product.title,
      price: product.price,
      variants: product.variants,
      sizeKind: product.sizeKind ?? null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "es"));
}

export async function listSizeGuides() {
  return (await listProducts()).map((product) => ({
    sku: product.sku,
    variants: product.variants,
    sizeKind: product.sizeKind ?? null,
  }));
}

export async function listCostGuides() {
  return (await listProducts()).map((product) => ({
    sku: product.sku,
    cost: product.cost,
    shipping: product.shipping,
    commissions: product.commissions,
  }));
}

export async function getPublicProduct(sku: string) {
  const product = (await readProducts()).find((item) => item.published && item.sku === sku.toUpperCase());
  return product ? toPublicProduct(product) : null;
}

function toPublicProduct(product: CatalogProduct): PublicProduct {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    highlights: product.highlights.trim(),
    answers: product.answers.trim(),
    sku: product.sku,
    category: product.category.trim(),
    price: product.price,
    available: product.available,
    hasImage: product.assets.some((asset) => asset.kind === "image"),
    images: product.assets.filter((asset) => asset.kind === "image").map((asset) => ({ id: asset.id })),
    hasVideo: product.assets.some((asset) => asset.kind === "video"),
    variants: product.variants,
    sizeKind: product.sizeKind ?? null,
  };
}

export async function getCatalogProduct(sku: string) {
  return (await readProducts()).find((product) => product.sku === sku.toUpperCase()) ?? null;
}

export async function getCatalogProductById(id: string) {
  return (await readProducts()).find((product) => product.id === id) ?? null;
}

export async function deleteProduct(id: string, relatedOrderCount: number) {
  const products = await readProducts();
  const current = products.find((product) => product.id === id);
  if (!current) return { error: "Ese producto ya no está en el catálogo.", deleted: false as const, orderCount: 0 };

  const orderCount = Math.max(0, Math.floor(relatedOrderCount));
  if (orderCount > 0) {
    return {
      error:
        orderCount === 1
          ? "Hay 1 pedido con este producto. No se puede eliminar; márcalo como no disponible."
          : `Hay ${orderCount} pedidos con este producto. No se puede eliminar; márcalo como no disponible.`,
      deleted: false as const,
      orderCount,
    };
  }

  await writeProducts(products.filter((product) => product.id !== current.id));
  try {
    await removeAllProductMedia(current.id);
  } catch {
    // Si el bucket aún no existe, al menos limpia disco local.
  }
  for (const asset of current.assets) {
    const local = localAssetPath(current.id, asset.id);
    if (local && existsSync(local)) unlinkSync(local);
  }
  const cover = localAssetPath(current.id, "portada");
  if (cover && existsSync(cover)) unlinkSync(cover);
  return { error: null, deleted: true as const, orderCount: 0, sku: current.sku };
}

export async function deactivateProduct(id: string, actorName = DEMO_USER.name) {
  const products = await readProducts();
  const current = products.find((product) => product.id === id);
  if (!current) return { error: "Ese producto ya no está en el catálogo.", product: null };

  if (!current.available) return { error: null, product: current };

  const draft: ProductDraft = {
    id: current.id,
    title: current.title,
    description: current.description,
    highlights: current.highlights,
    answers: current.answers,
    sku: current.sku,
    externalRef: current.externalRef,
    category: current.category,
    price: current.price,
    cost: current.cost,
    shipping: current.shipping,
    commissions: current.commissions,
    published: current.published,
    available: false,
    variants: current.variants,
    sizeKind: current.sizeKind ?? "",
  };
  return saveProduct(draft, actorName);
}

export async function saveProduct(
  draft: ProductDraft,
  actorName = DEMO_USER.name,
  media: MediaUpdate = emptyMedia(),
  historyLead = "",
) {
  const products = await readProducts();
  const error = validateProduct(draft, products);
  if (error) return { error, product: null };

  const current = draft.id ? products.find((product) => product.id === draft.id) : undefined;
  if (draft.id && !current) return { error: "Ese producto ya no está en el catálogo.", product: null };

  const now = bogotaNow();
  const productId = current?.id ?? `prd_${randomUUID().slice(0, 8)}`;
  const applied = applyMedia(current, productId, media);
  if (applied.error) return { error: applied.error, product: null };

  const parts = [historyLead.trim(), changeSummary(current ?? null, draft), ...applied.notes];
  const moneySame =
    !!current &&
    current.price === draft.price &&
    current.cost === draft.cost &&
    current.shipping === draft.shipping &&
    current.commissions === draft.commissions &&
    current.published === draft.published;
  if (moneySame && parts.some((part) => part.trim())) {
    parts.push("El precio y la publicación no cambiaron.");
  }
  const note = parts.filter(Boolean).join(" ");
  const next: CatalogProduct = {
    id: productId,
    title: draft.title.trim(),
    description: draft.description.trim(),
    highlights: draft.highlights.trim(),
    answers: draft.answers.trim(),
    sku: draft.sku.trim().toUpperCase(),
    externalRef: draft.externalRef.trim(),
    category: draft.category.trim(),
    price: draft.price,
    cost: draft.cost,
    shipping: draft.shipping,
    commissions: draft.commissions,
    published: draft.published,
    available: draft.available,
    image: applied.image,
    assets: applied.assets,
    variants: draft.variants,
    ...(draft.variants.length > 0 && isSizeKind(draft.sizeKind) ? { sizeKind: draft.sizeKind } : {}),
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    history: current?.history ?? [],
  };

  if (!current || note) {
    next.history = [
      ...next.history,
      {
        id: `his_${randomUUID().slice(0, 8)}`,
        changedAt: now,
        actorName,
        price: next.price,
        cost: next.cost,
        shipping: next.shipping,
        commissions: next.commissions,
        published: next.published,
        available: next.available,
        summary: note || "Alta del producto.",
      },
    ];
  }

  try {
    for (const file of applied.writes) {
      await uploadProductMedia(productId, file.assetId, file.bytes, file.contentType);
    }
    if (applied.removes.length > 0) {
      const tenantId = await getPilotTenantId();
      await removeProductMediaKeys(
        applied.removes.map((item) => mediaObjectKey(tenantId, productId, item.assetId, item.contentType)),
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la media.";
    return { error: message, product: null };
  }

  const stored = current ? products.map((product) => (product.id === current.id ? next : product)) : [next, ...products];
  await writeProducts(stored);
  for (const item of applied.removes) {
    const local = localAssetPath(productId, item.assetId);
    if (local && existsSync(local)) unlinkSync(local);
  }
  return { error: null, product: next };
}

export async function loadProductImage(sku: string, publishedOnly: boolean, assetId?: string | null) {
  const product = (await readProducts()).find((item) => item.sku === sku.toUpperCase());
  if (!product) return null;
  if (publishedOnly && !product.published) return null;
  const images = product.assets.filter((asset) => asset.kind === "image");
  const asset = assetId ? images.find((item) => item.id === assetId) : images[0];
  if (!asset || asset.type === "video/mp4") return null;
  return downloadProductMedia(product.id, asset.id, asset.type);
}

export async function loadProductVideo(sku: string, publishedOnly: boolean) {
  const product = (await readProducts()).find((item) => item.sku === sku.toUpperCase());
  if (!product) return null;
  if (publishedOnly && !product.published) return null;
  const asset = product.assets.find((item) => item.kind === "video");
  if (!asset) return null;
  return downloadProductMedia(product.id, asset.id, "video/mp4");
}

function emptyMedia(): MediaUpdate {
  return { addImages: [], video: null, clearVideo: false, removeIds: [] };
}

type MediaWrite = { assetId: string; bytes: Buffer; contentType: MediaContentType };
type MediaRemove = { assetId: string; contentType: MediaContentType };

function applyMedia(current: CatalogProduct | undefined, productId: string, media: MediaUpdate) {
  const removeIds = new Set(media.removeIds);
  let assets = (current?.assets ?? []).filter((asset) => !removeIds.has(asset.id));
  if (media.clearVideo || media.video) assets = assets.filter((asset) => asset.kind !== "video");
  const notes: string[] = [];
  const writes: MediaWrite[] = [];
  const removes: MediaRemove[] = [];
  for (const asset of current?.assets ?? []) {
    if (!removeIds.has(asset.id) && !(asset.kind === "video" && (media.clearVideo || media.video))) continue;
    removes.push({ assetId: asset.id, contentType: asset.type });
  }
  if (removeIds.size > 0) notes.push(removeIds.size === 1 ? "Quitó un archivo del producto." : "Quitó archivos del producto.");

  const room = MAX_PRODUCT_IMAGES - assets.filter((asset) => asset.kind === "image").length;
  if (media.addImages.length > room) {
    return { error: `Puedes publicar hasta ${MAX_PRODUCT_IMAGES} fotos.`, assets, image: null, notes, writes, removes };
  }
  if (!/^prd_[a-z0-9]+$/i.test(productId)) {
    return { error: "No se pudo guardar la imagen.", assets, image: null, notes, writes, removes };
  }
  for (const image of media.addImages) {
    const id = assets.some((asset) => asset.kind === "image") ? `ast_${randomUUID().slice(0, 8)}` : "portada";
    assets.push({ id, kind: "image", type: image.type });
    writes.push({ assetId: id, bytes: image.bytes, contentType: image.type });
  }
  if (media.addImages.length === 1) notes.push("Quedó una imagen del producto.");
  else if (media.addImages.length > 1) notes.push(`Quedaron ${media.addImages.length} imágenes del producto.`);

  if (media.video) {
    assets.push({ id: "video", kind: "video", type: "video/mp4" });
    writes.push({ assetId: "video", bytes: media.video, contentType: "video/mp4" });
    notes.push("Quedó un video del producto.");
  } else if (media.clearVideo && current?.assets.some((asset) => asset.kind === "video")) notes.push("Quitó el video del producto.");

  const cover = assets.find((asset) => asset.kind === "image");
  return {
    error: null,
    assets,
    image: cover && cover.type !== "video/mp4" ? cover.type : null,
    notes,
    writes,
    removes,
  };
}

async function readProducts() {
  const parsed = await loadProducts();
  return parsed.map((product) => ({
    ...product,
    category: typeof product.category === "string" ? product.category : "",
    highlights: typeof product.highlights === "string" ? product.highlights : "",
    answers: typeof product.answers === "string" ? product.answers : "",
    image: PRODUCT_IMAGE_TYPES.find((type) => type === product.image) ?? null,
    assets: normalizeAssets(product.assets, PRODUCT_IMAGE_TYPES.find((type) => type === product.image) ?? null),
    variants: Array.isArray(product.variants)
      ? product.variants.filter((name): name is string => typeof name === "string" && name.trim().length > 0).map((name) => name.trim())
      : [],
    sizeKind:
      Array.isArray(product.variants) && product.variants.length > 0 && isSizeKind(product.sizeKind) ? product.sizeKind : undefined,
  }));
}

async function writeProducts(products: CatalogProduct[]) {
  await saveProducts(products);
}
