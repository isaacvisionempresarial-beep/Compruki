import { sniffImage } from "@/lib/catalog";

const MAX_BYTES = 1_200_000;

export async function prepareProductImage(file: File): Promise<{ file: File; reduced: boolean } | { error: string }> {
  if (file.size === 0) return { error: "Ese archivo está vacío." };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { error: "No pude abrir esa imagen. Elige un JPG, PNG o WebP." };
  }

  try {
    if (file.size <= MAX_BYTES && (await sniffFile(file))) return { file, reduced: false };
    const prepared = await compress(bitmap, jpegName(file.name));
    if (!prepared) return { error: "Esa imagen sigue pesando demasiado. Elige una más pequeña." };
    return { file: prepared, reduced: true };
  } finally {
    bitmap.close();
  }
}

async function sniffFile(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return sniffImage(bytes) !== null;
}

function jpegName(original: string) {
  const base = original.replace(/\.[^.]+$/, "").trim() || "producto";
  return `${base.slice(0, 80)}.jpg`;
}

async function compress(bitmap: ImageBitmap, name: string) {
  for (const edge of [1600, 1280, 1024, 800]) {
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const blob = await draw(bitmap, edge, quality);
      if (blob && blob.size > 0 && blob.size <= MAX_BYTES) {
        return new File([blob], name, { type: "image/jpeg" });
      }
    }
  }
  return null;
}

function draw(bitmap: ImageBitmap, edge: number, quality: number) {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}
