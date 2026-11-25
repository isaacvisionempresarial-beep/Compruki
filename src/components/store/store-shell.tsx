"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Icon } from "@/components/icons";
import { useCart } from "@/components/store/cart-state";
import { cx } from "@/lib/cx";
import type { StoreIdentity } from "@/lib/store-identity";
import { whatsAppHref } from "@/lib/store-order";
import { useRouteFocus } from "@/lib/use-route-focus";

export function StoreShell({
  children,
  identity = null,
  accountLabel = null,
}: {
  children: ReactNode;
  identity?: StoreIdentity | null;
  /** Primer nombre o usuario si hay sesión de comprador. */
  accountLabel?: string | null;
}) {
  const contactHref =
    identity?.whatsapp && identity.name
      ? whatsAppHref(identity.whatsapp, `Hola. Escribo por ${identity.name}.`)
      : null;
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
  /** Inicio, carrito y pago: mismo eje que las tarjetas. */
  const shellWidth = home || cart ? "max-w-5xl" : "max-w-7xl";

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setShowBenefits(root.dataset.fichaBeneficios === "1");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-ficha-beneficios"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="store-surface min-h-dvh">
      <header className="store-chrome-in sticky top-0 z-20 border-b border-line/80 bg-card/80 backdrop-blur-md">
        <div className={cx("mx-auto flex h-14 items-center justify-between gap-3 px-4", shellWidth)}>
          <Link
            href="/tienda"
            target="_self"
            title="Ir al inicio no registra pedido ni cobra."
            className="min-w-0 rounded-[10px]"
            aria-label="COMPRUKÍ, inicio de la tienda"
          >
            <BrandLogo className="h-8 max-w-[10.5rem]" priority />
            {identity?.name ? (
              <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted">{identity.name}</span>
            ) : null}
          </Link>
          <div className="flex items-center gap-2">
            {contactHref ? (
              <a
                href={contactHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Abre WhatsApp a mano. Compruki no envía."
                className="hidden h-10 items-center rounded-[12px] border border-line bg-canvas/90 px-3 text-sm font-semibold transition-colors hover:border-accent/40 hover:bg-card sm:inline-flex"
              >
                WhatsApp
              </a>
            ) : null}
            {productPage ? (
              <nav className="hidden items-center gap-3 text-sm font-semibold md:flex" aria-label="En esta ficha">
                <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Ficha</span>
                {showBenefits ? (
                  <a href="#lo-especial" title="Ir ahí no cambia el precio publicado ni crea un pedido." className="text-muted hover:text-accent-strong">
                    Beneficios
                  </a>
                ) : null}
                <a href="#detalles" title="Ir ahí no cambia el precio publicado ni crea un pedido." className="text-muted hover:text-accent-strong">
                  Detalles
                </a>
                <a href="#preguntas" title="Ir ahí no cambia el precio publicado ni crea un pedido." className="text-muted hover:text-accent-strong">
                  Preguntas
                </a>
              </nav>
            ) : null}
            <Link
              href="/tienda/cuenta"
              target="_self"
              title={accountLabel ? `Sesión de ${accountLabel}. Ver cuenta. No cobra.` : "Entrar o ver tu cuenta. No cobra."}
              aria-label={accountLabel ? `Cuenta, ${accountLabel}` : "Cuenta"}
              className="inline-flex h-10 max-w-[9.5rem] items-center gap-1.5 rounded-[12px] border border-line bg-canvas/90 px-3 text-sm font-semibold transition-colors hover:border-accent/40 hover:bg-card sm:max-w-[12rem]"
            >
              {accountLabel ? (
                <>
                  <span className="hidden text-[10px] font-bold tracking-[0.06em] text-accent-strong uppercase sm:inline">
                    Sesión
                  </span>
                  <span className="truncate">{accountLabel}</span>
                </>
              ) : (
                "Cuenta"
              )}
            </Link>
            <Link
              href="/tienda/carrito"
              target="_self"
              title="Abrir el carrito no cobra ni registra un pedido."
              aria-label={ready ? (count === 1 ? "Carrito, 1 producto" : `Carrito, ${count} productos`) : "Carrito"}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-line bg-canvas/90 px-3 text-sm font-semibold transition-colors hover:border-accent/40 hover:bg-card"
            >
              <Icon name="bag" className="h-5 w-5" aria-hidden="true" />
              <span className="hidden sm:inline" aria-hidden="true">
                Carrito
              </span>
              <span
                className={cx(
                  "min-w-5 rounded-[8px] bg-primary px-1.5 text-center text-xs text-on-dark tabular-nums",
                  ready && count > 0 ? "store-cart-badge-live" : "",
                )}
                aria-live="polite"
              >
                {ready ? count : 0}
              </span>
            </Link>
          </div>
        </div>
      </header>
      <main
        key={pathname}
        id="contenido"
        tabIndex={-1}
        className={cx("store-page-enter mx-auto px-4 pt-4 pb-[5.25rem] outline-none", shellWidth)}
      >
        {children}
      </main>
      <nav
        className="store-chrome-in fixed inset-x-0 bottom-0 z-20 border-t border-line/80 bg-card/92 backdrop-blur-md"
        style={{ animationDelay: "60ms" }}
        aria-label="Tienda"
      >
        <div className={cx("mx-auto grid grid-cols-3", shellWidth)}>
          <Link
            href="/tienda"
            target="_self"
            title="Ir a inicio no cobra ni registra un pedido."
            aria-current={home ? "page" : undefined}
            className={cx(
              "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors sm:flex-row sm:gap-2 sm:text-sm",
              home ? "store-nav-active" : "text-muted",
            )}
          >
            <Icon name="store" className="h-5 w-5" aria-hidden="true" />
            Inicio
          </Link>
          <Link
            href="/tienda/consultar"
            target="_self"
            title="Consultar no cobra ni cambia el total guardado."
            aria-current={order ? "page" : undefined}
            className={cx(
              "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors sm:flex-row sm:gap-2 sm:text-sm",
              order ? "store-nav-active" : "text-muted",
            )}
          >
            <Icon name="orders" className="h-5 w-5" aria-hidden="true" />
            Pedido
          </Link>
          <Link
            href="/tienda/carrito"
            target="_self"
            title="Abrir el carrito no cobra ni registra un pedido."
            aria-current={cart ? "page" : undefined}
            aria-label={ready ? (count === 1 ? "Carrito, 1 producto" : `Carrito, ${count} productos`) : "Carrito"}
            className={cx(
              "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors sm:flex-row sm:gap-2 sm:text-sm",
              cart ? "store-nav-active" : "text-muted",
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
