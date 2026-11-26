"use client";

import { useActionState, useMemo, useState } from "react";
import { PANEL_PERMISSION_META } from "@/lib/panel-permissions";
import {
  createRoleAction,
  inviteTeamMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
  updateRoleAction,
  type TeamActionState,
} from "@/server/team-actions";
import type { TeamMember, TeamRole } from "@/server/team";

const emptyState: TeamActionState = { error: null, ok: null, members: [], roles: [] };

export function UsersScreen({
  initialMembers,
  initialRoles,
  actorUserId,
}: {
  initialMembers: TeamMember[];
  initialRoles: TeamRole[];
  actorUserId: string;
}) {
  const [inviteState, inviteAction, inviting] = useActionState(inviteTeamMemberAction, emptyState);
  const [roleUpdateState, roleUpdateAction, updatingRole] = useActionState(updateMemberRoleAction, emptyState);
  const [removeState, removeAction, removing] = useActionState(removeMemberAction, emptyState);
  const [createState, createAction, creating] = useActionState(createRoleAction, emptyState);
  const [saveRoleState, saveRoleAction, savingRole] = useActionState(updateRoleAction, emptyState);

  const members =
    inviteState.members.length ||
    roleUpdateState.members.length ||
    removeState.members.length ||
    createState.members.length ||
    saveRoleState.members.length
      ? saveRoleState.members.length
        ? saveRoleState.members
        : createState.members.length
          ? createState.members
          : removeState.members.length
            ? removeState.members
            : roleUpdateState.members.length
              ? roleUpdateState.members
              : inviteState.members
      : initialMembers;

  const roles =
    inviteState.roles.length ||
    roleUpdateState.roles.length ||
    removeState.roles.length ||
    createState.roles.length ||
    saveRoleState.roles.length
      ? saveRoleState.roles.length
        ? saveRoleState.roles
        : createState.roles.length
          ? createState.roles
          : removeState.roles.length
            ? removeState.roles
            : roleUpdateState.roles.length
              ? roleUpdateState.roles
              : inviteState.roles
      : initialRoles;

  const activeRoles = useMemo(() => roles.filter((role) => role.active), [roles]);
  const feedbackError =
    inviteState.error ||
    roleUpdateState.error ||
    removeState.error ||
    createState.error ||
    saveRoleState.error;
  const feedbackOk =
    inviteState.ok || roleUpdateState.ok || removeState.ok || createState.ok || saveRoleState.ok;

  const [selectedRoleId, setSelectedRoleId] = useState(activeRoles[0]?.id ?? roles[0]?.id ?? "");
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null;

  return (
    <div className="mx-auto max-w-[1100px] pb-8">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Sistema</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Usuarios y roles</h1>
      <p className="mt-1 max-w-2xl text-sm leading-5 text-muted">
        Invita al equipo, asigna roles y parametriza qué puede hacer cada uno en el panel.
      </p>

      {feedbackError ? <p className="mt-4 text-sm text-danger">{feedbackError}</p> : null}
      {feedbackOk ? <p className="mt-4 text-sm text-success">{feedbackOk}</p> : null}

      <section className="elevate-1 mt-5 rounded-[14px] border border-line bg-card px-3 py-3" aria-labelledby="equipo">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Equipo</p>
        <h2 id="equipo" className="mt-0.5 text-sm font-semibold">
          Quién tiene acceso
        </h2>
        {members.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aún no hay miembros. Invita el primero abajo.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {members.map((member) => (
              <li key={member.membershipId} className="rounded-[12px] border border-line px-3 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{member.name}</p>
                    <p className="text-sm text-muted break-all">{member.email || member.userId}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {member.roleLabel} · desde {new Date(member.createdAt).toLocaleDateString("es-CO")}
                      {member.userId === actorUserId ? " · tú" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={roleUpdateAction} className="flex items-center gap-2">
                      <input type="hidden" name="membershipId" value={member.membershipId} />
                      <label className="sr-only" htmlFor={`role-${member.membershipId}`}>
                        Rol
                      </label>
                      <select
                        id={`role-${member.membershipId}`}
                        name="roleId"
                        defaultValue={member.roleId ?? ""}
                        className="h-9 rounded-[10px] border border-line bg-canvas px-2 text-sm"
                      >
                        {activeRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={updatingRole}
                        className="h-9 rounded-[10px] border border-line px-3 text-sm font-semibold hover:bg-subtle disabled:opacity-50"
                      >
                        Guardar
                      </button>
                    </form>
                    {member.userId !== actorUserId ? (
                      <form action={removeAction}>
                        <input type="hidden" name="membershipId" value={member.membershipId} />
                        <button
                          type="submit"
                          disabled={removing}
                          className="h-9 rounded-[10px] border border-line px-3 text-sm font-semibold text-danger hover:bg-danger-tint disabled:opacity-50"
                        >
                          Quitar
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-3" aria-labelledby="invitar">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Invitar</p>
        <h2 id="invitar" className="mt-0.5 text-sm font-semibold">
          Nuevo acceso por correo
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Supabase envía el enlace de invitación. Si la cuenta ya existe, solo se agrega al equipo.
        </p>
        <form action={inviteAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
          <label className="grid gap-1 text-sm sm:col-span-1">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Correo</span>
            <input
              name="email"
              type="email"
              required
              placeholder="operador@tucomercio.com"
              className="h-10 rounded-[10px] border border-line bg-canvas px-3"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Rol</span>
            <select
              name="roleId"
              required
              defaultValue={activeRoles.find((r) => r.key === "operator")?.id || activeRoles[0]?.id || ""}
              className="h-10 rounded-[10px] border border-line bg-canvas px-2"
            >
              {activeRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={inviting || activeRoles.length === 0}
              className="h-10 w-full rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas disabled:opacity-50 sm:w-auto"
            >
              {inviting ? "Enviando…" : "Invitar"}
            </button>
          </div>
        </form>
      </section>

      <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-3" aria-labelledby="roles">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Roles</p>
        <h2 id="roles" className="mt-0.5 text-sm font-semibold">
          Parametrizar permisos
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedRoleId(role.id)}
              className={`rounded-[10px] border px-3 py-1.5 text-sm font-semibold ${
                selectedRole?.id === role.id
                  ? "border-accent bg-accent-tint text-ink"
                  : "border-line bg-canvas text-muted hover:text-ink"
              }`}
            >
              {role.label}
              {!role.active ? " (off)" : ""}
            </button>
          ))}
        </div>

        {selectedRole ? (
          <form key={selectedRole.id} action={saveRoleAction} className="mt-4 space-y-3">
            <input type="hidden" name="roleId" value={selectedRole.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Nombre</span>
                <input
                  name="label"
                  defaultValue={selectedRole.label}
                  required
                  className="h-10 rounded-[10px] border border-line bg-canvas px-3"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Estado</span>
                <select
                  name="active"
                  defaultValue={selectedRole.active ? "true" : "false"}
                  disabled={selectedRole.key === "owner"}
                  className="h-10 rounded-[10px] border border-line bg-canvas px-2 disabled:opacity-60"
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1 text-sm">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Descripción</span>
              <input
                name="description"
                defaultValue={selectedRole.description}
                className="h-10 rounded-[10px] border border-line bg-canvas px-3"
              />
            </label>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Permisos</legend>
              {PANEL_PERMISSION_META.map((perm) => {
                const lockedOwner =
                  selectedRole.key === "owner" && (perm.key === "users_manage" || perm.key === "store_settings");
                return (
                  <label
                    key={perm.key}
                    className="flex items-start gap-2 rounded-[10px] border border-line px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name={`perm_${perm.key}`}
                      value="true"
                      defaultChecked={selectedRole.permissions[perm.key]}
                      disabled={lockedOwner}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-semibold text-ink">{perm.label}</span>
                      <span className="mt-0.5 block text-xs text-muted">{perm.hint}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <button
              type="submit"
              disabled={savingRole}
              className="h-10 rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas disabled:opacity-50"
            >
              {savingRole ? "Guardando…" : "Guardar rol"}
            </button>
          </form>
        ) : null}

        <form action={createAction} className="mt-6 border-t border-line pt-4 space-y-3">
          <h3 className="text-sm font-semibold">Crear rol</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Nombre</span>
              <input name="label" required placeholder="Logística" className="h-10 rounded-[10px] border border-line bg-canvas px-3" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Descripción</span>
              <input name="description" placeholder="Solo pedidos y WhatsApp" className="h-10 rounded-[10px] border border-line bg-canvas px-3" />
            </label>
          </div>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Permisos iniciales</legend>
            {PANEL_PERMISSION_META.map((perm) => (
              <label key={perm.key} className="flex items-start gap-2 rounded-[10px] border border-line px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  name={`perm_${perm.key}`}
                  value="true"
                  defaultChecked={perm.key === "whatsapp_manage"}
                  className="mt-1"
                />
                <span>
                  <span className="font-semibold text-ink">{perm.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{perm.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <button
            type="submit"
            disabled={creating}
            className="h-10 rounded-[10px] border border-line px-4 text-sm font-semibold hover:bg-subtle disabled:opacity-50"
          >
            {creating ? "Creando…" : "Crear rol"}
          </button>
        </form>
      </section>
    </div>
  );
}
