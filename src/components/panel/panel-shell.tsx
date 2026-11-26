"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Icon, type IconName } from "@/components/icons";
import { cx } from "@/lib/cx";
import { useRouteFocus } from "@/lib/use-route-focus";
import { signOut } from "@/server/auth";

/** Enlaces del menú del panel: siempre misma pestaña (salvo Ctrl/Cmd+clic). */
function PanelMenuLink({
  href,
  title,
  className,
  children,
  onCloseMenu,
  "aria-current": ariaCurrent,
  "aria-label": ariaLabel,
}: {
  href: string;
  title?: string;
  className?: string;
  children: ReactNode;
  onCloseMenu?: () => void;
  "aria-current"?: "page" | undefined;
  "aria-label"?: string;
}) {
  const router = useRouter();

  function go(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onCloseMenu?.();
    router.push(href);
  }

  return (
    <Link
      href={href}
      target="_self"
      title={title}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      className={className}
      onClick={go}
    >
      {children}
    </Link>
  );
}

const PanelQueryContext = createContext("");

export function usePanelQuery() {
  return useContext(PanelQueryContext);
}

type NavItem = { id: string; label: string; icon: IconName; href: string; requiresUsersManage?: boolean };

function buildNavGroups(canManageUsers: boolean) {
  const groups: Array<{ id: string; label: string; items: NavItem[] }> = [
    {
      id: "tienda",
      label: "Tienda",
      items: [
        { id: "panel", label: "Panel principal", icon: "panel", href: "/panel" },
        { id: "pedidos", label: "Pedidos", icon: "orders", href: "/panel/pedidos" },
        { id: "clientes", label: "Clientes", icon: "people", href: "/panel/clientes" },
        { id: "catalogo", label: "Catálogo", icon: "catalog", href: "/panel/catalogo" },
        { id: "rentabilidad", label: "Rentabilidad", icon: "chart", href: "/panel/rentabilidad" },
      ],
    },
    {
      id: "operacion",
      label: "Operación",
      items: [
        { id: "sincronizacion", label: "Sincronización", icon: "sync", href: "/panel/sincronizacion" },
        { id: "inbox", label: "Inbox", icon: "chat", href: "/panel/inbox" },
        { id: "whatsapp", label: "WhatsApp", icon: "link", href: "/panel/whatsapp" },
        { id: "conexiones", label: "Conexiones", icon: "link", href: "/panel/conexiones" },
      ],
    },
    {
      id: "sistema",
      label: "Sistema",
      items: [
        { id: "agentes", label: "Centro de agentes", icon: "spark", href: "/panel/agentes" },
        { id: "usuarios", label: "Usuarios", icon: "people", href: "/panel/usuarios", requiresUsersManage: true },
        { id: "ajustes", label: "Configuración", icon: "settings", href: "/panel/ajustes" },
      ],
    },
  ];
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.requiresUsersManage || canManageUsers),
    }))
    .filter((group) => group.items.length > 0);
}

type PanelShellProps = {
  children: ReactNode;
  storeName: string;
  actorName: string;
  roleLabel: string;
  initials: string;
  canManageUsers?: boolean;
};

export function PanelShell({
  children,
  storeName,
  actorName,
  roleLabel,
  initials,
  canManageUsers = false,
}: PanelShellProps) {
  const groups = buildNavGroups(canManageUsers);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useRouteFocus();

  const [menuPath, setMenuPath] = useState(pathname);
  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const menuButton = menuButtonRef;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menu?.querySelector<HTMLElement>("[data-close]")?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !menu) return;
      const items = Array.from(
        menu.querySelectorAll<HTMLElement>("button, a, input, select, textarea, [tabindex]:not([tabindex='-1'])"),
      ).filter((item) => !item.hasAttribute("disabled"));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      (previouslyFocused ?? menuButton.current)?.focus();
    };
  }, [open]);

  return (
    <PanelQueryContext.Provider value={query}>
      <div className="min-h-dvh bg-canvas">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] lg:block">
          <Sidebar storeName={storeName} groups={groups} />
        </aside>

        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" className="absolute inset-0 bg-primary-dark/50" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
            <div
              ref={menuRef}
              id="panel-menu-movil"
              className="absolute inset-y-0 left-0 w-[min(100%,260px)]"
              role="dialog"
              aria-modal="true"
              aria-label="Menú del panel"
            >
              <Sidebar storeName={storeName} groups={groups} onCloseMenu={() => setOpen(false)} showClose />
            </div>
          </div>
        ) : null}

        <div className="lg:pl-[260px]">
          <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 px-4 py-2 backdrop-blur lg:px-8">
            <div className="flex items-center gap-2">
              <button
                ref={menuButtonRef}
                type="button"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-line bg-card lg:hidden"
                aria-expanded={open}
                aria-controls="panel-menu-movil"
                onClick={() => setOpen(true)}
              >
                <Icon name="menu" className="h-5 w-5" />
                <span className="sr-only">Abrir menú</span>
              </button>
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Buscar en el panel</span>
                <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar pedido, SKU o producto"
                  className="h-10 w-full rounded-[10px] border border-line bg-card pr-3 pl-9 text-sm text-ink placeholder:text-muted focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
                />
              </label>
              <span className="hidden h-9 items-center rounded-[10px] border border-line bg-card px-3 text-xs font-semibold lg:inline-flex">
                COP $
              </span>
              <div className="hidden min-w-0 items-center gap-2 lg:flex">
                <span className="hidden h-9 max-w-40 items-center truncate rounded-[10px] border border-line bg-card px-3 text-xs font-semibold min-[1200px]:inline-flex">
                  {storeName}
                </span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-on-dark">
                  {initials}
                </span>
                <span className="hidden leading-tight min-[1200px]:block">
                  <span className="block text-sm font-semibold">{actorName}</span>
                  <span className="block text-xs text-muted">{roleLabel}</span>
                </span>
              </div>
              <nav aria-label="Vista" className="flex shrink-0 flex-wrap items-center gap-1">
                <span className="hidden text-[10px] font-bold tracking-[0.08em] text-muted uppercase min-[1200px]:inline">
                  Vista
                </span>
                <PanelMenuLink
                  href="/ingresar?modo=nueva-clave"
                  className="inline-flex h-9 items-center rounded-[10px] px-2 text-sm font-semibold text-accent-strong hover:bg-subtle"
                >
                  Clave
                </PanelMenuLink>
              </nav>
              <nav aria-label="Herramientas" className="flex shrink-0 flex-wrap items-center gap-1">
                <span className="sr-only">Herramientas</span>
                <form action={signOut} className="contents">
                  <button
                    type="submit"
                    aria-label="Cerrar sesión"
                    className="inline-flex h-9 items-center gap-2 rounded-[10px] px-2 text-sm font-semibold text-ink hover:bg-subtle"
                  >
                    <Icon name="logout" className="h-5 w-5" />
                    <span className="hidden min-[1200px]:inline">Salir</span>
                  </button>
                </form>
              </nav>
            </div>
          </header>
          <main id="contenido" tabIndex={-1} className="px-4 py-3 outline-none sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </PanelQueryContext.Provider>
  );
}

function Sidebar({
  storeName,
  groups,
  onCloseMenu,
  showClose = false,
}: {
  storeName: string;
  groups: ReturnType<typeof buildNavGroups>;
  onCloseMenu?: () => void;
  showClose?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-dvh flex-col bg-primary-dark text-on-dark">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <PanelMenuLink
          href="/panel"
          className="rounded-[10px]"
          onCloseMenu={onCloseMenu}
        >
          <BrandLogo onDark className="h-8 max-w-[11rem]" />
        </PanelMenuLink>
        {showClose ? (
          <button
            type="button"
            data-close
            className="grid h-10 w-10 place-items-center rounded-[10px] hover:bg-white/10"
            aria-label="Cerrar menú"
            onClick={onCloseMenu}
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav
        aria-label="Secciones del panel"
        className="panel-sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-2"
      >
        {groups.map((group) => (
          <div key={group.id} className="mt-2.5 first:mt-0">
            <p className="px-3 pb-0.5 text-[10px] font-bold tracking-[0.08em] text-on-dark-muted uppercase">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === "/panel" ? pathname === "/panel" : pathname.startsWith(item.href);
                return (
                  <li key={item.id}>
                    <PanelMenuLink
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onCloseMenu={onCloseMenu}
                      className={
                        active
                          ? "flex h-9 items-center gap-2.5 rounded-[10px] bg-[#EEF2FA] px-3 text-sm font-semibold text-primary"
                          : "flex h-9 items-center gap-2.5 rounded-[10px] px-3 text-sm font-medium text-on-dark-muted hover:bg-white/10 hover:text-white"
                      }
                    >
                      <Icon name={item.icon} className={cx("h-4 w-4", active ? "text-accent-strong" : undefined)} />
                      {item.label}
                    </PanelMenuLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className="shrink-0 border-t border-white/10 px-3 py-2"
      >
        <p className="inline-flex max-w-full items-center gap-1.5 text-[10px] font-bold tracking-[0.06em] text-coral uppercase">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-coral" aria-hidden="true" />
          <span className="truncate">Dropi no conectado</span>
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs font-semibold leading-4">{storeName}</p>
          <PanelMenuLink
            href="/tienda"
            className="inline-flex h-7 shrink-0 items-center rounded-[8px] border border-white/15 bg-white/5 px-2 text-[11px] font-semibold text-on-dark hover:bg-white/10"
            onCloseMenu={onCloseMenu}
          >
            Abrir tienda
          </PanelMenuLink>
        </div>
      </div>
    </div>
  );
}
