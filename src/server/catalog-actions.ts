"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MAX_PRODUCT_VIDEO_BYTES, parsePesos, parseVariants, sniffImage, sniffVideo, type ProductDraft, type ProductImageType } from "@/lib/catalog";
import { DEMO_USER } from "@/lib/demo-account";
import { SESSION_COOKIE, SESSION_VALUE } from "@/lib/session";
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
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
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

  const previousSku = String(formData.get("previousSku") ?? "");
  const result = saveProduct(draft, DEMO_USER.name, media);
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
    message: "Producto guardado. El precio, el costo, la categoría, las tallas o tamaños, las características, las respuestas, las fotos, el video y la publicación quedaron registrados.",
  };
}

export async function deleteProductAction(
  _state: ProductLifecycleState,
  formData: FormData,
): Promise<ProductLifecycleState> {
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    return { error: "Tu sesión no permite cambiar el catálogo.", message: null };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "No encontré ese producto.", message: null };

  const current = getCatalogProductById(id);
  if (!current) return { error: "Ese producto ya no está en el catálogo.", message: null };

  const result = deleteProduct(id, countOrdersForSku(current.sku));
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
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) {
    return { error: "Tu sesión no permite cambiar el catálogo.", message: null };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "No encontré ese producto.", message: null };

  const result = deactivateProduct(id, DEMO_USER.name);
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
    message: "Producto marcado como no disponible. Sigue en el catálogo, pero no se puede pedir.",
  };
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
