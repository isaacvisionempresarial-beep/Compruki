"use client";

import { useActionState, useState } from "react";
import { dropiCopyHint, dropiHandoffText, dropiNumberHint, normalizeProviderRef, type StoreOrder } from "@/lib/store-order";
import { saveProviderRefAction, type UpdateOrderState } from "@/server/store-actions";

const initialState: UpdateOrderState = { error: null, orderId: null };

const fieldClass =
  "mt-1 h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-sm font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none";

export function DropiHandoff({ order }: { order: StoreOrder }) {
  const written = normalizeProviderRef(order.providerRef ?? "");

  return (
    <div className="mt-5 space-y-3">
      <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-3" aria-labelledby="sync-numero-estado">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Estado</p>
        <h2 id="sync-numero-estado" className="mt-0.5 text-sm font-semibold">
          Número anotado
        </h2>
          {written ? (
            <p className="mt-2 text-sm font-extrabold">{written}</p>
          ) : (
            <p className="mt-2 text-sm font-extrabold text-warning">Sin anotar</p>
          )}
          <p className="mt-1 text-xs leading-5 text-muted">
            {written
              ? "Quedó escrito a mano. Dropi no está conectado: no es una guía y no se envió desde aquí."
              : "Dropi no está conectado. Todavía no hay un número anotado en este pedido."}
          </p>
      </section>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="sync-datos">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Copia</p>
          <h2 id="sync-datos" className="mt-0.5 text-sm font-semibold">
            Datos para Dropi
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Dropi no está conectado. Se copian a mano; desde aquí no se crea el pedido ni cobra. El total guardado no cambia.
          </p>
          <DropiCopy order={order} />
        </section>
        <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="sync-anotar">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Número</p>
          <h2 id="sync-anotar" className="mt-0.5 text-sm font-semibold">
            Anotar el número
          </h2>
          <DropiRefForm order={order} />
        </section>
      </div>
    </div>
  );
}

function DropiCopy({ order }: { order: StoreOrder }) {
  const text = dropiHandoffText(order);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  function copy() {
    const node = document.getElementById(`dropi-texto-${order.id}`);
    if (!(node instanceof HTMLTextAreaElement)) return;
    node.focus();
    node.select();
    let copiedByCommand = false;
    try {
      copiedByCommand = document.execCommand("copy");
    } catch {
      copiedByCommand = false;
    }
    if (copiedByCommand) {
      setCopied("ok");
      return;
    }
    void navigator.clipboard.writeText(text).then(
      () => setCopied("ok"),
      () => setCopied("fail"),
    );
  }

  return (
    <div className="mt-3 grid gap-3">
      <label className="text-sm font-semibold" htmlFor={`dropi-texto-${order.id}`}>
        Texto para cargarlo a mano
        <textarea
          id={`dropi-texto-${order.id}`}
          title="Leerlo no envía el pedido ni cobra. El total guardado no cambia."
          readOnly
          rows={12}
          value={text}
          className="mt-1 min-h-48 w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm leading-5 font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
        />
        <span className="mt-1 block font-normal leading-5 text-muted">{dropiCopyHint(order)}</span>
      </label>
      <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
        <button
          type="button"
          title="Copiar no cobra. El total guardado no cambia."
          className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
          aria-label={`Copiar datos de ${order.number}`}
          onClick={copy}
        >
          {copied === "ok" ? "Datos copiados" : "Copiar datos"}
        </button>
      </nav>
      {copied === "ok" ? (
        <p role="status" className="text-sm text-accent-strong">
          Listo para pegarlo en Dropi. Copiar no cobra. Dropi no está conectado: desde aquí no se crea el pedido ni cambia el total guardado.
        </p>
      ) : null}
      {copied === "fail" ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          No se pudo copiar. El texto queda seleccionado para copiarlo a mano. No cobra. El total guardado no cambia.
        </p>
      ) : null}
    </div>
  );
}

function DropiRefForm({ order }: { order: StoreOrder }) {
  const [value, setValue] = useState(order.providerRef ?? "");
  const [syncedRef, setSyncedRef] = useState(order.providerRef);
  if (order.providerRef !== syncedRef) {
    setSyncedRef(order.providerRef);
    setValue(order.providerRef ?? "");
  }
  const [refState, refAction, refPending] = useActionState(saveProviderRefAction, initialState);
  const nextRef = normalizeProviderRef(value);
  const currentRef = normalizeProviderRef(order.providerRef ?? "");
  const canSave = Boolean(nextRef) && nextRef !== currentRef;
  const previewText = canSave ? dropiHandoffText({ ...order, providerRef: nextRef }) : null;
  const wouldUnlockPrepare = canSave && order.status === "confirmado" && !currentRef;

  return (
    <form action={refAction} className="mt-3 grid gap-3">
      <input type="hidden" name="orderId" value={order.id} />
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Dato</p>
      <label className="text-sm font-semibold" htmlFor={`dropi-${order.id}`}>
        Número en Dropi
        <input
          id={`dropi-${order.id}`}
          title="Escribirlo no envía el pedido ni cobra. El total guardado no cambia."
          name="providerRef"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={40}
          autoComplete="off"
          className={fieldClass}
        />
        <span className="mt-1 block font-normal leading-5 text-muted">
          {dropiNumberHint(order)} El total guardado no cambia.
          {canSave ? "" : " Vacío o sin un cambio: el botón queda bloqueado."}
        </span>
      </label>
      {previewText ? (
        <p className="text-sm leading-5 text-ink">
          Si anotas, el texto para Dropi queda así. Dropi no está conectado: no crea el pedido ahí. El total guardado no cambia.
          {wouldUnlockPrepare
            ? " Con ese número el pedido queda listo para Pasar a preparación. Anotarlo no lo envía."
            : ""}
          <span className="mt-1 block whitespace-pre-line font-normal text-muted">{previewText}</span>
        </p>
      ) : null}
      {refState.orderId === order.id && refState.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {refState.error}
        </p>
      ) : null}
      <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
        <button
          type="submit"
          name="intent"
          value="guardar"
          title="Anotarlo no envía el pedido ni cobra. El total guardado no cambia."
          disabled={refPending || !canSave}
          className={`inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark ${
            refPending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
          }`}
        >
          Anotar número
        </button>
        {order.providerRef ? (
          <button
            type="submit"
            name="intent"
            value="quitar"
            title="Quitarlo no cobra. El total guardado no cambia."
            disabled={refPending}
            className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold disabled:cursor-wait"
          >
            Quitar número
          </button>
        ) : null}
      </nav>
    </form>
  );
}
