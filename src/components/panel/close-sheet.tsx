"use client";

import { useState } from "react";
import { closeSheetText, closeSpanPhrase, costDrift, priceDrift, type CloseBasis, type CostGuide, type OrderSpan, type PriceGuide, type SizeGuide, type StoreOrder } from "@/lib/store-order";

export function CloseSheet({
  orders,
  rest = [],
  period,
  basis,
  guides = [],
  priceGuides = [],
  costGuides = [],
  fieldId,
}: {
  orders: StoreOrder[];
  rest?: StoreOrder[];
  period: OrderSpan;
  basis: CloseBasis;
  guides?: SizeGuide[];
  priceGuides?: PriceGuide[];
  costGuides?: CostGuide[];
  fieldId: string;
}) {
  const text = closeSheetText(orders, period, basis, guides, priceGuides, costGuides, rest);
  const drifted = orders.some((order) => priceDrift(order, priceGuides).length > 0);
  const costDrifted = orders.some((order) => costDrift(order, costGuides).length > 0);
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
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Copia</p>
      <h3 id={`${fieldId}-titulo`} className="mt-0.5 text-sm font-semibold">
        Cierre para copiar
      </h3>
      <p className="mt-0.5 text-xs leading-5 text-muted">
        Mismas cifras de {closeSpanPhrase(period, basis)}. Si la ficha de hoy no es el precio guardado, van los dos montos. Si no es el costo, el envío o las comisiones guardadas, van las dos cifras.
        {period === "todo" ? "" : " Si un pedido que ya cuenta queda fuera de este período, el texto dice su margen."} Copiarlo no cobra, no reescribe lo guardado y no crea el pedido en Dropi.
        {period !== "todo" && basis === "movidos" ? " El total guardado es el del pedido, no lo cobrado en ese día." : ""}
      </p>
      {drifted ? (
        <p className="mt-2 text-sm leading-5 text-warning">
          Hay pedidos con otro precio en la ficha de hoy. El texto trae los dos montos. El cierre sigue con el total guardado. No es dinero cobrado.
        </p>
      ) : null}
      {costDrifted ? (
        <p className="mt-2 text-sm leading-5 text-warning">
          Hay pedidos con otro costo en la ficha de hoy. El texto trae las dos cifras. El cierre sigue con el costo guardado y el total guardado. No es dinero cobrado.
        </p>
      ) : null}
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
        <nav aria-label="Consulta" className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</span>
          <button
            type="button"
            title="Copiar no cobra ni cambia el total guardado. No crea el pedido en Dropi."
            className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
            onClick={copy}
          >
            {copied === "ok" ? "Cierre copiado" : "Copiar cierre"}
          </button>
        </nav>
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
