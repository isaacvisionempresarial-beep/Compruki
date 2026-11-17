import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

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

const { data: products, error: pErr } = await supabase
  .from("products")
  .select("sku, published, available")
  .order("sku");
const { count: orderCount, error: oErr } = await supabase.from("orders").select("id", { count: "exact", head: true });

console.log(
  JSON.stringify(
    {
      productsError: pErr?.message ?? null,
      products: products ?? [],
      ordersError: oErr?.message ?? null,
      orders: orderCount,
    },
    null,
    2,
  ),
);
