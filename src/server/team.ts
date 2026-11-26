import {
  emptyPermissions,
  normalizePermissions,
  PANEL_PERMISSION_KEYS,
  type PanelPermission,
  type PanelPermissions,
} from "@/lib/panel-permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site-url";
import { panelActorName } from "@/server/panel-auth";

export type TeamMember = {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  roleId: string | null;
  roleKey: string;
  roleLabel: string;
  createdAt: string;
};

export type TeamRole = {
  id: string;
  key: string;
  label: string;
  description: string;
  permissions: PanelPermissions;
  isSystem: boolean;
  active: boolean;
};

type RoleRow = {
  id: string;
  key: string;
  label: string;
  description: string;
  permissions: unknown;
  is_system: boolean;
  active: boolean;
};

export async function listTeamRoles(tenantId: string, opts?: { activeOnly?: boolean }): Promise<TeamRole[]> {
  const admin = createAdminSupabase();
  let query = admin
    .from("panel_roles")
    .select("id, key, label, description, permissions, is_system, active")
    .eq("tenant_id", tenantId)
    .order("is_system", { ascending: false })
    .order("label", { ascending: true });
  if (opts?.activeOnly) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as RoleRow[] | null)?.map(mapRole) ?? [];
}

function mapRole(row: RoleRow): TeamRole {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    description: row.description || "",
    permissions: normalizePermissions(row.permissions),
    isSystem: Boolean(row.is_system),
    active: row.active !== false,
  };
}

export async function listTeamMembers(tenantId: string): Promise<TeamMember[]> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("memberships")
    .select("id, user_id, role, role_id, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const roles = await listTeamRoles(tenantId);
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const roleByKey = new Map(roles.map((role) => [role.key, role]));

  const members: TeamMember[] = [];
  for (const row of rows) {
    const userId = String(row.user_id);
    const { data: userData } = await admin.auth.admin.getUserById(userId);
    const user = userData.user;
    const role =
      (row.role_id ? roleById.get(String(row.role_id)) : null) ||
      roleByKey.get(row.role === "owner" ? "owner" : "operator") ||
      null;
    members.push({
      membershipId: String(row.id),
      userId,
      email: user?.email ?? "",
      name: user ? panelActorName(user) : "Usuario",
      roleId: role?.id ?? (row.role_id ? String(row.role_id) : null),
      roleKey: role?.key ?? (row.role === "owner" ? "owner" : "operator"),
      roleLabel: role?.label ?? (row.role === "owner" ? "Propietario" : "Operador"),
      createdAt: String(row.created_at),
    });
  }
  return members;
}

function slugifyRoleKey(label: string) {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (base.length >= 2 && /^[a-z]/.test(base)) return base;
  return `rol_${Date.now().toString(36)}`;
}

export async function createTeamRole(
  tenantId: string,
  input: { label: string; description?: string; permissions?: Partial<PanelPermissions> },
) {
  const label = input.label.trim();
  if (label.length < 2) throw new Error("El nombre del rol es muy corto.");
  const permissions = { ...emptyPermissions(false), ...normalizePermissions(input.permissions ?? {}) };
  if (permissions.users_manage && !permissions.store_settings) {
    /* permitido: se puede dar users_manage sin store_settings */
  }
  const admin = createAdminSupabase();
  let key = slugifyRoleKey(label);
  for (let i = 0; i < 5; i += 1) {
    const candidate = i === 0 ? key : `${key}_${i + 1}`;
    const { data, error } = await admin
      .from("panel_roles")
      .insert({
        tenant_id: tenantId,
        key: candidate,
        label,
        description: (input.description ?? "").trim().slice(0, 240),
        permissions,
        is_system: false,
        active: true,
        updated_at: new Date().toISOString(),
      })
      .select("id, key, label, description, permissions, is_system, active")
      .maybeSingle();
    if (!error && data) return mapRole(data as RoleRow);
    if (!error || !/duplicate|unique/i.test(error.message)) {
      throw new Error(error?.message || "No se pudo crear el rol.");
    }
  }
  throw new Error("No se pudo crear el rol: clave duplicada.");
}

export async function updateTeamRole(
  tenantId: string,
  roleId: string,
  input: {
    label?: string;
    description?: string;
    permissions?: Partial<PanelPermissions>;
    active?: boolean;
  },
) {
  const admin = createAdminSupabase();
  const { data: current, error: readError } = await admin
    .from("panel_roles")
    .select("id, key, label, description, permissions, is_system, active")
    .eq("tenant_id", tenantId)
    .eq("id", roleId)
    .maybeSingle();
  if (readError || !current) throw new Error("Rol no encontrado.");

  const nextPermissions = input.permissions
    ? normalizePermissions({ ...normalizePermissions(current.permissions), ...input.permissions })
    : normalizePermissions(current.permissions);

  // Propietario siempre conserva control de equipo.
  if (current.key === "owner") {
    nextPermissions.users_manage = true;
    nextPermissions.store_settings = true;
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    permissions: nextPermissions,
  };
  if (input.label !== undefined) {
    const label = input.label.trim();
    if (label.length < 2) throw new Error("El nombre del rol es muy corto.");
    patch.label = label;
  }
  if (input.description !== undefined) {
    patch.description = input.description.trim().slice(0, 240);
  }
  if (input.active !== undefined) {
    if (current.key === "owner" && input.active === false) {
      throw new Error("No puedes desactivar el rol Propietario.");
    }
    patch.active = input.active;
  }

  const { data, error } = await admin
    .from("panel_roles")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", roleId)
    .select("id, key, label, description, permissions, is_system, active")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "No se pudo actualizar el rol.");
  return mapRole(data as RoleRow);
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminSupabase();
  const normalized = email.trim().toLowerCase();
  // listUsers is paginated; for MVP search first pages.
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function inviteTeamMember(
  tenantId: string,
  input: { email: string; roleId: string },
): Promise<{ invited: boolean; membershipId: string; userId: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Correo inválido.");

  const admin = createAdminSupabase();
  const { data: role, error: roleError } = await admin
    .from("panel_roles")
    .select("id, key, active")
    .eq("tenant_id", tenantId)
    .eq("id", input.roleId)
    .maybeSingle();
  if (roleError || !role || role.active === false) throw new Error("Rol no válido o inactivo.");

  let userId = await findAuthUserIdByEmail(email);
  let invited = false;

  if (userId) {
    const { data: existing } = await admin
      .from("memberships")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing?.id) throw new Error("Ese correo ya tiene acceso al panel.");
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: siteUrl("/auth/callback?next=/panel"),
    });
    if (error || !data.user) throw new Error(error?.message || "No se pudo enviar la invitación.");
    userId = data.user.id;
    invited = true;
  }

  const mirrorRole = role.key === "owner" ? "owner" : "operator";
  const { data: membership, error: membershipError } = await admin
    .from("memberships")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      role: mirrorRole,
      role_id: role.id,
    })
    .select("id")
    .maybeSingle();
  if (membershipError || !membership) {
    throw new Error(membershipError?.message || "No se pudo crear la membresía.");
  }

  return { invited, membershipId: String(membership.id), userId };
}

export async function updateMemberRole(tenantId: string, membershipId: string, roleId: string) {
  const admin = createAdminSupabase();
  const { data: membership, error } = await admin
    .from("memberships")
    .select("id, role, role_id, user_id")
    .eq("tenant_id", tenantId)
    .eq("id", membershipId)
    .maybeSingle();
  if (error || !membership) throw new Error("Miembro no encontrado.");

  const { data: role, error: roleError } = await admin
    .from("panel_roles")
    .select("id, key, active")
    .eq("tenant_id", tenantId)
    .eq("id", roleId)
    .maybeSingle();
  if (roleError || !role || role.active === false) throw new Error("Rol no válido o inactivo.");

  if (membership.role === "owner" || (await isLastOwnerMembership(tenantId, String(membership.id)))) {
    if (role.key !== "owner") {
      const owners = await countOwners(tenantId);
      if (owners <= 1) throw new Error("Debe quedar al menos un propietario.");
    }
  }

  const mirrorRole = role.key === "owner" ? "owner" : "operator";
  const { error: updateError } = await admin
    .from("memberships")
    .update({ role: mirrorRole, role_id: role.id })
    .eq("tenant_id", tenantId)
    .eq("id", membershipId);
  if (updateError) throw new Error(updateError.message);
}

export async function removeMember(tenantId: string, membershipId: string, actorUserId: string) {
  const admin = createAdminSupabase();
  const { data: membership, error } = await admin
    .from("memberships")
    .select("id, role, role_id, user_id")
    .eq("tenant_id", tenantId)
    .eq("id", membershipId)
    .maybeSingle();
  if (error || !membership) throw new Error("Miembro no encontrado.");
  if (String(membership.user_id) === actorUserId) {
    throw new Error("No puedes quitarte a ti mismo.");
  }
  if (await isLastOwnerMembership(tenantId, String(membership.id))) {
    throw new Error("No puedes quitar al último propietario.");
  }
  const { error: deleteError } = await admin
    .from("memberships")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", membershipId);
  if (deleteError) throw new Error(deleteError.message);
}

async function countOwners(tenantId: string) {
  const admin = createAdminSupabase();
  const { data: ownerRole } = await admin
    .from("panel_roles")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("key", "owner")
    .maybeSingle();
  if (ownerRole?.id) {
    const { count } = await admin
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("role_id", ownerRole.id);
    if (typeof count === "number") return count;
  }
  const { count } = await admin
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("role", "owner");
  return count ?? 0;
}

async function isLastOwnerMembership(tenantId: string, membershipId: string) {
  const admin = createAdminSupabase();
  const { data: membership } = await admin
    .from("memberships")
    .select("id, role, role_id")
    .eq("tenant_id", tenantId)
    .eq("id", membershipId)
    .maybeSingle();
  if (!membership) return false;

  const { data: ownerRole } = await admin
    .from("panel_roles")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("key", "owner")
    .maybeSingle();

  const isOwner =
    membership.role === "owner" ||
    (ownerRole?.id && String(membership.role_id) === String(ownerRole.id));
  if (!isOwner) return false;
  return (await countOwners(tenantId)) <= 1;
}

export function parsePermissionsForm(formData: FormData): PanelPermissions {
  const next = emptyPermissions(false);
  for (const key of PANEL_PERMISSION_KEYS) {
    next[key as PanelPermission] = formData.get(`perm_${key}`) === "on" || formData.get(`perm_${key}`) === "true";
  }
  return next;
}
