"use client";

import Link from "next/link";
import { useActionState } from "react";
import { DROPI_CAPABILITIES, DROPI_MCP_HOST, DROPI_OAUTH_HOST, blockedDropiAnswer, type DropiConnectionState, type DropiQueuedJob } from "@/lib/dropi-provider";
import { cx } from "@/lib/cx";
import { inspectDropiAuthorization, probeOfficialDropi, type DropiAdvertisement, type DropiProbe } from "@/server/dropi-read";

const initial: DropiProbe | null = null;
const initialAdvertisement: DropiAdvertisement | null = null;
const capabilityGrid = "md:grid-cols-[minmax(0,1fr)_7.5rem_minmax(0,1.4fr)]";

export function ConnectionsScreen({
  healthOk,
  tenantPilotOk,
  connection,
  jobs,
}: {
  healthOk: boolean;
  tenantPilotOk: boolean;
  connection: DropiConnectionState;
  jobs: DropiQueuedJob[];
}) {
  const [probe, action, pending] = useActionState(probeOfficialDropi, initial);
  const [advertisement, inspect, inspecting] = useActionState(inspectDropiAuthorization, initialAdvertisement);

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Operación</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Dropi</h1>
      <p className="mt-1 max-w-2xl text-sm leading-5 text-muted">
        Dropi no está conectado. Nada aquí consulta la cuenta; falta autorización oficial. El total guardado no cambia.
      </p>

      <section className="elevate-1 mt-5 rounded-[14px] border border-line bg-card px-3 py-3" aria-labelledby="conexion-resumen">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Estado</p>
        <h2 id="conexion-resumen" className="mt-0.5 text-sm font-semibold text-warning">Dropi no está conectado</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Servidor</dt>
            <dd className="mt-0.5 text-sm font-semibold">mcp.dropi.co</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Qué consulta</dt>
            <dd className="mt-0.5 text-sm text-muted">Solo el saludo. No pide órdenes ni productos.</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Qué no hace</dt>
            <dd className="mt-0.5 text-sm text-muted">No crea pedidos, no cambia el total guardado ni marca la tienda como conectada.</dd>
          </div>
        </dl>
      </section>

      <div className="mt-3 space-y-3">
          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="para-conectar">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Requisitos</p>
            <h2 id="para-conectar" className="mt-0.5 text-sm font-semibold">
              Para poder conectar
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Dropi publica el ingreso en {DROPI_OAUTH_HOST} y el servidor en {DROPI_MCP_HOST}. Esta aplicación todavía no está registrada, así que conectar sigue bloqueado.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="rounded-[10px] border border-line px-3 py-2">
                <p className="font-semibold">Contraseña</p>
                <p className="mt-0.5 text-xs leading-5 text-muted">Solo se escribe en {DROPI_OAUTH_HOST}. Aquí no hay campo de clave ni token guardado.</p>
              </li>
              <li className="rounded-[10px] border border-line px-3 py-2">
                <p className="font-semibold">Registro de esta aplicación</p>
                <p className="mt-0.5 text-xs leading-5 text-muted">Falta el client_id que Dropi tendría que entregar. Sin eso no se abre la autorización.</p>
              </li>
              <li className="rounded-[10px] border border-line px-3 py-2">
                <p className="font-semibold">Cola de envío</p>
                <p className="mt-0.5 text-xs leading-5 text-muted">
                  {connection.tableReady
                    ? `${jobs.filter((job) => job.status === "bloqueado").length} bloqueados, ${jobs.filter((job) => job.status === "aviso").length} avisos y ${jobs.filter((job) => job.status === "conciliado").length} conciliados a mano. Ninguno se envía a Dropi.`
                    : connection.detail}
                </p>
              </li>
            </ul>
            <button
              type="button"
              disabled
              title="Sigue bloqueado: Dropi no registró esta aplicación. No pide la contraseña ni cobra."
              className="mt-3 inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-[10px] border border-line bg-canvas px-4 text-sm font-semibold text-muted"
            >
              Conectar cuenta
            </button>
            <p className="mt-2 text-xs leading-5 text-muted">{connection.detail}</p>
            {jobs.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs leading-5 text-muted">
                {jobs.slice(0, 5).map((job) => (
                  <li key={job.orderId}>
                    <span className="font-semibold text-ink">{job.orderNumber}</span> · {job.detail}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="plataforma">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Local</p>
            <h2 id="plataforma" className="mt-0.5 text-sm font-semibold">
              Plataforma COMPRUKI
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Estado local del piloto. OpenAI no está conectado. Ver este estado no cobra ni cambia pedidos. El checkout no depende de Dropi.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
              <li className="rounded-[10px] border border-line px-3 py-2">
                <p className="text-[10px] font-bold tracking-[0.06em] text-muted uppercase">Readiness</p>
                <p className="mt-0.5 font-semibold">{healthOk ? "OK · /api/health" : "Incompleto"}</p>
              </li>
              <li className="rounded-[10px] border border-line px-3 py-2">
                <p className="text-[10px] font-bold tracking-[0.06em] text-muted uppercase">Tenant piloto</p>
                <p className="mt-0.5 font-semibold">{tenantPilotOk ? "tienda-piloto" : "No responde"}</p>
              </li>
              <li className="rounded-[10px] border border-line px-3 py-2">
                <p className="text-[10px] font-bold tracking-[0.06em] text-muted uppercase">OpenAI</p>
                <p className="mt-0.5 font-semibold text-warning">No conectado</p>
              </li>
              <li className="rounded-[10px] border border-line px-3 py-2">
                <p className="text-[10px] font-bold tracking-[0.06em] text-muted uppercase">Agentes P0-IA</p>
                <p className="mt-0.5 font-semibold">Modo determinista</p>
                <Link href="/panel/agentes" title="Abrirlo no cobra ni cambia pedidos." className="mt-2 inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
                  Abrir centro de agentes
                </Link>
              </li>
            </ul>
          </section>

          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="consultas-bloqueadas">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Bloqueadas</p>
            <h2 id="consultas-bloqueadas" className="mt-0.5 text-sm font-semibold">
              Consultas bloqueadas
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              El servidor oficial pidió autorización y esta aplicación no la tiene.
            </p>
            <div className="mt-3 overflow-hidden rounded-[10px] border border-line">
              <div
                className={cx(
                  "hidden items-end gap-4 border-b border-line bg-canvas px-3 py-2 text-[11px] font-semibold tracking-[0.04em] text-muted uppercase md:grid",
                  capabilityGrid,
                )}
              >
                <span>Consulta</span>
                <span>Estado</span>
                <span>Detalle</span>
              </div>
              <ul className="divide-y divide-line">
                {DROPI_CAPABILITIES.map((item) => {
                  const answer = blockedDropiAnswer(item.id);
                  return (
                    <li key={item.id} className={cx("grid items-start gap-2 px-3 py-2 text-sm md:gap-4", capabilityGrid)}>
                      <span>
                        <span className="mb-1 block text-[10px] font-bold tracking-[0.06em] text-muted uppercase md:hidden">
                          Consulta
                        </span>
                        <span className="font-semibold">{item.label}</span>
                      </span>
                      <span>
                        <span className="mb-1 block text-[10px] font-bold tracking-[0.06em] text-muted uppercase md:hidden">
                          Estado
                        </span>
                        <span className="font-semibold text-warning">Bloqueada</span>
                      </span>
                      <span className="text-muted">
                        <span className="mb-1 block text-[10px] font-bold tracking-[0.06em] text-muted uppercase md:hidden">
                          Detalle
                        </span>
                        {answer.detail}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
      </div>

      <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="conexion-anuncio">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Aviso</p>
            <h2 id="conexion-anuncio" className="mt-0.5 text-sm font-semibold">
              Qué anuncia el servidor
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Lee el aviso público de autorización. No abre el ingreso, no pide la contraseña y no cobra. El total guardado no cambia.
            </p>
            <form action={inspect} className="mt-3">
              <button
                type="submit"
                title="Consultarlo no autoriza la cuenta, no pide la contraseña y no cobra."
                disabled={inspecting}
                className={`inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-line bg-card px-4 text-sm font-semibold text-ink hover:bg-canvas ${
                  inspecting ? "cursor-wait opacity-70" : ""
                }`}
              >
                {inspecting ? "Consultando…" : "Ver anuncio oficial"}
              </button>
            </form>
            <p className="mt-3 text-sm leading-5 text-ink" role="status">
              {advertisement?.detail ?? "Todavía no hay un anuncio en esta visita."}
            </p>
          </section>

          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="conexion-consulta">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Prueba</p>
            <h2 id="conexion-consulta" className="mt-0.5 text-sm font-semibold">
              Saludo al servidor
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Opcional. Solo prueba el saludo; no autoriza la cuenta. Probarlo no cobra ni cambia pedidos. El total guardado no cambia.
            </p>
            <form action={action} className="mt-3">
              <button
                type="submit"
                title="Probarlo no cobra ni cambia pedidos."
                disabled={pending}
                className={`inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-line bg-card px-4 text-sm font-semibold text-ink hover:bg-canvas ${
                  pending ? "cursor-wait opacity-70" : ""
                }`}
              >
                {pending ? "Consultando…" : "Probar saludo"}
              </button>
            </form>
            {probe ? (
              <p className="mt-3 text-sm leading-5 text-ink" role="status">
                {probe.detail}
              </p>
            ) : (
              <p className="mt-3 text-xs leading-5 text-muted">Todavía no hay un saludo en esta visita. Probarlo no cobra ni cambia pedidos.</p>
            )}
          </section>

          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2 lg:col-span-2" aria-labelledby="donde-anotar">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Número</p>
            <h2 id="donde-anotar" className="mt-0.5 text-sm font-semibold">
              Dónde se anota el número
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Dropi no está conectado. Los pedidos a crear a mano están en Sincronización; esta pantalla no los envía. No cobra. El total guardado no cambia.
            </p>
            <Link
              href="/panel/sincronizacion"
              title="Abrirla no cobra. El total guardado no cambia."
              className="mt-3 inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
            >
              Abrir sincronización
            </Link>
          </section>
      </div>
    </div>
  );
}
