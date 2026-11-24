"use client";

import { PERIODS, type Period } from "@/lib/demo-data";
import type { CloseBasis } from "@/lib/store-order";

const BASES: Array<{ id: CloseBasis; label: string }> = [
  { id: "creados", label: "Creados" },
  { id: "movidos", label: "Movidos" },
];

export function PeriodControl({
  period,
  onChange,
  name,
  legend,
  wide = false,
}: {
  period: Period;
  onChange: (period: Period) => void;
  name: string;
  legend: string;
  wide?: boolean;
}) {
  return (
    <fieldset className={wide ? "w-full" : "w-full sm:w-auto"}>
      <legend className="sr-only">{legend}.</legend>
      <div className="elevate-1 grid h-10 w-full grid-cols-3 rounded-[10px] border border-line bg-card p-1">
        {PERIODS.map((item) => (
          <label key={item.id} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={item.id}
              checked={period === item.id}
              onChange={() => onChange(item.id)}
              className="peer sr-only"
            />
            <span
              className={
                period === item.id
                  ? "flex min-h-8 items-center justify-center rounded-[8px] bg-primary px-2.5 text-sm font-semibold text-on-dark peer-focus-visible:outline peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#25C7A5]"
                  : "flex min-h-8 items-center justify-center rounded-[8px] px-2.5 text-sm font-semibold text-muted peer-focus-visible:outline peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#25C7A5]"
              }
            >
              {item.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CloseBasisControl({
  basis,
  onChange,
  name,
  wide = false,
}: {
  basis: CloseBasis;
  onChange: (basis: CloseBasis) => void;
  name: string;
  wide?: boolean;
}) {
  return (
    <fieldset className={wide ? "w-full" : "w-full sm:w-auto"}>
      <legend className="sr-only">Qué fecha usa el período.</legend>
      <div className="elevate-1 grid h-10 w-full grid-cols-2 rounded-[10px] border border-line bg-card p-1">
        {BASES.map((item) => (
          <label key={item.id} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={item.id}
              checked={basis === item.id}
              title={
                item.id === "movidos"
                  ? "Movidos incluye un pedido viejo si cambió en el período. El total guardado sigue siendo el del pedido. No cobra."
                  : "Creados mira solo la fecha en que entró el pedido. No cobra ni cambia el total guardado."
              }
              onChange={() => onChange(item.id)}
              className="peer sr-only"
            />
            <span
              className={
                basis === item.id
                  ? "flex min-h-8 items-center justify-center rounded-[8px] bg-primary px-2.5 text-sm font-semibold text-on-dark peer-focus-visible:outline peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#25C7A5]"
                  : "flex min-h-8 items-center justify-center rounded-[8px] px-2.5 text-sm font-semibold text-muted peer-focus-visible:outline peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#25C7A5]"
              }
            >
              {item.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
