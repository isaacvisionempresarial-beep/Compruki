import { isSizeKind, type SizeKind } from "@/lib/catalog";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getPilotTenantId } from "@/server/tenant";

export type CustomerCartLine = {
  sku: string;
  quantity: number;
  variant: string;
  sizeKind?: SizeKind;
};

function missingTable(message: string) {
  return message.includes("schema cache") || message.includes("does not exist");
}

export async function loadCustomerCart(userId: string): Promise<CustomerCartLine[]> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("customer_cart_items")
      .select("sku, quantity, variant, size_kind")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);
    if (error) {
      if (missingTable(error.message)) return [];
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => ({
      sku: String(row.sku),
      quantity: Math.min(5, Math.max(1, Number(row.quantity) || 1)),
      variant: typeof row.variant === "string" ? row.variant : "",
      ...(isSizeKind(row.size_kind) ? { sizeKind: row.size_kind as SizeKind } : {}),
    }));
  } catch {
    return [];
  }
}

export async function saveCustomerCart(userId: string, lines: CustomerCartLine[]) {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { error: delError } = await supabase
      .from("customer_cart_items")
      .delete()
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);
    if (delError) {
      if (missingTable(delError.message)) return { error: null as string | null, skipped: true };
      return { error: delError.message, skipped: false };
    }

    if (lines.length === 0) return { error: null, skipped: false };

    const rows = lines.map((line) => ({
      user_id: userId,
      tenant_id: tenantId,
      sku: line.sku,
      quantity: Math.min(5, Math.max(1, line.quantity)),
      variant: line.variant ?? "",
      size_kind: line.sizeKind ?? null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("customer_cart_items").insert(rows);
    if (error) return { error: error.message, skipped: false };
    return { error: null, skipped: false };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo guardar el carrito.", skipped: false };
  }
}

/** Fusiona carrito local con el del servidor (suma cantidades, tope 5). */
export function mergeCartLines(server: CustomerCartLine[], local: CustomerCartLine[]): CustomerCartLine[] {
  const map = new Map<string, CustomerCartLine>();
  for (const line of [...server, ...local]) {
    const key = `${line.sku}\n${line.variant}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...line, quantity: Math.min(5, line.quantity) });
      continue;
    }
    map.set(key, {
      ...prev,
      quantity: Math.min(5, prev.quantity + line.quantity),
      ...(line.sizeKind ? { sizeKind: line.sizeKind } : prev.sizeKind ? { sizeKind: prev.sizeKind } : {}),
    });
  }
  return [...map.values()];
}
