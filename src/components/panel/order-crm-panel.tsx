"use client";

import Link from "next/link";
import { whatsAppHref } from "@/lib/store-order";
import { createFollowupAction } from "@/server/followup-actions";

export function OrderCrmPanel({
  orderNumber,
  customerName,
  phone,
  flash = false,
  error = null,
}: {
  orderNumber: string;
  customerName: string;
  phone: string;
  flash?: boolean;
  error?: string | null;
}) {
  const first = customerName.trim().split(/\s+/)[0] ?? "";
  const hello = first.length >= 2 ? `Hola ${first}.` : "Hola.";
  const waHref = whatsAppHref(phone, `${hello} Te escribo por tu pedido ${orderNumber}.`.slice(0, 500));

  return (
    <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="pedido-crm">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">CRM</p>
      <h2 id="pedido-crm" className="mt-0.5 scroll-mt-24 text-sm font-semibold">
        Seguimiento (AG-07)
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Crea una tarea en Clientes o abre WhatsApp a mano. No envía solo ni cambia el pedido.
      </p>
      {flash ? (
        <p role="status" className="mt-2 text-sm font-medium text-accent-strong">
          Seguimiento guardado. No se envió mensaje.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <form action={createFollowupAction} className="mt-2 space-y-2">
        <input type="hidden" name="from" value="pedido" />
        <input type="hidden" name="orderNumber" value={orderNumber} />
        <input type="hidden" name="customerName" value={customerName} />
        <input type="hidden" name="phone" value={phone} />
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Nota</span>
          <input
            name="note"
            required
            maxLength={400}
            title="Escribirla no envía."
            placeholder="Ej. Confirmar dirección / avisar estado"
            className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm focus:border-accent focus:outline-none"
          />
        </label>
        <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
          <button
            type="submit"
            title="Guardarlo no envía WhatsApp."
            className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark hover:bg-primary-soft"
          >
            Crear seguimiento
          </button>
          <Link
            href="/panel/clientes"
            className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
          >
            Ver clientes
          </Link>
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              title="Abre WhatsApp. Compruki no envía."
              className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
            >
              Abrir WhatsApp
            </a>
          ) : null}
        </nav>
      </form>
    </section>
  );
}
