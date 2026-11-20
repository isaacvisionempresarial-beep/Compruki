export type PriceHistoryEntry = {
  id: string;
  changedAt: string;
  actorName: string;
  price: number;
  cost: number;
  shipping: number;
  commissions: number;
  published: boolean;
  available: boolean;
  summary: string;
};

export type CatalogProduct = {
  id: string;
  title: string;
  description: string;
  highlights: string;
  answers: string;
  sku: string;
  externalRef: string;
  category: string;
  price: number;
  cost: number;
  shipping: number;
  commissions: number;
  published: boolean;
  available: boolean;
  image: ProductImageType | null;
  assets: CatalogAsset[];
  variants: string[];
  sizeKind?: SizeKind;
  createdAt: string;
  updatedAt: string;
  history: PriceHistoryEntry[];
};

export type ProductDraft = {
  id?: string;
  title: string;
  description: string;
  highlights: string;
  answers: string;
  sku: string;
  externalRef: string;
  category: string;
  price: number;
  cost: number;
  shipping: number;
  commissions: number;
  published: boolean;
  available: boolean;
  variants: string[];
  sizeKind: SizeKind | "";
};

export function productMargin(product: Pick<CatalogProduct, "price" | "cost" | "shipping" | "commissions">) {
  return product.price - product.cost - product.shipping - product.commissions;
}

export function publicationLabel(product: Pick<CatalogProduct, "published" | "available">) {
  if (!product.available) return "No disponible";
  if (product.published) return "Publicado";
  return "Sin publicar";
}

export const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ProductImageType = (typeof PRODUCT_IMAGE_TYPES)[number];
export const MAX_PRODUCT_IMAGES = 6;
export const MAX_PRODUCT_VIDEO_BYTES = 8_000_000;

export type CatalogAsset = {
  id: string;
  kind: "image" | "video";
  type: ProductImageType | "video/mp4";
};

export function normalizeAssets(raw: unknown, image: ProductImageType | null): CatalogAsset[] {
  const images: CatalogAsset[] = [];
  let video: CatalogAsset | null = null;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const record = item as { id?: unknown; kind?: unknown; type?: unknown };
      const id = typeof record.id === "string" ? record.id : "";
      if (record.kind === "video" && record.type === "video/mp4" && id === "video") {
        video = { id, kind: "video", type: "video/mp4" };
        continue;
      }
      const type = PRODUCT_IMAGE_TYPES.find((entry) => entry === record.type);
      if (record.kind === "image" && type && (id === "portada" || /^ast_[a-z0-9]+$/i.test(id))) {
        images.push({ id, kind: "image", type });
      }
    }
  }
  const photos = images.slice(0, MAX_PRODUCT_IMAGES);
  if (photos.length === 0 && image) photos.push({ id: "portada", kind: "image", type: image });
  return video ? [...photos, video] : photos;
}

export function sniffVideo(bytes: Uint8Array) {
  if (bytes.length < 12 || bytes.length > MAX_PRODUCT_VIDEO_BYTES) return false;
  return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
}

export function sniffImage(bytes: Uint8Array): ProductImageType | null {
  if (bytes.length < 12 || bytes.length > 1_500_000) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (png) return "image/png";
  const webp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (webp) return "image/webp";
  return null;
}

export function parsePesos(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

export function validateProduct(draft: ProductDraft, products: CatalogProduct[]) {
  const title = draft.title.trim();
  const sku = draft.sku.trim().toUpperCase();
  const externalRef = draft.externalRef.trim();

  if (!title) return "Escribe el nombre del producto.";
  if (title.length > 120) return "El nombre no puede pasar de 120 caracteres.";
  if (draft.description.trim().length > 2000) return "La descripción es demasiado larga.";
  if (draft.highlights.trim().length > 2000) return "Las características y beneficios son demasiado largos.";
  if (draft.answers.trim().length > 2000) return "Las respuestas para el comprador son demasiado largas.";
  if (!sku) return "Escribe el SKU interno.";
  if (!/^[A-Z0-9-]{3,32}$/.test(sku)) {
    return "El SKU usa letras, números y guiones, entre 3 y 32 caracteres.";
  }
  if (products.some((product) => product.sku === sku && product.id !== draft.id)) {
    return "Ese SKU ya está en el catálogo.";
  }
  if (externalRef.length > 40) return "La referencia del proveedor es demasiado larga.";
  const category = draft.category.trim();
  if (category.length > 40) return "La categoría no puede pasar de 40 caracteres.";
  if (category && !/^[\p{L}\p{N}]+(?: [\p{L}\p{N}]+)*$/u.test(category)) {
    return "La categoría usa letras y números. Puedes separar palabras con un espacio.";
  }
  if (draft.variants.length > 12) return "Puedes anotar hasta 12 tallas o tamaños.";
  if (draft.variants.length > 0 && draft.sizeKind !== "talla" && draft.sizeKind !== "tamano") {
    return "Elige si el comprador va a escoger una talla o un tamaño.";
  }
  const seen = new Set<string>();
  for (const name of draft.variants) {
    if (!validSizeName(name)) {
      return "Cada talla o tamaño puede tener hasta 24 caracteres: letras, números, punto, guion o barra. Escribe una por línea.";
    }
    const key = name.toLocaleLowerCase("es");
    if (seen.has(key)) return "Hay dos tallas o tamaños con el mismo nombre.";
    seen.add(key);
  }
  if (!Number.isInteger(draft.price) || draft.price <= 0) {
    return "Escribe un precio de venta mayor que cero, en pesos y sin centavos.";
  }
  if (!Number.isInteger(draft.cost) || draft.cost < 0) return "Escribe el costo del producto en pesos.";
  if (!Number.isInteger(draft.shipping) || draft.shipping < 0) return "Escribe el envío estimado en pesos.";
  if (!Number.isInteger(draft.commissions) || draft.commissions < 0) {
    return "Escribe las comisiones estimadas en pesos.";
  }
  return null;
}

export function changeSummary(previous: CatalogProduct | null, next: ProductDraft) {
  if (!previous) return "Alta del producto.";

  const changes: string[] = [];
  if (previous.price !== next.price) changes.push("Cambió el precio de venta.");
  if (previous.cost !== next.cost) changes.push("Cambió el costo.");
  if (previous.shipping !== next.shipping) changes.push("Cambió el envío estimado.");
  if (previous.commissions !== next.commissions) changes.push("Cambiaron las comisiones estimadas.");
  if (previous.published !== next.published) {
    changes.push(next.published ? "Quedó publicado en la tienda." : "Quedó oculto de la tienda.");
  }
  if (previous.sku !== next.sku.trim().toUpperCase()) {
    changes.push(`Cambió el SKU de ${previous.sku} a ${next.sku.trim().toUpperCase()}.`);
  }
  if (previous.externalRef.trim() !== next.externalRef.trim()) {
    changes.push(next.externalRef.trim() ? "Cambió la referencia del proveedor." : "Quitó la referencia del proveedor.");
  }
  if (previous.available !== next.available) {
    changes.push(next.available ? "Volvió a estar disponible." : "Quedó marcado como no disponible.");
  }
  const previousCategory = previous.category.trim();
  const nextCategory = next.category.trim();
  if (previousCategory !== nextCategory) {
    changes.push(nextCategory ? `Quedó en la categoría ${nextCategory}.` : "Quedó sin categoría.");
  }
  if (!sameList(previous.variants, next.variants) || (next.variants.length > 0 && previous.sizeKind !== next.sizeKind)) {
    changes.push(sizeListSummary(next.sizeKind, next.variants));
  }
  if (previous.title.trim() !== next.title.trim()) {
    changes.push(next.title.trim() ? "Cambió el título." : "Quitó el título.");
  }
  if (previous.description.trim() !== next.description.trim()) {
    changes.push(next.description.trim() ? "Actualizó la descripción." : "Quitó la descripción.");
  }
  if (previous.highlights.trim() !== next.highlights.trim()) {
    changes.push(next.highlights.trim() ? "Actualizó las características y beneficios." : "Quitó las características y beneficios.");
  }
  if (previous.answers.trim() !== next.answers.trim()) {
    changes.push(next.answers.trim() ? "Actualizó las respuestas para el comprador." : "Quitó las respuestas para el comprador.");
  }
  return changes.join(" ");
}

const SIZE_NAME = /^[\p{L}\p{N}]+(?:[ ./-][\p{L}\p{N}]+)*$/u;

export type SizeKind = "talla" | "tamano";

export function isSizeKind(value: unknown): value is SizeKind {
  return value === "talla" || value === "tamano";
}

export function validSizeName(name: string) {
  return name.length > 0 && name.length <= 24 && SIZE_NAME.test(name);
}

export function sizeChoiceLabel(kind: SizeKind | undefined, name: string) {
  const value = name.trim();
  if (!value) return "";
  if (kind === "tamano") return `Tamaño ${value}`;
  if (kind === "talla") return `Talla ${value}`;
  return value;
}

export function sizeChoiceSentence(kind: SizeKind, name: string) {
  const value = name.trim();
  if (!value) {
    return kind === "tamano"
      ? "Elige el tamaño para identificar cuál vas a pedir."
      : "Elige la talla para identificar cuál vas a pedir.";
  }
  return kind === "tamano"
    ? `Vas a pedir el tamaño ${value}. El precio no cambia. Todavía no es un pedido.`
    : `Vas a pedir la talla ${value}. El precio no cambia. Todavía no es un pedido.`;
}

function sizeListSummary(kind: SizeKind | "", names: string[]) {
  if (names.length === 0) return "Quitó las tallas o tamaños.";
  const label = kind === "tamano" ? "los tamaños" : "las tallas";
  return `Quedaron ${label} ${joinNames(names)}.`;
}

export function parseVariants(raw: string) {
  return raw
    .split(/\n|,/)
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

export function variantFits(variants: string[], variant: string) {
  if (variants.length === 0) return variant === "";
  return variants.includes(variant);
}

function sameList(left: string[], right: string[]) {
  return left.length === right.length && left.every((name, index) => name === right[index]);
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

export function bogotaNow(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00-05:00`;
}

function entry(
  id: string,
  changedAt: string,
  product: Omit<CatalogProduct, "id" | "createdAt" | "updatedAt" | "history" | "category" | "image" | "assets" | "variants" | "highlights" | "answers">,
  summary: string,
): PriceHistoryEntry {
  return {
    id,
    changedAt,
    actorName: "Ana Ríos",
    price: product.price,
    cost: product.cost,
    shipping: product.shipping,
    commissions: product.commissions,
    published: product.published,
    available: product.available,
    summary,
  };
}

export function seedCatalog(): CatalogProduct[] {
  const base = {
    externalRef: "",
    category: "",
    image: null,
    assets: [] as CatalogAsset[],
    variants: [] as string[],
    highlights: "",
    answers: "",
    createdAt: "2026-11-01T09:00:00-05:00",
    updatedAt: "2026-11-02T11:30:00-05:00",
  };

  const organizador = {
    title: "Organizador de cocina",
    description: "Cajón con divisiones para utensilios. Medidas y material se confirman antes de publicar fotos.",
    sku: "ORG-COC-01",
    price: 89900,
    cost: 41000,
    shipping: 12000,
    commissions: 4500,
    published: true,
    available: true,
  };
  const audifonos = {
    title: "Audífonos inalámbricos",
    description: "Audífonos con estuche. La ficha pública solo usa datos revisados.",
    sku: "AUD-INAL-01",
    price: 129000,
    cost: 68000,
    shipping: 9000,
    commissions: 6400,
    published: true,
    available: true,
  };
  const taza = {
    title: "Taza térmica",
    description: "Borrador. Falta revisar la descripción antes de mostrarla en la tienda.",
    sku: "TAZ-TER-01",
    price: 45900,
    cost: 18000,
    shipping: 8000,
    commissions: 2300,
    published: false,
    available: true,
  };
  const vasos = {
    title: "Set de vasos",
    description: "Sigue en el catálogo, pero no se puede vender hasta reponer unidades.",
    sku: "VAS-SET-01",
    price: 54000,
    cost: 21000,
    shipping: 15000,
    commissions: 2700,
    published: true,
    available: false,
  };

  return [
    {
      id: "prd_organizador",
      ...base,
      ...organizador,
      history: [entry("his_organizador", base.updatedAt, { ...organizador, description: organizador.description, sku: organizador.sku, externalRef: "" }, "Alta del producto.")],
    },
    {
      id: "prd_audifonos",
      ...base,
      ...audifonos,
      history: [entry("his_audifonos", base.updatedAt, { ...audifonos, description: audifonos.description, sku: audifonos.sku, externalRef: "" }, "Alta del producto.")],
    },
    {
      id: "prd_taza",
      ...base,
      ...taza,
      history: [entry("his_taza", base.createdAt, { ...taza, description: taza.description, sku: taza.sku, externalRef: "" }, "Alta del producto.")],
    },
    {
      id: "prd_vasos",
      ...base,
      ...vasos,
      updatedAt: "2026-11-02T16:10:00-05:00",
      history: [
        entry("his_vasos_alta", base.createdAt, { ...vasos, available: true, description: vasos.description, sku: vasos.sku, externalRef: "" }, "Alta del producto."),
        entry("his_vasos_stock", "2026-11-02T16:10:00-05:00", { ...vasos, description: vasos.description, sku: vasos.sku, externalRef: "" }, "Quedó marcado como no disponible."),
      ],
    },
  ];
}
