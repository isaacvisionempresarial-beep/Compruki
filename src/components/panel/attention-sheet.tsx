"use client";

import { useState } from "react";
import { attentionSheetText, type CostGuide, type PriceGuide, type SizeGuide, type StoreOrder } from "@/lib/store-order";

export function AttentionSheet({
  orders,
  guides,
  priceGuides = [],
  costGuides = [],
  canManageOrderMoney,
}: {
  orders: StoreOrder[];
  guides: SizeGuide[];
  priceGuides?: PriceGuide[];
  costGuides?: CostGuide[];
  canManageOrderMoney: boolean;
}) {
  const text = attentionSheetText(orders, guides, canManageOrderMoney, priceGuides, costGuides);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  function copy() {
    const node = document.getElementById("hoja-atender");
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
    <section className="mt-3" aria-labelledby="hoja-atender-titulo">
      <h3 id="hoja-atender-titulo" className="text-sm font-semibold">
        Por atender para copiar
      </h3>
      <p className="mt-0.5 text-xs leading-5 text-muted">
        La misma cola, sin recorte de fecha. Si el paso es avisar, trae el mensaje. Si es anotar el número o el despacho, trae el texto para Dropi, con celular y dirección. Si la ficha de hoy no es el precio guardado, van los dos montos. Si no es el costo, el envío o las comisiones guardadas, van las dos cifras. Copiarla no cobra, no envía el mensaje, no reescribe lo guardado y no crea el pedido.
      </p>
      <div className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2">
        <label className="text-sm font-semibold" htmlFor="hoja-atender">
          Texto de la cola
          <textarea
            id="hoja-atender"
            title="Leerlo no envía el mensaje ni cambia el total guardado."
            readOnly
            rows={8}
            value={text}
            className="mt-1 min-h-32 w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm leading-5 font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
          />
        </label>
        <button
          type="button"
          title="Copiar no envía el mensaje ni cambia el total guardado. No crea el pedido en Dropi."
          className="mt-2 inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold"
          onClick={copy}
        >
          {copied === "ok" ? "Cola copiada" : "Copiar cola"}
        </button>
        {copied === "ok" ? (
          <p role="status" className="mt-2 text-sm text-accent-strong">
            Lista para pegarla a mano. Copiar no cobra ni envía el mensaje. Dropi no está conectado: desde aquí no se crea el pedido ni cambia el total guardado.
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
