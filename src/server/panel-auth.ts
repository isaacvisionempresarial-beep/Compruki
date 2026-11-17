import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

export type PanelRole = "owner" | "operator";

export type PanelAccess = {
  user: User;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: PanelRole;
  actorName: string;
  roleLabel: string;
  email: string;
  initials: string;
};

type MembershipRow = {
  role: string;
  tenant_id: string;
  tenants:
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null;
};

export async function getPanelUser(): Promise<User | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/** Sesión Auth + membresía en un tenant. Sin membresía no hay acceso al panel. */
export async function getPanelAccess(): Promise<PanelAccess | null> {
  const supabase = await createServerSupabase();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return null;

  const { data, error: membershipError } = await supabase
    .from("memberships")
    .select("role, tenant_id, tenants(id, name, slug)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !data) return null;

  const row = data as MembershipRow;
  const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
  if (!tenant?.id) return null;

  const role: PanelRole = row.role === "operator" ? "operator" : "owner";
  const actorName = panelActorName(auth.user);
  return {
    user: auth.user,
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    role,
    actorName,
    roleLabel: role === "owner" ? "Propietario" : "Operador",
    email: auth.user.email ?? "",
    initials: panelInitials(actorName),
  };
}

export async function requirePanelUser(): Promise<User> {
  const access = await getPanelAccess();
  if (!access) {
    const user = await getPanelUser();
    redirect(user ? "/ingresar?error=sin-acceso" : "/ingresar");
  }
  return access.user;
}

export async function requirePanelAccess(): Promise<PanelAccess> {
  const access = await getPanelAccess();
  if (!access) {
    const user = await getPanelUser();
    redirect(user ? "/ingresar?error=sin-acceso" : "/ingresar");
  }
  return access;
}

export async function requirePanelUserOrNull(): Promise<User | null> {
  const access = await getPanelAccess();
  return access?.user ?? null;
}

/** Para Server Actions: sesión + membresía, sin redirect. */
export async function assertPanelSignedIn(): Promise<boolean> {
  return Boolean(await getPanelAccess());
}

export async function assertPanelAccess(): Promise<PanelAccess | null> {
  return getPanelAccess();
}

export function panelActorName(user: User): string {
  const meta = user.user_metadata?.full_name ?? user.user_metadata?.name;
  if (typeof meta === "string" && meta.trim()) return meta.trim().replace(/\s+/g, " ");
  const local = user.email?.split("@")[0]?.trim();
  if (local) return local;
  return "Operador";
}

function panelInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "OP";
}
