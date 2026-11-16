"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ErrorDigest } from "@/components/status-page";

export default function StoreError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";

  return (
    <div>
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Tienda</p>
      <h1 className="mt-1 text-[24px] leading-7 font-extrabold tracking-tight">No se pudo mostrar esta pantalla</h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-5 text-muted">
        El carrito de este navegador no cambia por este error. Puedes intentar de nuevo o volver a los productos.
      </p>
      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_13.5rem]">
        <div className="elevate-1 order-2 rounded-[14px] border border-line bg-card px-3 py-2 xl:order-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-10 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark"
            >
              Intentar de nuevo
            </button>
            <Link
              href="/tienda"
              className="inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-canvas px-4 text-sm font-semibold"
            >
              Ver productos
            </Link>
            <Link
              href="/tienda/carrito"
              className="inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-canvas px-4 text-sm font-semibold"
            >
              Ver carrito
            </Link>
          </div>
          <ErrorDigest digest={digest || undefined} />
        </div>
        <aside className="elevate-1 order-1 rounded-[14px] border border-line bg-card px-3 py-2 xl:sticky xl:top-[3rem] xl:order-2">
          <h2 className="text-sm font-semibold">Qué significa</h2>
          <ul className="mt-2 space-y-2 text-xs leading-5">
            <li>
              <span className="font-semibold text-sm">Reintentar</span>
              <span className="mt-0.5 block text-muted">Recarga esta pantalla. El carrito de este navegador no cambia.</span>
            </li>
            <li>
              <span className="font-semibold text-sm">Catálogo</span>
              <span className="mt-0.5 block text-muted">Los publicados siguen en Inicio.</span>
            </li>
            <li>
              <span className="font-semibold text-sm">Dropi</span>
              <span className="mt-0.5 block text-muted">No está conectado. Este error no crea ni envía un pedido a Dropi.</span>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
