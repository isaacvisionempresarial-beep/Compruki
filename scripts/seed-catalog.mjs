import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

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

const { count, error: countError } = await supabase
  .from("products")
  .select("id", { count: "exact", head: true })
  .eq("tenant_id", tenant.id);

if (countError) {
  console.error("products table:", countError.message);
  console.error("Ejecuta supabase/migrations/002_catalog_orders.sql en el SQL Editor.");
  process.exit(1);
}

console.log("products count before:", count);

if ((count ?? 0) > 0) {
  console.log("ya hay productos, no se siembra");
  process.exit(0);
}

if (!existsSync("data/catalog.json")) {
  console.error("falta data/catalog.json");
  process.exit(1);
}

const products = JSON.parse(readFileSync("data/catalog.json", "utf8"));
const rows = products.map((product) => ({
  id: product.id,
  tenant_id: tenant.id,
  sku: product.sku,
  published: product.published,
  available: product.available,
  updated_at: product.updatedAt,
  document: product,
}));

const { error } = await supabase.from("products").upsert(rows, { onConflict: "id" });
if (error) {
  console.error("seed failed", error.message);
  process.exit(1);
}

console.log("seeded", rows.length, "products");
