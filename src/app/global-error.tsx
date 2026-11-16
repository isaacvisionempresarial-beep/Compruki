"use client";

import { Plus_Jakarta_Sans } from "next/font/google";
import { useEffect } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { ErrorDigest } from "@/components/status-page";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";

  return (
    <html lang="es-CO">
      <head>
        <title>Algo falló · COMPRUKI</title>
      </head>
      <body className={`${jakarta.variable} font-sans antialiased`}>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <main id="contenido" tabIndex={-1} className="min-h-dvh bg-canvas px-4 py-4 outline-none">
          <div className="mx-auto max-w-6xl">
            <Wordmark />
            <p className="mt-4 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">COMPRUKI</p>
            <h1 className="mt-1 text-[24px] leading-7 font-extrabold tracking-tight">Algo falló en la aplicación</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-5 text-muted">
              Este fallo afectó el contenedor principal. Puedes intentar de nuevo o salir a una pantalla estable. No se
              envía nada a Dropi.
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
                  <a
                    href="/tienda"
                    className="inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-canvas px-4 text-sm font-semibold"
                  >
                    Ir a la tienda
                  </a>
                  <a
                    href="/panel"
                    className="inline-flex h-10 items-center justify-center rounded-[10px] bg-canvas px-4 text-sm font-semibold border border-line"
                  >
                    Ir al panel
                  </a>
                </div>
                <ErrorDigest digest={digest || undefined} />
              </div>
              <aside className="elevate-1 order-1 rounded-[14px] border border-line bg-card px-3 py-2 xl:sticky xl:top-[3rem] xl:order-2">
                <h2 className="text-sm font-semibold">Qué significa</h2>
                <ul className="mt-2 space-y-2 text-xs leading-5">
                  <li>
                    <span className="font-semibold text-sm">Datos</span>
                    <span className="mt-0.5 block text-muted">
                      El carrito del navegador y los pedidos ya guardados no se borran solo por este fallo.
                    </span>
                  </li>
                  <li>
                    <span className="font-semibold text-sm">Dropi</span>
                    <span className="mt-0.5 block text-muted">
                      No está conectado. Este error no crea ni envía un pedido a Dropi.
                    </span>
                  </li>
                </ul>
              </aside>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
