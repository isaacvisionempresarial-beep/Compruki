"use client";

import { PERIODS, type Period } from "@/lib/demo-data";

export function PeriodControl({
  period,
  onChange,
  name,
  legend,
}: {
  period: Period;
  onChange: (period: Period) => void;
  name: string;
  legend: string;
}) {
  return (
    <fieldset className="w-full sm:w-auto">
      <legend className="sr-only">{legend}</legend>
      <div className="elevate-1 grid grid-cols-3 rounded-[10px] border border-line bg-card p-1">
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
