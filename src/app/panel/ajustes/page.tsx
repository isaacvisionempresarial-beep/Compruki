import type { Metadata } from "next";
import Link from "next/link";
import { getHealthSnapshot } from "@/server/health";
import { requirePanelAccess } from "@/server/panel-auth";

export const metadata: Metadata = {
  title: "Configuración",
  description: "Cuenta, tenant y readiness del piloto. Dropi no está conectado.",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [access, health] = await Promise.all([requirePanelAccess(), getHealthSnapshot()]);

  const checkLabels: Array<{ key: keyof typeof health.checks; label: string }> = [
    { key: "siteUrl", label: "NEXT_PUBLIC_SITE_URL" },
    { key: "supabaseUrl", label: "Supabase URL" },
    { key: "supabaseAnon", label: "Clave anon / publishable" },
    { key: "serviceRole", label: "Service role" },
    { key: "tenantPilot", label: "Tenant tienda-piloto" },
  ];

  return (
    <div className="mx-auto max-w-[720px] pb-8">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Panel</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Configuración</h1>
      <p className="mt-1 text-sm text-muted">
        Datos de tu cuenta y del tenant activo. Verlos no cobra ni cambia pedidos. Dropi no está conectado.
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
        <div>
          <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Aislamiento</dt>
          <dd className="mt-0.5 text-sm text-muted">
            Esta sesión solo abre {access.tenantName}. Pedidos, catálogo y agentes salen de esa tienda. Un identificador de otra tienda no se lee ni se escribe. Verlo no cobra ni cambia pedidos.
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Qué puede esta sesión</dt>
          <dd className="mt-0.5 text-sm text-muted">
            {access.role === "owner"
              ? "Puedes cambiar precios, publicación, alta y eliminación del catálogo; anotar el flete, el costo y la marca de cobro; y aprobar borradores y presupuestos. Nada de eso cobra en el sitio."
              : "Puedes editar textos, fotos y disponibilidad, y seguir pedidos: estado, entrega, talla o tamaño y aviso. Precio, flete, costo, marca de cobro, alta, eliminación, aprobar borradores y presupuestos los guarda el propietario. Nada de eso cobra en el sitio."}
          </dd>
        </div>
      </dl>

      <section className="elevate-1 mt-4 rounded-[14px] border border-line bg-card px-4 py-3" aria-labelledby="readiness">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="readiness" className="text-sm font-semibold">
            Readiness del entorno
          </h2>
          <span
            className={`rounded-[10px] border px-2 py-1 text-[10px] font-bold tracking-[0.06em] uppercase ${
              health.ok ? "border-line text-ink" : "border-line text-coral"
            }`}
          >
            {health.ok ? "Listo" : "Incompleto"}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Misma señal que <span className="font-semibold">GET /api/health</span>. No expone secretos. Verla no cobra ni cambia pedidos.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {checkLabels.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3">
              <span className="text-muted">{item.label}</span>
              <span className="font-semibold">{health.checks[item.key] ? "OK" : "Falta"}</span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3">
            <span className="text-muted">OpenAI</span>
            <span className="font-semibold">No</span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="text-muted">Dropi</span>
            <span className="font-semibold">No</span>
          </li>
        </ul>
      </section>

      <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
        <Link href="/ingresar?modo=nueva-clave" title="Abrirla no cobra ni cambia pedidos." className="text-accent-strong">
          Cambiar contraseña
        </Link>
        <Link href="/tienda" title="Abrirla no cobra ni cambia pedidos." className="text-accent-strong">
          Abrir tienda
        </Link>
        <Link href="/panel/agentes" title="Abrirlo no cobra ni cambia pedidos." className="text-accent-strong">
          Centro de agentes
        </Link>
        <a href="/api/health" title="Verla no cobra ni cambia pedidos." className="text-accent-strong">
          Ver /api/health
        </a>
      </div>
    </div>
  );
}
