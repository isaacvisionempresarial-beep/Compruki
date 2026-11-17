import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { ProductImageType } from "@/lib/catalog";
import { getPilotTenantId } from "@/server/tenant";

export const PRODUCT_MEDIA_BUCKET = "product-media";

const localImagesDir = path.join(process.cwd(), "data", "images");

export type MediaContentType = ProductImageType | "video/mp4";

export function mediaObjectKey(tenantId: string, productId: string, assetId: string, contentType: MediaContentType) {
  const ext = extensionFor(contentType);
  return `${tenantId}/${productId}/${assetId}${ext}`;
}

export function mediaObjectPrefix(tenantId: string, productId: string) {
  return `${tenantId}/${productId}`;
}

function extensionFor(contentType: MediaContentType) {
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "video/mp4") return ".mp4";
  return ".jpg";
}

export async function uploadProductMedia(
  productId: string,
  assetId: string,
  bytes: Buffer,
  contentType: MediaContentType,
) {
  const tenantId = await getPilotTenantId();
  const key = mediaObjectKey(tenantId, productId, assetId, contentType);
  const supabase = createAdminSupabase();
  const { error } = await supabase.storage.from(PRODUCT_MEDIA_BUCKET).upload(key, bytes, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`No se pudo subir el archivo: ${error.message}`);
  }
  return key;
}

export async function removeProductMediaKeys(keys: string[]) {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return;
  const supabase = createAdminSupabase();
  const { error } = await supabase.storage.from(PRODUCT_MEDIA_BUCKET).remove(unique);
  if (error) {
    throw new Error(`No se pudo borrar el archivo: ${error.message}`);
  }
}

export async function removeAllProductMedia(productId: string) {
  const tenantId = await getPilotTenantId();
  const prefix = mediaObjectPrefix(tenantId, productId);
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.storage.from(PRODUCT_MEDIA_BUCKET).list(prefix, { limit: 100 });
  if (error) {
    throw new Error(`No se pudo listar archivos del producto: ${error.message}`);
  }
  const keys = (data ?? []).map((item) => `${prefix}/${item.name}`);
  await removeProductMediaKeys(keys);
}

export async function downloadProductMedia(
  productId: string,
  assetId: string,
  contentType: MediaContentType,
): Promise<{ type: MediaContentType; bytes: Buffer } | null> {
  const tenantId = await getPilotTenantId();
  const key = mediaObjectKey(tenantId, productId, assetId, contentType);
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.storage.from(PRODUCT_MEDIA_BUCKET).download(key);

  if (!error && data) {
    const buffer = Buffer.from(await data.arrayBuffer());
    return { type: contentType, bytes: buffer };
  }

  // Fallback: archivos locales del piloto mientras se migra.
  const local = localAssetPath(productId, assetId);
  if (local && existsSync(local)) {
    return { type: contentType, bytes: readFileSync(local) };
  }

  // Si el content-type no coincide con la extensión subida, probar otras.
  if (contentType !== "video/mp4") {
    for (const type of ["image/jpeg", "image/png", "image/webp"] as const) {
      if (type === contentType) continue;
      const altKey = mediaObjectKey(tenantId, productId, assetId, type);
      const alt = await supabase.storage.from(PRODUCT_MEDIA_BUCKET).download(altKey);
      if (!alt.error && alt.data) {
        return { type, bytes: Buffer.from(await alt.data.arrayBuffer()) };
      }
    }
  }

  return null;
}

/** Ruta local histórica: data/images/{productId} o {productId}--{assetId} */
export function localAssetPath(productId: string, assetId: string) {
  if (!/^prd_[a-z0-9]+$/i.test(productId)) return null;
  if (assetId === "portada") return path.join(localImagesDir, productId);
  if (assetId === "video" || /^ast_[a-z0-9]+$/i.test(assetId)) {
    return path.join(localImagesDir, `${productId}--${assetId}`);
  }
  return null;
}

export function localImagesDirectory() {
  return localImagesDir;
}
