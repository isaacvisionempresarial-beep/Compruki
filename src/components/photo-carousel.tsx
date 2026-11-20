"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";

export type PhotoSlide = {
  key: string;
  src: string;
  alt: string;
};

export function PhotoCarousel({
  slides,
  label,
  frameClassName,
  singleClassName = "max-h-[70vh] w-full object-contain",
  roundedClassName = "rounded-[14px]",
  index,
  onIndexChange,
  onOpen,
  openLabel = "Ampliar foto",
  corner,
  priority = false,
  compact = false,
  dense = false,
}: {
  slides: PhotoSlide[];
  label: string;
  frameClassName: string;
  singleClassName?: string;
  roundedClassName?: string;
  index?: number;
  onIndexChange?: (index: number) => void;
  onOpen?: () => void;
  openLabel?: string;
  corner?: ReactNode;
  priority?: boolean;
  compact?: boolean;
  dense?: boolean;
}) {
  const [inner, setInner] = useState(0);
  const [failed, setFailed] = useState<Record<string, true>>({});
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const count = slides.length;
  if (count === 0) return null;

  const raw = index ?? inner;
  const current = ((raw % count) + count) % count;
  const slide = slides[current]!;
  const multiple = count > 1;
  const broken = Boolean(failed[slide.key]);

  function go(delta: number) {
    const next = (current + delta + count) % count;
    onIndexChange?.(next);
    if (index === undefined) setInner(next);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!multiple) return;
    if ((event.target as HTMLElement).closest("[data-carousel-control]")) return;
    start.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    swiped.current = true;
    go(dx < 0 ? 1 : -1);
  }

  const photo = broken ? (
    <div className={multiple ? "grid h-full w-full place-items-center px-3 text-center" : "grid min-h-36 w-full place-items-center px-3 text-center"}>
      <span>
        <span className="block text-xs font-semibold text-muted">Sin foto</span>
        <span className="mt-1 block text-[11px] leading-4 text-muted">El precio publicado no cambia.</span>
      </span>
    </div>
  ) : (
    // Ruta local dinámica + Sin foto en onError; next/image no aporta aquí.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={slide.src}
      alt={slide.alt}
      className={multiple ? "h-full w-full object-contain" : singleClassName}
      fetchPriority={priority && current === 0 ? "high" : "auto"}
      draggable={false}
      onError={() => setFailed((prev) => (prev[slide.key] ? prev : { ...prev, [slide.key]: true }))}
    />
  );

  return (
    <div
      className={`relative overflow-hidden bg-subtle ${roundedClassName} ${multiple ? `${frameClassName} touch-pan-y` : ""}`}
      role="region"
      aria-roledescription="carrusel"
      aria-label={label}
      tabIndex={multiple ? 0 : undefined}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onKeyDown={(event) => {
        if (!multiple) return;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          go(1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          go(-1);
        }
      }}
    >
      {onOpen ? (
        <button
          type="button"
          className={multiple ? "absolute inset-0 cursor-zoom-in border-0 bg-transparent p-0" : "block w-full cursor-zoom-in border-0 bg-transparent p-0"}
          aria-label={openLabel}
          onClick={() => {
            if (swiped.current) {
              swiped.current = false;
              return;
            }
            onOpen();
          }}
        >
          {photo}
        </button>
      ) : (
        photo
      )}
      {corner}
      {multiple ? (
        <>
          <p className={`pointer-events-none absolute z-10 rounded-[8px] bg-card/90 font-bold text-ink tabular-nums shadow-sm ${dense ? "top-1.5 right-1.5 px-1.5 py-0.5 text-[10px]" : "top-3 right-3 px-2.5 py-1 text-[11px]"}`}>
            {current + 1} / {count}
          </p>
          <button
            type="button"
            data-carousel-control="prev"
            className={`absolute top-1/2 z-10 grid -translate-y-1/2 place-items-center rounded-full border-0 bg-card/90 text-ink shadow-md backdrop-blur-sm hover:bg-card ${dense ? "left-1.5 h-7 w-7" : compact ? "left-3 h-8 w-8" : "left-3 h-10 w-10"}`}
            aria-label="Foto anterior"
            title="Pasarla no cambia el precio publicado ni crea un pedido."
            onClick={() => go(-1)}
          >
            <Chevron direction="left" small={dense} />
          </button>
          <button
            type="button"
            data-carousel-control="next"
            className={`absolute top-1/2 z-10 grid -translate-y-1/2 place-items-center rounded-full border-0 bg-card/90 text-ink shadow-md backdrop-blur-sm hover:bg-card ${dense ? "right-1.5 h-7 w-7" : compact ? "right-3 h-8 w-8" : "right-3 h-10 w-10"}`}
            aria-label="Foto siguiente"
            title="Pasarla no cambia el precio publicado ni crea un pedido."
            onClick={() => go(1)}
          >
            <Chevron direction="right" small={dense} />
          </button>
          <div className={`absolute left-0 z-10 flex w-full justify-center ${dense ? "bottom-1.5 gap-1" : "bottom-3 gap-1.5"}`}>
            {slides.map((item, itemIndex) => (
              <button
                key={item.key}
                type="button"
                data-carousel-control="dot"
                aria-label={`Ver foto ${itemIndex + 1}`}
                title="Pasarla no cambia el precio publicado ni crea un pedido."
                aria-current={itemIndex === current ? "true" : undefined}
                className={`h-1.5 rounded-full border-0 shadow-[0_0_0_1px_rgba(34,38,56,0.35)] ${itemIndex === current ? "w-4 bg-card" : "w-1.5 bg-card/70"}`}
                onClick={() => {
                  onIndexChange?.(itemIndex);
                  if (index === undefined) setInner(itemIndex);
                }}
              />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            Foto {current + 1} de {count}
          </p>
        </>
      ) : null}
    </div>
  );
}

function Chevron({ direction, small = false }: { direction: "left" | "right"; small?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={small ? "h-4 w-4" : "h-5 w-5"} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === "left" ? <path d="M14.5 6.5 8.5 12l6 5.5" /> : <path d="M9.5 6.5 15.5 12l-6 5.5" />}
    </svg>
  );
}
