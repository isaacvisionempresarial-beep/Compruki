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
    <div className="mx-auto max-w-xl space-y-3">
      <section
        className="store-hero store-rise relative overflow-hidden rounded-[18px] border border-line bg-card"
        style={{ animationDelay: "40ms" }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-card via-card to-[#e8eef5]" aria-hidden="true" />
        <div className="store-hero-glow pointer-events-none absolute inset-0 opacity-45" aria-hidden="true" />
        <div className="relative z-10 grid items-center gap-3 p-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(8.5rem,12.5rem)] sm:gap-4 sm:p-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.1em] text-accent-strong uppercase">Pedido</p>
            <h1 className="store-display mt-1 text-[1.7rem] leading-tight font-extrabold tracking-[-0.03em]">Consultar pedido</h1>
            <p className="mt-1.5 text-sm leading-5 text-muted">
              Con el número (P-…) y el celular de la entrega. Consultar no cobra ni cambia el total.
            </p>
          </div>
          <div className="relative isolate mx-auto w-full max-w-[12.5rem] sm:mx-0 sm:justify-self-end" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/store/lookup-hero.jpg?v=1"
              alt=""
              width={640}
              height={360}
              decoding="async"
              className="h-24 w-full rounded-[14px] object-cover object-center ring-1 ring-line/80 sm:h-28"
            />
          </div>
        </div>
      </section>

      <form
        action={formAction}
        className="store-rise elevate-1 space-y-2.5 rounded-[14px] border border-line bg-card px-3.5 py-3.5"
        style={{ animationDelay: "110ms" }}
        aria-labelledby="consulta-pedido"
      >
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</p>
          <h2 id="consulta-pedido" className="mt-0.5 text-sm font-semibold">Número y celular</h2>
          <ul className="grid gap-2 rounded-[10px] border border-line bg-canvas px-3 py-2 text-xs leading-5 text-muted sm:grid-cols-2">
            <li>
              <span className="font-semibold text-ink">Número</span>
              <span className="mt-0.5 block">Empieza por P- (ej. P-2001).</span>
            </li>
            <li>
              <span className="font-semibold text-ink">Celular</span>
              <span className="mt-0.5 block">10 dígitos, inicia en 3. Debe coincidir.</span>
            </li>
          </ul>
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
          <nav aria-label="Consulta" className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</span>
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
        <nav aria-label="Vista" className="flex flex-wrap items-center gap-2">
          <Link
            href="/tienda"
            className="inline-flex h-9 items-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark"
          >
            Volver a la tienda
          </Link>
          <Link
            href="/tienda/condiciones"
            title="Leerlas no registra pedido ni cobra."
            className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
          >
            Condiciones
          </Link>
        </nav>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-sm focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none";
