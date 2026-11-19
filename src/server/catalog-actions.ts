"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MAX_PRODUCT_VIDEO_BYTES, parsePesos, parseVariants, sniffImage, sniffVideo, type CatalogProduct, type ProductDraft, type ProductImageType } from "@/lib/catalog";
import { assertPanelAccess } from "@/server/panel-auth";
import { deactivateProduct, deleteProduct, getCatalogProductById, saveProduct, type MediaUpdate } from "@/server/catalog-store";
import { countOrdersForSku } from "@/server/order-store";

export type SaveProductState = {
  error: string | null;
  productId: string | null;
  message: string | null;
};

export type ProductLifecycleState = {
  error: string | null;
  message: string | null;
};

export async function saveProductAction(_state: SaveProductState, formData: FormData): Promise<SaveProductState> {
  const access = await assertPanelAccess();
    if (!access) {
      return { error: "Tu sesión no permite cambiar el catálogo.", productId: null, message: null };
    }

  const price = parsePesos(String(formData.get("price") ?? ""));
  const cost = parsePesos(String(formData.get("cost") ?? ""));
  const shipping = parsePesos(String(formData.get("shipping") ?? ""));
  const commissions = parsePesos(String(formData.get("commissions") ?? ""));

  const media = await readMedia(formData);
  if ("error" in media) return { error: media.error, productId: null, message: null };

  const draft: ProductDraft = {
    id: String(formData.get("id") ?? "") || undefined,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    highlights: String(formData.get("highlights") ?? ""),
    answers: String(formData.get("answers") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    externalRef: String(formData.get("externalRef") ?? ""),
    category: String(formData.get("category") ?? ""),
    price: price ?? Number.NaN,
    cost: cost ?? Number.NaN,
    shipping: shipping ?? Number.NaN,
    commissions: commissions ?? Number.NaN,
    published: formData.get("published") === "on",
    available: formData.get("unavailable") !== "on",
    variants: parseVariants(String(formData.get("variants") ?? "")),
    sizeKind: formData.get("sizeKind") === "tamano" ? "tamano" : formData.get("sizeKind") === "talla" ? "talla" : "",
  };

  const before = draft.id ? await getCatalogProductById(draft.id) : null;
  if (draft.id && !before) return { error: "Ese producto ya no está en el catálogo.", productId: null, message: null };

  if (access.role !== "owner") {
    if (!before) {
      return { error: "Solo el propietario puede crear productos.", productId: null, message: null };
    }
    const blocked = commercialChanges(before, draft);
    if (blocked.length > 0) {
      return {
        error: `Solo el propietario puede cambiar ${blocked.join(", ")}.`,
        productId: null,
        message: null,
      };
    }
  }

  const previousSku = String(formData.get("previousSku") ?? "");
  const result = await saveProduct(draft, access.actorName, media);
  if (result.error || !result.product) {
    return { error: result.error ?? "No se pudo guardar el producto.", productId: null, message: null };
  }

  revalidatePath("/panel/catalogo");
  revalidatePath(`/panel/catalogo/${result.product.sku}`);
  revalidatePath("/panel/rentabilidad");
  revalidatePath("/tienda");
  revalidatePath(`/tienda/producto/${result.product.sku}`);
  const created = !String(formData.get("id") ?? "");
  if (created || previousSku.trim().toUpperCase() !== result.product.sku) {
    redirect(`/panel/catalogo/${result.product.sku}`);
  }
  return {
    error: null,
    productId: result.product.id,
    message: savedProductMessage(before, result.product),
  };
}

export async function deleteProductAction(
  _state: ProductLifecycleState,
  formData: FormData,
): Promise<ProductLifecycleState> {
  const access = await assertPanelAccess();
    if (!access) {
      return { error: "Tu sesión no permite cambiar el catálogo.", message: null };
    }

  if (access.role !== "owner") {
    return { error: "Solo el propietario puede eliminar productos.", message: null };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "No encontré ese producto.", message: null };

  const current = await getCatalogProductById(id);
  if (!current) return { error: "Ese producto ya no está en el catálogo.", message: null };

  const result = await deleteProduct(id, await countOrdersForSku(current.sku));
  if (result.error || !result.deleted) {
    return { error: result.error ?? "No se pudo eliminar el producto.", message: null };
  }

  revalidatePath("/panel/catalogo");
  revalidatePath("/panel/rentabilidad");
  revalidatePath("/tienda");
  if (result.sku) {
    revalidatePath(`/panel/catalogo/${result.sku}`);
    revalidatePath(`/tienda/producto/${result.sku}`);
  }
  redirect("/panel/catalogo");
}

export async function deactivateProductAction(
  _state: ProductLifecycleState,
  formData: FormData,
): Promise<ProductLifecycleState> {
  const access = await assertPanelAccess();
    if (!access) {
      return { error: "Tu sesión no permite cambiar el catálogo.", message: null };
    }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "No encontré ese producto.", message: null };

  const result = await deactivateProduct(id, access.actorName);
  if (result.error || !result.product) {
    return { error: result.error ?? "No se pudo marcar como no disponible.", message: null };
  }

  revalidatePath("/panel/catalogo");
  revalidatePath(`/panel/catalogo/${result.product.sku}`);
  revalidatePath("/panel/rentabilidad");
  revalidatePath("/tienda");
  revalidatePath(`/tienda/producto/${result.product.sku}`);
  return {
    error: null,
    message: result.product.published
      ? "Marcado como no disponible. No se puede pedir. Sigue publicado. El precio no cambió."
      : "Marcado como no disponible. No se puede pedir. Sigue sin publicar. El precio no cambió.",
  };
}

function savedProductMessage(before: CatalogProduct | null, saved: CatalogProduct) {
  const priceSame = !!before && before.price === saved.price;
  const publishedSame = !!before && before.published === saved.published;
  const kept = "El margen de la ficha no es dinero cobrado. Los pedidos ya anotados siguen con sus cifras.";
  if (priceSame && publishedSame) {
    return `Producto guardado. El precio y la publicación no cambiaron. ${kept}`;
  }
  if (!priceSame && !publishedSame) {
    return `Producto guardado. Cambiaron el precio y la publicación de la ficha. ${kept}`;
  }
  if (!priceSame) {
    return `Producto guardado. Cambió el precio de la ficha. La publicación no cambió. ${kept}`;
  }
  return `Producto guardado. Cambió la publicación de la ficha. El precio no cambió. ${kept}`;
}

function commercialChanges(current: CatalogProduct, draft: ProductDraft) {
  const blocked: string[] = [];
  if (draft.price !== current.price) blocked.push("el precio");
  if (draft.cost !== current.cost) blocked.push("el costo");
  if (draft.shipping !== current.shipping) blocked.push("el envío");
  if (draft.commissions !== current.commissions) blocked.push("las comisiones");
  if (draft.published !== current.published) blocked.push("la publicación");
  if (draft.sku.trim().toUpperCase() !== current.sku) blocked.push("el SKU");
  return blocked;
}

async function readMedia(formData: FormData): Promise<MediaUpdate | { error: string }> {
  const addImages: { bytes: Buffer; type: ProductImageType }[] = [];
  for (const uploaded of formData.getAll("images")) {
    if (!(uploaded instanceof File) || uploaded.size === 0) continue;
    if (uploaded.size > 1_500_000) return { error: "Cada foto puede pesar hasta 1,5 MB." };
    const bytes = new Uint8Array(await uploaded.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type) return { error: "Usa fotos JPG, PNG o WebP." };
    addImages.push({ bytes: Buffer.from(bytes), type });
  }

  const uploadedVideo = formData.get("video");
  let video: Buffer | null = null;
  if (uploadedVideo instanceof File && uploadedVideo.size > 0) {
    if (uploadedVideo.size > MAX_PRODUCT_VIDEO_BYTES) return { error: "El video puede pesar hasta 8 MB." };
    const bytes = new Uint8Array(await uploadedVideo.arrayBuffer());
    if (!sniffVideo(bytes)) return { error: "El video tiene que ser MP4." };
    video = Buffer.from(bytes);
  }

  return {
    addImages,
    video,
    clearVideo: formData.get("clearVideo") === "on",
    removeIds: formData.getAll("removeAsset").map((value) => String(value)),
  };
}
