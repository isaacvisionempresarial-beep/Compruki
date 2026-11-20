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
        <p className="text-[10px] font-bold tracking-[0.08em] text-accent-strong uppercase">Seguimiento</p>
        <h1 className="mt-1 text-[24px] leading-7 font-extrabold tracking-tight">Consultar pedido</h1>
        <p className="mt-1 max-w-xl text-sm leading-5 text-muted">
          Número del pedido y celular de la entrega. Consultar no cobra ni cambia el total guardado. Dropi no está conectado.
        </p>
      </section>

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_13.5rem]">
        <form action={formAction} className="elevate-1 order-2 space-y-2 rounded-[14px] border border-line bg-card px-3 py-2 xl:order-1">
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
          <button
            type="submit"
            disabled={pending || !canSearch}
            className={`inline-flex h-10 w-full scroll-mb-24 items-center justify-center rounded-[10px] bg-accent text-sm font-extrabold text-primary-dark ${
              pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-55"
            }`}
          >
            {pending ? "Buscando…" : "Ver el pedido · no cobra"}
          </button>
        </form>

        <aside className="elevate-1 order-1 rounded-[14px] border border-line bg-card px-3 py-2 xl:sticky xl:top-[3rem] xl:order-2">
          <h2 className="text-sm font-semibold">Qué necesitas</h2>
          <ul className="mt-2 space-y-2 text-xs leading-5">
            <li>
              <span className="font-semibold text-sm">Número</span>
              <span className="mt-0.5 block text-muted">Empieza por P- y los dígitos al confirmar.</span>
            </li>
            <li>
              <span className="font-semibold text-sm">Celular</span>
              <span className="mt-0.5 block text-muted">10 dígitos, empieza por 3. Debe coincidir.</span>
            </li>
          </ul>
          <p className="mt-3 text-xs leading-5 text-muted">
            Solo estado en la tienda. Consultar no cobra ni cambia el total guardado. Dropi no está conectado. Sin guía ni fecha exacta.
          </p>
          <Link
            href="/tienda/condiciones"
            className="mt-3 inline-flex w-full justify-center text-xs font-semibold text-accent-strong"
          >
            Condiciones
          </Link>
        </aside>
      </div>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-sm focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none";
