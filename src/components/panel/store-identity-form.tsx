"use client";

import { useActionState } from "react";
import type { StoreIdentity } from "@/lib/store-identity";
import { updateStoreIdentityAction, type StoreIdentityState } from "@/server/store-identity";

const initial: StoreIdentityState = { error: null, message: null };

export function StoreIdentityForm({
  identity,
  canEdit,
}: {
  identity: StoreIdentity;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(updateStoreIdentityAction, initial);

  return (
    <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3" aria-labelledby="identidad-tienda">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Tienda pública</p>
      <h2 id="identidad-tienda" className="mt-0.5 text-sm font-semibold">
        Identidad visible
      </h2>
      <p className="mt-1 text-sm text-muted">
        Nombre, frase y WhatsApp que ve el cliente. La marca COMPRUKI se mantiene. Guardar no conecta Dropi ni envía
        mensajes.
      </p>

      {!identity.tableReady ? (
        <p role="status" className="mt-2 text-sm font-medium text-coral">
          Falta supabase/migrations/015_store_identity.sql. Sin ella no se guarda la frase ni el WhatsApp.
        </p>
      ) : null}

      {!canEdit ? (
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Nombre</dt>
            <dd className="mt-0.5 text-sm font-semibold">{identity.name}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">WhatsApp</dt>
            <dd className="mt-0.5 text-sm font-semibold">{identity.whatsapp || "Sin celular"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Frase</dt>
            <dd className="mt-0.5 text-sm text-muted">{identity.tagline || "Usa el texto por defecto de la tienda."}</dd>
          </div>
          <p className="sm:col-span-2 text-sm text-muted">Solo el propietario guarda estos datos.</p>
        </dl>
      ) : (
        <form action={action} className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Nombre de la tienda</span>
            <input
              name="name"
              required
              maxLength={80}
              defaultValue={identity.name}
              className="h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-sm focus:border-accent focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Frase pública</span>
            <textarea
              name="tagline"
              rows={3}
              maxLength={220}
              defaultValue={identity.tagline}
              placeholder="Ej. Ropa y accesorios. Pagas al recibir. El envío se acuerda aparte."
              className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
            <span className="mt-1 block text-xs text-muted">Vacío: se usa el texto por defecto de COMPRUKI.</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">WhatsApp de contacto</span>
            <input
              name="whatsapp"
              inputMode="tel"
              maxLength={14}
              defaultValue={identity.whatsapp}
              placeholder="3001234567"
              className="h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-sm focus:border-accent focus:outline-none"
            />
            <span className="mt-1 block text-xs text-muted">
              10 dígitos que empiecen en 3. Vacío: sin botón. Abrirlo es a mano; Compruki no envía.
            </span>
          </label>
          <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
            <button
              type="submit"
              disabled={pending || !identity.tableReady}
              title="Guardarlo no conecta Dropi ni envía WhatsApp."
              className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
            >
              {pending ? "Guardando…" : "Guardar identidad"}
            </button>
          </nav>
          {state.error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {state.error}
            </p>
          ) : null}
          {state.message ? (
            <p role="status" className="text-sm font-medium text-accent-strong">
              {state.message}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
