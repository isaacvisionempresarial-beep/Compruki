import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPilotTenantId } from "@/server/tenant";

export type CustomerProfile = {
  userId: string;
  tenantId: string;
  displayName: string;
  phone: string;
  emailOrderUpdates: boolean;
  email: string;
};

export type CustomerSession = {
  user: User;
  profile: CustomerProfile;
};

/** True si el usuario es miembro del panel (owner/operator). */
export async function userHasPanelMembership(userId: string): Promise<boolean> {
  const supabase = createAdminSupabase();
  const { data } = await supabase.from("memberships").select("id").eq("user_id", userId).limit(1).maybeSingle();
  return Boolean(data?.id);
}

export async function getAuthUser(): Promise<User | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function ensureCustomerProfile(user: User): Promise<CustomerProfile | null> {
  if (await userHasPanelMembership(user.id)) return null;

  const tenantId = await getPilotTenantId();
  const supabase = createAdminSupabase();
  const displayName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()) ||
    user.email?.split("@")[0]?.trim() ||
    "Cliente";

  const { data: existing } = await supabase
    .from("customer_profiles")
    .select("user_id, tenant_id, display_name, phone, email_order_updates")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.user_id) {
    return {
      userId: user.id,
      tenantId: String(existing.tenant_id),
      displayName: String(existing.display_name ?? displayName),
      phone: String(existing.phone ?? ""),
      emailOrderUpdates: existing.email_order_updates !== false,
      email: user.email ?? "",
    };
  }

  const { error } = await supabase.from("customer_profiles").upsert(
    {
      user_id: user.id,
      tenant_id: tenantId,
      display_name: displayName.replace(/\s+/g, " ").slice(0, 80),
      phone: "",
      email_order_updates: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    if (error.message.includes("schema cache") || error.message.includes("does not exist")) {
      // Migración 017 pendiente: sesión usable; carrito/perfil no persisten en DB.
      return {
        userId: user.id,
        tenantId,
        displayName: displayName.replace(/\s+/g, " ").slice(0, 80),
        phone: "",
        emailOrderUpdates: true,
        email: user.email ?? "",
      };
    }
    throw new Error(`No se pudo crear el perfil de comprador: ${error.message}`);
  }

  return {
    userId: user.id,
    tenantId,
    displayName: displayName.replace(/\s+/g, " ").slice(0, 80),
    phone: "",
    emailOrderUpdates: true,
    email: user.email ?? "",
  };
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const user = await getAuthUser();
  if (!user) return null;
  if (await userHasPanelMembership(user.id)) return null;
  const profile = await ensureCustomerProfile(user);
  if (!profile) return null;
  return { user, profile };
}

export async function assertCustomerSession(): Promise<CustomerSession | null> {
  return getCustomerSession();
}

export async function requireCustomerSession(nextPath = "/tienda/pagar"): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) {
    const user = await getAuthUser();
    if (user && (await userHasPanelMembership(user.id))) {
      redirect("/panel");
    }
    const next = encodeURIComponent(nextPath.startsWith("/") ? nextPath : `/${nextPath}`);
    redirect(`/tienda/cuenta?next=${next}`);
  }
  return session;
}

export async function updateCustomerProfile(
  userId: string,
  patch: { displayName?: string; phone?: string; emailOrderUpdates?: boolean },
) {
  const supabase = createAdminSupabase();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.displayName !== undefined) row.display_name = patch.displayName.trim().replace(/\s+/g, " ").slice(0, 80);
  if (patch.phone !== undefined) row.phone = patch.phone.replace(/\D/g, "").slice(0, 10);
  if (patch.emailOrderUpdates !== undefined) row.email_order_updates = patch.emailOrderUpdates;

  const { data, error } = await supabase
    .from("customer_profiles")
    .update(row)
    .eq("user_id", userId)
    .select("user_id, phone")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data?.user_id) {
    const tenantId = await getPilotTenantId();
    const { error: upsertError } = await supabase.from("customer_profiles").upsert(
      {
        user_id: userId,
        tenant_id: tenantId,
        display_name: typeof row.display_name === "string" ? row.display_name : "",
        phone: typeof row.phone === "string" ? row.phone : "",
        email_order_updates: typeof row.email_order_updates === "boolean" ? row.email_order_updates : true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (upsertError) return { error: upsertError.message };
  }
  return { error: null };
}

/** True si existe la tabla customer_profiles (migración 017). */
export async function probeCustomerProfilesTable(): Promise<boolean> {
  try {
    const supabase = createAdminSupabase();
    const { error } = await supabase.from("customer_profiles").select("user_id").limit(1);
    if (!error) return true;
    return !(error.message.includes("schema cache") || error.message.includes("does not exist"));
  } catch {
    return false;
  }
}

export type RegisteredStoreAccount = {
  userId: string;
  email: string;
  displayName: string;
  phone: string;
  provider: string;
  createdAt: string;
  orderCount: number;
  emailOrderUpdates: boolean;
};

/** Cuentas de comprador (Auth), con o sin pedidos. Excluye miembros del panel. */
export async function listRegisteredStoreAccounts(): Promise<RegisteredStoreAccount[]> {
  const supabase = createAdminSupabase();
  const [{ data: memberships }, { data: authPage }, { data: profiles }, ordersModule] = await Promise.all([
    supabase.from("memberships").select("user_id"),
    supabase.auth.admin.listUsers({ page: 1, perPage: 200 }),
    supabase.from("customer_profiles").select("user_id, display_name, phone, email_order_updates, created_at"),
    import("@/server/order-store").then((mod) => mod.listOrders()),
  ]);

  const memberIds = new Set((memberships ?? []).map((row) => String(row.user_id)));
  const profileByUser = new Map(
    (profiles ?? []).map((row) => [
      String(row.user_id),
      {
        displayName: String(row.display_name ?? ""),
        phone: String(row.phone ?? ""),
        emailOrderUpdates: row.email_order_updates !== false,
        createdAt: String(row.created_at ?? ""),
      },
    ]),
  );

  const orderCountByUser = new Map<string, number>();
  for (const order of ordersModule) {
    if (!order.customerUserId) continue;
    orderCountByUser.set(order.customerUserId, (orderCountByUser.get(order.customerUserId) ?? 0) + 1);
  }

  const users = authPage.users ?? [];
  return users
    .filter((user) => !memberIds.has(user.id))
    .map((user) => {
      const profile = profileByUser.get(user.id);
      const identities = Array.isArray(user.identities) ? user.identities : [];
      const providersMeta = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [];
      const provider =
        user.app_metadata?.provider === "google" ||
        providersMeta.includes("google") ||
        identities.some((item) => item.provider === "google")
          ? "Google"
          : "Correo";
      const metaName =
        (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
        (typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()) ||
        "";
      return {
        userId: user.id,
        email: user.email ?? "",
        displayName: (profile?.displayName || metaName || user.email?.split("@")[0] || "Cliente").trim(),
        phone: profile?.phone ?? "",
        provider,
        createdAt: profile?.createdAt || user.created_at || "",
        orderCount: orderCountByUser.get(user.id) ?? 0,
        emailOrderUpdates: profile?.emailOrderUpdates !== false,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
