import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UsersScreen } from "@/components/panel/users-screen";
import { hasPermission, requirePanelAccess } from "@/server/panel-auth";
import { loadTeamPanelData } from "@/server/team-actions";

export const metadata: Metadata = {
  title: "Usuarios",
  description: "Administra el equipo del panel, invitaciones y roles parametrizables.",
};

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const access = await requirePanelAccess();
  if (!hasPermission(access, "users_manage")) {
    redirect("/panel?error=sin-permiso-usuarios");
  }

  const data = await loadTeamPanelData();
  if (!data.canManage) {
    redirect("/panel?error=sin-permiso-usuarios");
  }

  return (
    <UsersScreen
      initialMembers={data.members}
      initialRoles={data.roles}
      actorUserId={access.user.id}
    />
  );
}
