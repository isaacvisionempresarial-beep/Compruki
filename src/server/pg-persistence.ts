import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { seedCatalog, type CatalogProduct } from "@/lib/catalog";
import type { StoreOrder } from "@/lib/store-order";
import { foreignIds } from "@/lib/tenant-scope";
import { getPilotTenantId } from "@/server/tenant";

const catalogFile = path.join(process.cwd(), "data", "catalog.json");
const ordersFile = path.join(process.cwd(), "data", "orders.json");

export async function loadProducts(): Promise<CatalogProduct[]> {
  const tenantId = await getPilotTenantId();
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from("products").select("document").eq("tenant_id", tenantId);

  if (error) {
    throw new Error(
      `No se pudo leer el catálogo: ${error.message}. ¿Ejecutaste supabase/migrations/002_catalog_orders.sql?`,
    );
  }

  const docs = (data ?? []).map((row) => row.document as CatalogProduct).filter(Boolean);
  if (docs.length === 0) {
    const seeded = loadLocalCatalogOrSeed();
    await saveProducts(seeded);
    return seeded;
  }

  return docs;
}

export async function saveProducts(products: CatalogProduct[]): Promise<void> {
  const tenantId = await getPilotTenantId();
  const supabase = createAdminSupabase();

  const rows = products.map((product) => ({
    id: product.id,
    tenant_id: tenantId,
    sku: product.sku,
    published: product.published,
    available: product.available,
    updated_at: product.updatedAt,
    document: product,
  }));

  if (rows.length > 0) {
    await refuseForeignIds(supabase, "products", tenantId, rows.map((row) => row.id));
    const { error: upsertError } = await supabase.from("products").upsert(rows, { onConflict: "id" });
    if (upsertError) {
      throw new Error(`No se pudo guardar el catálogo: ${upsertError.message}`);
    }
  }

  const keepIds = new Set(products.map((product) => product.id));
  const { data: existing, error: listError } = await supabase.from("products").select("id").eq("tenant_id", tenantId);
  if (listError) {
    throw new Error(`No se pudo sincronizar el catálogo: ${listError.message}`);
  }

  const removeIds = (existing ?? []).map((row) => row.id as string).filter((id) => !keepIds.has(id));
  if (removeIds.length > 0) {
    const { error: deleteError } = await supabase.from("products").delete().in("id", removeIds).eq("tenant_id", tenantId);
    if (deleteError) {
      throw new Error(`No se pudieron quitar productos: ${deleteError.message}`);
    }
  }
}

export async function loadOrders(): Promise<StoreOrder[]> {
  const tenantId = await getPilotTenantId();
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from("orders").select("document").eq("tenant_id", tenantId);

  if (error) {
    throw new Error(
      `No se pudieron leer los pedidos: ${error.message}. ¿Ejecutaste supabase/migrations/002_catalog_orders.sql?`,
    );
  }

  const docs = (data ?? []).map((row) => row.document as StoreOrder).filter(Boolean);
  if (docs.length === 0) {
    const local = loadLocalOrders();
    if (local.length > 0) {
      await saveOrders(local);
      return local;
    }
    return [];
  }

  return docs;
}

export async function saveOrders(orders: StoreOrder[]): Promise<void> {
  const tenantId = await getPilotTenantId();
  const supabase = createAdminSupabase();

  const rows = orders.map((order) => ({
    id: order.id,
    tenant_id: tenantId,
    number: order.number,
    phone: order.phone,
    idempotency_key: order.idempotencyKey,
    created_at: order.createdAt,
    customer_user_id: order.customerUserId ?? null,
    document: order,
  }));

  if (rows.length > 0) {
    await refuseForeignIds(supabase, "orders", tenantId, rows.map((row) => row.id));
    let { error: upsertError } = await supabase.from("orders").upsert(rows, { onConflict: "id" });
    if (upsertError && upsertError.message.includes("customer_user_id")) {
      const legacy = rows.map(({ customer_user_id: _drop, ...rest }) => rest);
      ({ error: upsertError } = await supabase.from("orders").upsert(legacy, { onConflict: "id" }));
    }
    if (upsertError) {
      throw new Error(`No se pudieron guardar los pedidos: ${upsertError.message}`);
    }
  }

  const keepIds = new Set(orders.map((order) => order.id));
  const { data: existing, error: listError } = await supabase.from("orders").select("id").eq("tenant_id", tenantId);
  if (listError) {
    throw new Error(`No se pudo sincronizar pedidos: ${listError.message}`);
  }

  const removeIds = (existing ?? []).map((row) => row.id as string).filter((id) => !keepIds.has(id));
  if (removeIds.length > 0) {
    const { error: deleteError } = await supabase.from("orders").delete().in("id", removeIds).eq("tenant_id", tenantId);
    if (deleteError) {
      throw new Error(`No se pudieron quitar pedidos: ${deleteError.message}`);
    }
  }
}

async function refuseForeignIds(
  supabase: ReturnType<typeof createAdminSupabase>,
  table: "products" | "orders",
  tenantId: string,
  ids: string[],
) {
  if (ids.length === 0) return;
  const { data, error } = await supabase.from(table).select("id, tenant_id").in("id", ids);
  if (error) {
    throw new Error(`No se pudo comprobar la tienda de ${table}: ${error.message}`);
  }
  const foreign = foreignIds(
    (data ?? []).map((row) => ({
      id: String(row.id),
      tenant_id: row.tenant_id == null ? null : String(row.tenant_id),
    })),
    tenantId,
  );
  if (foreign.length > 0) {
    throw new Error("Hay un identificador de otra tienda. No se escribió nada.");
  }
}

function loadLocalCatalogOrSeed(): CatalogProduct[] {
  try {
    if (existsSync(catalogFile)) {
      const parsed = JSON.parse(readFileSync(catalogFile, "utf8")) as CatalogProduct[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // cae al seed
  }
  return seedCatalog();
}

function loadLocalOrders(): StoreOrder[] {
  try {
    if (!existsSync(ordersFile)) return [];
    const parsed = JSON.parse(readFileSync(ordersFile, "utf8")) as StoreOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
