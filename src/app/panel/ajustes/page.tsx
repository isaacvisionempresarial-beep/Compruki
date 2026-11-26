import type { Metadata } from "next";
import Link from "next/link";
import { StoreIdentityForm } from "@/components/panel/store-identity-form";
import { getHealthSnapshot } from "@/server/health";
import { hasPermission, requirePanelAccess } from "@/server/panel-auth";
import { getStoreIdentity } from "@/server/store-identity";

export const metadata: Metadata = {
  title: "Configuración",
  description: "Cuenta, tienda piloto y estado del entorno. Dropi no está conectado.",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [access, health, identity] = await Promise.all([
    requirePanelAccess(),
    getHealthSnapshot(),
    getStoreIdentity(),
  ]);

  const checkLabels: Array<{ key: keyof typeof health.checks; label: string; hint?: string }> = [
    { key: "siteUrl", label: "NEXT_PUBLIC_SITE_URL" },
    { key: "supabaseUrl", label: "Supabase URL" },
    { key: "supabaseAnon", label: "Clave anon / publishable" },
    { key: "serviceRole", label: "Service role" },
    { key: "tenantPilot", label: "Tienda piloto" },
    {
      key: "productQuestions",
      label: "product_questions (AG-05)",
      hint: "Migración supabase/migrations/012_product_questions.sql. Sin ella el handoff falla y la bandeja queda vacía.",
    },
    {
      key: "followupTasks",
      label: "followup_tasks (AG-07)",
      hint: "Migración supabase/migrations/013_followup_tasks.sql. Sin ella no se guardan seguimientos CRM.",
    },
    {
      key: "customerProfiles",
      label: "customer_profiles (tienda)",
      hint: "Migración supabase/migrations/017_customer_accounts.sql. Sin ella no hay cuentas de comprador.",
    },
    {
      key: "whatsappTables",
      label: "whatsapp_* (Meta)",
      hint: "Migración supabase/migrations/018_whatsapp_meta.sql. Sin ella no se guarda estado ni mensajes.",
    },
    {
      key: "whatsappInbox",
      label: "whatsapp_conversations (Inbox)",
      hint: "Migración supabase/migrations/021_whatsapp_inbox_crm.sql. Sin ella /panel/inbox y reenviar invitación quedan limitados.",
    },
    {
      key: "whatsappMetaEnv",
      label: "META_WA_* (Railway)",
      hint: "Token, Phone Number ID, verify token y app secret. Panel: /panel/whatsapp.",
    },
  ];

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Sistema</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Configuración</h1>
      <p className="mt-1 text-sm text-muted">
        Datos de tu cuenta y de la tienda activa. Dropi no está conectado.
      </p>

      <section className="elevate-1 mt-5 rounded-[14px] border border-line bg-card px-4 py-3" aria-labelledby="cuenta">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Sesión</p>
        <h2 id="cuenta" className="mt-0.5 text-sm font-semibold">Cuenta</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
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
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Nombre en historial</dt>
            <dd className="mt-0.5 text-sm font-semibold">{access.actorName}</dd>
          </div>
        </dl>
      </section>

      <StoreIdentityForm identity={identity} canEdit={hasPermission(access, "store_settings")} />

      <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3" aria-labelledby="alcance">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Permisos</p>
        <h2 id="alcance" className="mt-0.5 text-sm font-semibold">Qué puede esta sesión</h2>
        <p className="mt-1 text-sm text-muted">
          Esta sesión solo abre {access.tenantName} con el rol {access.roleLabel}. Pedidos, catálogo y agentes salen de esa tienda.
        </p>
        <p className="mt-2 text-sm text-muted">
          {hasPermission(access, "catalog_manage") || hasPermission(access, "orders_money")
            ? "Según tu rol puedes gestionar catálogo crítico y/o dinero de pedidos. El detalle se parametriza en Usuarios."
            : "Puedes seguir pedidos y operación diaria. Catálogo crítico, dinero y equipo los definen los roles en Usuarios."}
        </p>
      </section>

      <section className="elevate-1 mt-4 rounded-[14px] border border-line bg-card px-4 py-3" aria-labelledby="backup">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Copia</p>
        <h2 id="backup" className="mt-0.5 text-sm font-semibold">
          Respaldo de esta tienda
        </h2>
        <p className="mt-1 text-sm text-muted">
          Copia de los pedidos y las fichas guardados en {access.tenantName}. El total guardado y el margen van en columnas distintas. No incluye el enlace secreto del cliente.No envía nada a Dropi.
        </p>
        {hasPermission(access, "backups") ? (
          <nav aria-label="Herramientas" className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
            <a href="/panel/respaldo/pedidos" className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
              Pedidos
            </a>
            <a href="/panel/respaldo/catalogo" className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
              Fichas
            </a>
          </nav>
        ) : (
          <p className="mt-3 text-sm text-muted">Tu rol no incluye descargas de respaldo.</p>
        )}
      </section>

      <section className="elevate-1 mt-4 rounded-[14px] border border-line bg-card px-4 py-3" aria-labelledby="readiness">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Entorno</p>
        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
          <h2 id="readiness" className="text-sm font-semibold">
            Preparación del entorno
          </h2>
          <span
            className={`rounded-[10px] border px-2 py-1 text-[10px] font-bold tracking-[0.08em] uppercase ${
              health.ok ? "border-line text-ink" : "border-line text-coral"
            }`}
          >
            {health.ok ? "Listo" : "Incompleto"}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Detalle solo en el panel. <span className="font-semibold">GET /api/health</span> público responde solo ok.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {checkLabels.map((item) => (
            <div key={item.key}>
              <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{item.label}</dt>
              <dd
                className={`mt-0.5 text-sm font-semibold ${
                  health.checks[item.key]
                    ? "text-ink"
                    : item.key === "productQuestions" ||
                        item.key === "followupTasks" ||
                        item.key === "customerProfiles" ||
                        item.key === "whatsappTables" ||
                        item.key === "whatsappMetaEnv"
                      ? "text-coral"
                      : "text-ink"
                }`}
              >
                {health.checks[item.key] ? "OK" : "Falta"}
              </dd>
              {item.hint && !health.checks[item.key] ? (
                <p className="mt-0.5 text-xs leading-5 text-muted">{item.hint}</p>
              ) : null}
            </div>
          ))}
          <div>
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">OpenAI</dt>
            <dd className={`mt-0.5 text-sm font-semibold ${health.openaiConnected ? "text-ink" : "text-coral"}`}>
              {health.openaiConnected ? "OK" : health.checks.openaiKey ? "Falla" : "No"}
            </dd>
            {!health.openaiConnected ? (
              <p className="mt-0.5 text-xs leading-5 text-muted">
                {health.checks.openaiKey
                  ? "Hay clave, pero la prueba no respondió. El checkout no depende de OpenAI."
                  : "Falta OPENAI_API_KEY en el servidor. El checkout no depende de OpenAI."}
              </p>
            ) : null}
          </div>
          <div>
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Dropi</dt>
            <dd className="mt-0.5 text-sm font-semibold">No</dd>
          </div>
        </dl>
      </section>

      <nav aria-label="Herramientas" className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
        <Link href="/ingresar?modo=nueva-clave" target="_self" className="inline-flex h-9 items-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle">
          Cambiar contraseña
        </Link>
        <Link href="/tienda" target="_self" className="inline-flex h-9 items-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle">
          Abrir tienda
        </Link>
        <Link href="/panel/agentes" target="_self" className="inline-flex h-9 items-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle">
          Centro de agentes
        </Link>
        <Link href="/panel/agentes#saas" target="_self" className="inline-flex h-9 items-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle">
          Guía de alta (AG-10)
        </Link>
        <Link href="/panel/whatsapp" target="_self" className="inline-flex h-9 items-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle">
          WhatsApp Meta
        </Link>
        <a href="/api/health" target="_self" className="inline-flex h-9 items-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle">
          Ver /api/health
        </a>
      </nav>
    </div>
  );
}
