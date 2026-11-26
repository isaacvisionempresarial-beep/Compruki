import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  normalizePermissions,
  permissionsForRoleKey,
  roleKeyFromLegacy,
  type PanelPermission,
  type PanelPermissions,
} from "@/lib/panel-permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPilotTenantId } from "@/server/tenant";

export type PanelRole = "owner" | "operator";

export type PanelAccess = {
  user: User;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  /** Compat: owner si tiene users_manage + store_settings tipicos; si no operator. */
  role: PanelRole;
  roleId: string | null;
  roleKey: string;
  roleLabel: string;
  permissions: PanelPermissions;
  actorName: string;
  email: string;
  initials: string;
};

type MembershipRow = {
  role: string;
  role_id: string | null;
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

async function loadRolePermissions(
  tenantId: string,
  roleId: string | null,
  legacyRole: string,
): Promise<{ roleId: string | null; roleKey: string; roleLabel: string; permissions: PanelPermissions }> {
  const legacyKey = roleKeyFromLegacy(legacyRole);
  const fallback = {
    roleId,
    roleKey: legacyKey,
    roleLabel: legacyKey === "owner" ? "Propietario" : "Operador",
    permissions: permissionsForRoleKey(legacyKey),
  };

  try {
    const admin = createAdminSupabase();
    if (roleId) {
      const { data } = await admin
        .from("panel_roles")
        .select("id, key, label, permissions, active")
        .eq("id", roleId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (data?.active !== false && data?.key) {
        return {
          roleId: String(data.id),
          roleKey: String(data.key),
          roleLabel: String(data.label || data.key),
          permissions: normalizePermissions(data.permissions),
        };
      }
    }

    const { data: byKey } = await admin
      .from("panel_roles")
      .select("id, key, label, permissions, active")
      .eq("tenant_id", tenantId)
      .eq("key", legacyKey)
      .maybeSingle();
    if (byKey?.id) {
      return {
        roleId: String(byKey.id),
        roleKey: String(byKey.key),
        roleLabel: String(byKey.label || byKey.key),
        permissions: normalizePermissions(byKey.permissions),
      };
    }
  } catch {
    /* tablas 019 aún no aplicadas */
  }

  return fallback;
}

/** Sesión Auth + membresía en un tenant. Sin membresía no hay acceso al panel. */
export async function getPanelAccess(): Promise<PanelAccess | null> {
  const supabase = await createServerSupabase();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return null;

  const { data, error: membershipError } = await supabase
    .from("memberships")
    .select("role, role_id, tenant_id, tenants(id, name, slug)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !data) return null;

  const row = data as MembershipRow;
  const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
  if (!tenant?.id) return null;

  const roleInfo = await loadRolePermissions(tenant.id, row.role_id, row.role);
  const role: PanelRole = roleInfo.roleKey === "owner" ? "owner" : "operator";
  const actorName = panelActorName(auth.user);

  return {
    user: auth.user,
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    role,
    roleId: roleInfo.roleId,
    roleKey: roleInfo.roleKey,
    roleLabel: roleInfo.roleLabel,
    permissions: roleInfo.permissions,
    actorName,
    email: auth.user.email ?? "",
    initials: panelInitials(actorName),
  };
}

async function isPilotMember(access: PanelAccess) {
  const pilotId = await getPilotTenantId();
  return access.tenantId === pilotId;
}

export async function requirePanelUser(): Promise<User> {
  const access = await requirePanelAccess();
  return access.user;
}

export async function requirePanelAccess(): Promise<PanelAccess> {
  const access = await getPanelAccess();
  if (!access) {
    const user = await getPanelUser();
    redirect(user ? "/ingresar?error=sin-acceso" : "/ingresar");
  }
  if (!(await isPilotMember(access))) redirect("/ingresar?error=otra-tienda");
  return access;
}

export async function requirePanelUserOrNull(): Promise<User | null> {
  const access = await getPanelAccess();
  return access?.user ?? null;
}

/** Para Server Actions: sesión + membresía, sin redirect. */
export async function assertPanelSignedIn(): Promise<boolean> {
  return Boolean(await assertPanelAccess());
}

export async function assertPanelAccess(): Promise<PanelAccess | null> {
  const access = await getPanelAccess();
  if (!access) return null;
  if (!(await isPilotMember(access))) return null;
  return access;
}

export function hasPermission(access: PanelAccess, permission: PanelPermission): boolean {
  if (access.roleKey === "owner") return true;
  return Boolean(access.permissions[permission]);
}

export async function assertPermission(permission: PanelPermission): Promise<PanelAccess | null> {
  const access = await assertPanelAccess();
  if (!access) return null;
  if (!hasPermission(access, permission)) return null;
  return access;
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
