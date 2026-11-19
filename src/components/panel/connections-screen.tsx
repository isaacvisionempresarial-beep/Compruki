"use client";

import Link from "next/link";
import { useActionState } from "react";
import { DROPI_CAPABILITIES, blockedDropiAnswer } from "@/lib/dropi-provider";
import { cx } from "@/lib/cx";
import { probeOfficialDropi, type DropiProbe } from "@/server/dropi-read";

const initial: DropiProbe | null = null;
const capabilityGrid = "md:grid-cols-[minmax(0,1fr)_7.5rem_minmax(0,1.4fr)]";

export function ConnectionsScreen({
  healthOk,
  tenantPilotOk,
}: {
  healthOk: boolean;
  tenantPilotOk: boolean;
}) {
  const [probe, action, pending] = useActionState(probeOfficialDropi, initial);

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Conexión</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Dropi</h1>
      <p className="mt-0.5 text-sm text-muted">
        Dropi no está conectado. Nada aquí consulta la cuenta; falta autorización oficial. El total guardado no cambia.
      </p>

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="order-2 min-w-0 xl:order-1 space-y-3">
          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="plataforma">
            <h2 id="plataforma" className="text-sm font-semibold">
              Plataforma COMPRUKI
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Estado local del piloto. OpenAI no está conectado. El checkout no depende de Dropi.
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
                <Link href="/panel/agentes" className="mt-1 inline-flex text-sm font-semibold text-accent-strong">
                  Abrir centro de agentes
                </Link>
              </li>
            </ul>
          </section>

          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="consultas-bloqueadas">
            <h2 id="consultas-bloqueadas" className="text-sm font-semibold">
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

        <aside className="order-1 grid content-start gap-3 xl:sticky xl:top-[3.75rem] xl:order-2">
          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="conexion-resumen">
            <h2 id="conexion-resumen" className="text-sm font-semibold">
              Estado
            </h2>
            <p className="mt-2 text-sm font-extrabold text-warning">Dropi no está conectado</p>
            <dl className="mt-2 space-y-2 text-xs leading-5">
              <div>
                <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Servidor</dt>
                <dd className="mt-0.5 font-semibold text-sm">mcp.dropi.co</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Qué consulta</dt>
                <dd className="mt-0.5 text-muted">Solo el saludo. No pide órdenes ni productos.</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Qué no hace</dt>
                <dd className="mt-0.5 text-muted">No crea pedidos, no cambia el total guardado ni marca la tienda como conectada.</dd>
              </div>
            </dl>
          </section>

          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="conexion-consulta">
            <h2 id="conexion-consulta" className="text-sm font-semibold">
              Saludo al servidor
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Opcional. Solo prueba el saludo; no autoriza la cuenta. El total guardado no cambia.
            </p>
            <form action={action} className="mt-3">
              <button
                type="submit"
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
              <p className="mt-3 text-xs leading-5 text-muted">Todavía no hay un saludo en esta visita.</p>
            )}
          </section>

          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="donde-anotar">
            <h2 id="donde-anotar" className="text-sm font-semibold">
              Dónde se anota el número
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Dropi no está conectado. Los pedidos a crear a mano están en Sincronización; esta pantalla no los envía. El total guardado no cambia.
            </p>
            <Link
              href="/panel/sincronizacion"
              className="mt-2 inline-flex text-sm font-semibold text-accent-strong"
            >
              Abrir sincronización
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
