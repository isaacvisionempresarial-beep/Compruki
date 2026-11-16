"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Icon } from "@/components/icons";
import { useCart } from "@/components/store/cart-state";
import { cx } from "@/lib/cx";
import { useRouteFocus } from "@/lib/use-route-focus";

export function StoreShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { count, ready } = useCart();
  const [showBenefits, setShowBenefits] = useState(false);
  useRouteFocus();
  const home = pathname === "/tienda";
  const order =
    pathname.startsWith("/tienda/pedido") ||
    pathname.startsWith("/tienda/consultar") ||
    pathname.startsWith("/tienda/condiciones");
  const cart = pathname.startsWith("/tienda/carrito") || pathname.startsWith("/tienda/pagar");
  const productPage = pathname.startsWith("/tienda/producto");
  // Ancho fijo: usePathname en SSR puede no coincidir con el cliente y romper hidratación.
  const shellWidth = "max-w-7xl";

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setShowBenefits(root.dataset.fichaBeneficios === "1");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-ficha-beneficios"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
        <div className={cx("mx-auto flex h-11 items-center justify-between gap-3 px-4", shellWidth)}>
          <Link href="/tienda" className="rounded-[10px]" aria-label="COMPRUKI, inicio de la tienda">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            {productPage ? (
              <nav className="hidden items-center gap-3 text-sm font-semibold md:flex" aria-label="En esta ficha">
                {showBenefits ? (
                  <a href="#lo-especial" className="text-muted hover:text-accent-strong">
                    Beneficios
                  </a>
                ) : null}
                <a href="#detalles" className="text-muted hover:text-accent-strong">
                  Detalles
                </a>
                <a href="#preguntas" className="text-muted hover:text-accent-strong">
                  Preguntas
                </a>
              </nav>
            ) : null}
            <Link
              href="/tienda/carrito"
              aria-label={ready ? (count === 1 ? "Carrito, 1 producto" : `Carrito, ${count} productos`) : "Carrito"}
              className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line bg-canvas px-2.5 text-sm font-semibold"
            >
              <Icon name="bag" className="h-5 w-5" aria-hidden="true" />
              <span aria-hidden="true">Carrito</span>
              <span className="min-w-5 rounded-[8px] bg-primary px-1.5 text-center text-xs text-on-dark tabular-nums" aria-live="polite">
                {ready ? count : 0}
              </span>
            </Link>
          </div>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className={cx("mx-auto px-4 pt-3 pb-[4.5rem] outline-none", shellWidth)}>
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card" aria-label="Tienda">
        <div className={cx("mx-auto grid grid-cols-3", shellWidth)}>
          <Link
            href="/tienda"
            aria-current={home ? "page" : undefined}
            className={cx(
              "flex h-11 items-center justify-center gap-2 text-sm font-semibold",
              home ? "text-accent-strong" : "text-muted",
            )}
          >
            <Icon name="store" className="h-5 w-5" aria-hidden="true" />
            Inicio
          </Link>
          <Link
            href="/tienda/consultar"
            aria-current={order ? "page" : undefined}
            className={cx(
              "flex h-11 items-center justify-center gap-2 text-sm font-semibold",
              order ? "text-accent-strong" : "text-muted",
            )}
          >
            <Icon name="orders" className="h-5 w-5" aria-hidden="true" />
            Pedido
          </Link>
          <Link
            href="/tienda/carrito"
            aria-current={cart ? "page" : undefined}
            aria-label={ready ? (count === 1 ? "Carrito, 1 producto" : `Carrito, ${count} productos`) : "Carrito"}
            className={cx(
              "flex h-11 items-center justify-center gap-2 text-sm font-semibold",
              cart ? "text-accent-strong" : "text-muted",
            )}
          >
            <Icon name="bag" className="h-5 w-5" aria-hidden="true" />
            Carrito
          </Link>
        </div>
      </nav>
    </div>
  );
}
