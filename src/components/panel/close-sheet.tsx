"use client";

import { useState } from "react";
import { closeSheetText, closeSpanPhrase, type CloseBasis, type OrderSpan, type SizeGuide, type StoreOrder } from "@/lib/store-order";

export function CloseSheet({
  orders,
  period,
  basis,
  guides = [],
  fieldId,
}: {
  orders: StoreOrder[];
  period: OrderSpan;
  basis: CloseBasis;
  guides?: SizeGuide[];
  fieldId: string;
}) {
  const text = closeSheetText(orders, period, basis, guides);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  function copy() {
    const node = document.getElementById(fieldId);
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
    <section className="mt-3" aria-labelledby={`${fieldId}-titulo`}>
      <h3 id={`${fieldId}-titulo`} className="text-sm font-semibold">
        Cierre para copiar
      </h3>
      <p className="mt-0.5 text-xs leading-5 text-muted">
        Mismas cifras de {closeSpanPhrase(period, basis)}. Copiarlo no cobra ni cambia pedidos. No crea el pedido en Dropi.
        {period !== "todo" && basis === "movidos" ? " El total guardado es el del pedido, no lo cobrado en ese día." : ""}
      </p>
      <div className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2">
        <label className="text-sm font-semibold" htmlFor={fieldId}>
          Texto del cierre
          <textarea
            id={fieldId}
            title="Leerlo no cobra ni cambia el total guardado."
            readOnly
            rows={8}
            value={text}
            className="mt-1 min-h-32 w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm leading-5 font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
          />
        </label>
        <button
          type="button"
          title="Copiar no cobra ni cambia el total guardado. No crea el pedido en Dropi."
          className="mt-2 inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold"
          onClick={copy}
        >
          {copied === "ok" ? "Cierre copiado" : "Copiar cierre"}
        </button>
        {copied === "ok" ? (
          <p role="status" className="mt-2 text-sm text-accent-strong">
            Listo para pegarlo a mano. Copiar no cobra. Dropi no está conectado: desde aquí no se crea el pedido ni cambia el total guardado.
          </p>
        ) : null}
        {copied === "fail" ? (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger">
            No se pudo copiar. El texto queda seleccionado. No cobra. El total guardado no cambia.
          </p>
        ) : null}
      </div>
    </section>
  );
}
