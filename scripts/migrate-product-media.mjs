import { createClient } from "@supabase/supabase-js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: tenant, error: tenantError } = await supabase.from("tenants").select("id").eq("slug", "tienda-piloto").maybeSingle();
if (tenantError || !tenant) {
  console.error("tenant", tenantError?.message || "missing");
  process.exit(1);
}

const { data: products, error: productsError } = await supabase
  .from("products")
  .select("id, document")
  .eq("tenant_id", tenant.id);

if (productsError) {
  console.error("products", productsError.message);
  process.exit(1);
}

const imagesDir = path.join(process.cwd(), "data", "images");
if (!existsSync(imagesDir)) {
  console.error("no local images dir");
  process.exit(1);
}

function sniff(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { type: "image/jpeg", ext: ".jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { type: "image/png", ext: ".png" };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { type: "image/webp", ext: ".webp" };
  }
  if (bytes.length > 8 && bytes.toString("ascii", 4, 8) === "ftyp") return { type: "video/mp4", ext: ".mp4" };
  return { type: "image/jpeg", ext: ".jpg" };
}

function localPath(productId, assetId) {
  if (assetId === "portada") return path.join(imagesDir, productId);
  return path.join(imagesDir, `${productId}--${assetId}`);
}

let uploaded = 0;
let skipped = 0;
let failed = 0;

for (const row of products ?? []) {
  const product = row.document;
  const assets = Array.isArray(product?.assets) ? product.assets : [];
  const ids = assets.length > 0 ? assets.map((a) => a.id) : ["portada"];
  for (const assetId of ids) {
    const file = localPath(product.id, assetId);
    if (!existsSync(file)) {
      skipped += 1;
      continue;
    }
    const bytes = readFileSync(file);
    const meta = sniff(bytes);
    const key = `${tenant.id}/${product.id}/${assetId}${meta.ext}`;
    const { error } = await supabase.storage.from("product-media").upload(key, bytes, {
      contentType: meta.type,
      upsert: true,
    });
    if (error) {
      console.error("fail", key, error.message);
      failed += 1;
    } else {
      uploaded += 1;
      console.log("ok", key);
    }
  }
}

// Also upload orphan local files matching prd_*
for (const name of readdirSync(imagesDir)) {
  if (!name.startsWith("prd_")) continue;
  // already covered via catalog assets; skip detailed orphans
}

console.log(JSON.stringify({ uploaded, skipped, failed }, null, 2));
if (failed > 0) process.exit(1);
