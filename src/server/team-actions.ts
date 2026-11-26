"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/server/panel-auth";
import {
  createTeamRole,
  inviteTeamMember,
  listTeamMembers,
  listTeamRoles,
  parsePermissionsForm,
  removeMember,
  updateMemberRole,
  updateTeamRole,
  type TeamMember,
  type TeamRole,
} from "@/server/team";

export type TeamActionState = {
  error: string | null;
  ok: string | null;
  members: TeamMember[];
  roles: TeamRole[];
};

async function snapshot(tenantId: string): Promise<Pick<TeamActionState, "members" | "roles">> {
  const [members, roles] = await Promise.all([listTeamMembers(tenantId), listTeamRoles(tenantId)]);
  return { members, roles };
}

export async function loadTeamPanelData(): Promise<{
  members: TeamMember[];
  roles: TeamRole[];
  canManage: boolean;
}> {
  const access = await assertPermission("users_manage");
  if (!access) {
    return { members: [], roles: [], canManage: false };
  }
  const data = await snapshot(access.tenantId);
  return { ...data, canManage: true };
}

export async function inviteTeamMemberAction(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const access = await assertPermission("users_manage");
  if (!access) return { error: "No tienes permiso para invitar usuarios.", ok: null, members: [], roles: [] };

  try {
    const email = String(formData.get("email") || "");
    const roleId = String(formData.get("roleId") || "");
    if (!roleId) {
      const data = await snapshot(access.tenantId);
      return { error: "Elige un rol.", ok: null, ...data };
    }
    const result = await inviteTeamMember(access.tenantId, { email, roleId });
    revalidatePath("/panel/usuarios");
    const data = await snapshot(access.tenantId);
    return {
      error: null,
      ok: result.invited
        ? `Invitación enviada a ${email.trim().toLowerCase()}.`
        : `Acceso agregado para ${email.trim().toLowerCase()} (ya tenía cuenta).`,
      ...data,
    };
  } catch (error) {
    const data = await snapshot(access.tenantId);
    return {
      error: error instanceof Error ? error.message : "No se pudo invitar.",
      ok: null,
      ...data,
    };
  }
}

export async function updateMemberRoleAction(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const access = await assertPermission("users_manage");
  if (!access) return { error: "No tienes permiso para cambiar roles.", ok: null, members: [], roles: [] };

  try {
    await updateMemberRole(
      access.tenantId,
      String(formData.get("membershipId") || ""),
      String(formData.get("roleId") || ""),
    );
    revalidatePath("/panel/usuarios");
    const data = await snapshot(access.tenantId);
    return { error: null, ok: "Rol actualizado.", ...data };
  } catch (error) {
    const data = await snapshot(access.tenantId);
    return {
      error: error instanceof Error ? error.message : "No se pudo actualizar el rol.",
      ok: null,
      ...data,
    };
  }
}

export async function removeMemberAction(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const access = await assertPermission("users_manage");
  if (!access) return { error: "No tienes permiso para quitar usuarios.", ok: null, members: [], roles: [] };

  try {
    await removeMember(access.tenantId, String(formData.get("membershipId") || ""), access.user.id);
    revalidatePath("/panel/usuarios");
    const data = await snapshot(access.tenantId);
    return { error: null, ok: "Acceso eliminado.", ...data };
  } catch (error) {
    const data = await snapshot(access.tenantId);
    return {
      error: error instanceof Error ? error.message : "No se pudo quitar el acceso.",
      ok: null,
      ...data,
    };
  }
}

export async function createRoleAction(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const access = await assertPermission("users_manage");
  if (!access) return { error: "No tienes permiso para crear roles.", ok: null, members: [], roles: [] };

  try {
    await createTeamRole(access.tenantId, {
      label: String(formData.get("label") || ""),
      description: String(formData.get("description") || ""),
      permissions: parsePermissionsForm(formData),
    });
    revalidatePath("/panel/usuarios");
    const data = await snapshot(access.tenantId);
    return { error: null, ok: "Rol creado.", ...data };
  } catch (error) {
    const data = await snapshot(access.tenantId);
    return {
      error: error instanceof Error ? error.message : "No se pudo crear el rol.",
      ok: null,
      ...data,
    };
  }
}

export async function updateRoleAction(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const access = await assertPermission("users_manage");
  if (!access) return { error: "No tienes permiso para editar roles.", ok: null, members: [], roles: [] };

  try {
    const roleId = String(formData.get("roleId") || "");
    const activeRaw = String(formData.get("active") || "");
    await updateTeamRole(access.tenantId, roleId, {
      label: String(formData.get("label") || undefined) || undefined,
      description: String(formData.get("description") || ""),
      permissions: parsePermissionsForm(formData),
      ...(activeRaw === "true" || activeRaw === "false" ? { active: activeRaw === "true" } : {}),
    });
    revalidatePath("/panel/usuarios");
    const data = await snapshot(access.tenantId);
    return { error: null, ok: "Rol guardado.", ...data };
  } catch (error) {
    const data = await snapshot(access.tenantId);
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar el rol.",
      ok: null,
      ...data,
    };
  }
}
