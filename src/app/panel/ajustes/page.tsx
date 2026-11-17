import type { Metadata } from "next";
import Link from "next/link";
import { requirePanelAccess } from "@/server/panel-auth";

export const metadata: Metadata = {
  title: "Configuración",
  description: "Cuenta y tenant de la tienda piloto. Dropi no está conectado.",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const access = await requirePanelAccess();

  return (
    <div className="mx-auto max-w-[720px] pb-8">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Panel</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Configuración</h1>
      <p className="mt-1 text-sm text-muted">
        Datos de tu cuenta y del tenant activo. Dropi no está conectado.
      </p>

      <dl className="elevate-1 mt-4 space-y-3 rounded-[14px] border border-line bg-card px-4 py-3">
        <div>
          <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Tienda</dt>
          <dd className="mt-0.5 text-sm font-semibold">{access.tenantName}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Slug</dt>
          <dd className="mt-0.5 text-sm font-semibold">{access.tenantSlug}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Correo</dt>
          <dd className="mt-0.5 text-sm font-semibold">{access.email || "Sin correo"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Rol</dt>
          <dd className="mt-0.5 text-sm font-semibold">{access.roleLabel}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Nombre en historial</dt>
          <dd className="mt-0.5 text-sm font-semibold">{access.actorName}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
        <Link href="/ingresar?modo=nueva-clave" className="text-accent-strong">
          Cambiar contraseña
        </Link>
        <Link href="/tienda" className="text-accent-strong">
          Abrir tienda
        </Link>
      </div>
    </div>
  );
}
