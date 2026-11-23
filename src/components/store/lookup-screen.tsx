"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { normalizeOrderNumber, normalizePhone } from "@/lib/store-order";
import { lookupOrderAction, type LookupOrderState } from "@/server/customer-lookup";

const initialState: LookupOrderState = { error: null };

export function LookupScreen() {
  const [state, formAction, pending] = useActionState(lookupOrderAction, initialState);
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  const orderNumber = normalizeOrderNumber(number);
  const phoneNumber = normalizePhone(phone);
  const canSearch = /^P-\d{4,6}$/.test(orderNumber) && /^3\d{9}$/.test(phoneNumber);

  return (
    <div>
      <section className="store-hero relative overflow-hidden rounded-[14px] border border-line px-3 py-2 sm:px-4">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Pedido</p>
        <h1 className="mt-1 text-[24px] leading-7 font-extrabold tracking-tight">Consultar pedido</h1>
        <p className="mt-1 max-w-xl text-sm leading-5 text-muted">
          Seguimiento. Número del pedido y celular de la entrega. Varios intentos seguidos se detienen un rato y no abren el pedido. Consultar no cobra ni cambia el total guardado. Dropi no está conectado.
        </p>
      </section>

      <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-3" aria-labelledby="que-necesitas">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Datos</p>
        <h2 id="que-necesitas" className="mt-0.5 text-sm font-semibold">Qué necesitas</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          <li>
            <span className="font-semibold text-sm">Número</span>
            <span className="mt-0.5 block text-xs leading-5 text-muted">Empieza por P- y los dígitos al confirmar.</span>
          </li>
          <li>
            <span className="font-semibold text-sm">Celular</span>
            <span className="mt-0.5 block text-xs leading-5 text-muted">10 dígitos, empieza por 3. Debe coincidir.</span>
          </li>
        </ul>
        <p className="mt-3 text-xs leading-5 text-muted">
          Solo estado en la tienda. Si sigue en curso, pagas al recibir y nadie cobra aquí. Si está cancelado, devuelto o en incidencia, ya no se paga al recibir. Anotar el cobro, el flete o el recaudo no es dinero cobrado aquí. Consultar no cambia el total guardado. Dropi no está conectado. Sin guía ni fecha exacta.
        </p>
        <p className="mt-2 text-xs leading-5 text-muted">
          Corregir la entrega, la talla o un aviso no cobra aquí. El total guardado no cambia. Agregar o quitar un producto sí puede cambiar ese total, y tampoco es dinero cobrado.
        </p>
        <nav aria-label="Herramientas" className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
          <Link
            href="/tienda/condiciones"
            title="Leerlas no registra pedido ni cobra."
            className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold"
          >
            Condiciones
          </Link>
        </nav>
        <p className="mt-2 text-xs leading-5 text-muted">Leerlas no registra pedido ni cobra.</p>
      </section>

      <form action={formAction} className="elevate-1 mt-3 max-w-xl space-y-2 rounded-[14px] border border-line bg-card px-3 py-3" aria-labelledby="consulta-pedido">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</p>
          <h2 id="consulta-pedido" className="mt-0.5 text-sm font-semibold">Número y celular</h2>
          <div>
            <label htmlFor="number" className="mb-1 block text-sm font-semibold">
              Número del pedido
            </label>
            <input
              id="number"
              name="number"
              required
              autoComplete="off"
              inputMode="text"
              placeholder="P-2001"
              title="Escribirlo no cobra ni cambia el total guardado."
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted">Consultar no cobra ni cambia el total guardado.</p>
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-semibold">
              Celular
            </label>
            <input
              id="phone"
              name="phone"
              required
              inputMode="tel"
              autoComplete="tel"
              title="Escribirlo no cobra ni cambia el total guardado."
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted">
              El mismo de 10 dígitos que dejaste al pedir. Sin número y celular válidos el botón queda bloqueado. Consultar no cobra ni cambia el total guardado.
            </p>
          </div>
          {canSearch ? (
            <p className="text-sm leading-5 text-ink">
              Se abre {orderNumber} solo si el celular {phoneNumber} coincide. No cobra ni cambia el total guardado.
            </p>
          ) : null}
          {state.error ? (
            <p role="alert" className="rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
              {state.error}
            </p>
          ) : null}
          <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
            <button
              type="submit"
              title="Consultar no cobra ni cambia el total guardado."
              disabled={pending || !canSearch}
              className={`inline-flex h-9 scroll-mb-24 sm:min-w-56 items-center justify-center rounded-[10px] bg-accent px-3 text-sm font-extrabold text-primary-dark ${
                pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-55"
              }`}
            >
              {pending ? "Buscando…" : "Ver el pedido · no cobra"}
            </button>
          </nav>
        </form>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-sm focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none";
