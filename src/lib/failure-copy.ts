export type FailureScope = "tienda" | "panel" | "app";

export type FailureLink = {
  href: string;
  label: string;
  title: string;
};

const COPY: Record<FailureScope, { eyebrow: string; title: string; body: string; retryTitle: string; links: FailureLink[] }> = {
  tienda: {
    eyebrow: "Tienda",
    title: "No se pudo abrir esta pantalla",
    body: "La tienda no cargó esta vez. El carrito de este navegador no cambia. No se registró un pedido y nadie cobra.",
    retryTitle: "Reintentar no registra pedido ni cobra.",
    links: [
      { href: "/tienda", label: "Ver productos", title: "Verlos no cambia los precios publicados ni crea un pedido." },
      { href: "/tienda/carrito", label: "Ver carrito", title: "Abrirlo no cobra ni registra un pedido." },
    ],
  },
  panel: {
    eyebrow: "Panel",
    title: "No se pudo abrir esta pantalla",
    body: "El panel no cargó esta vez. No se leyeron ni se cambiaron los pedidos. Nadie cobra. Dropi no está conectado.",
    retryTitle: "Reintentar no cambia pedidos ni cobra.",
    links: [
      { href: "/panel", label: "Volver al panel", title: "Abrirlo no cobra ni cambia pedidos." },
      { href: "/panel/pedidos", label: "Ver pedidos", title: "" },
    ],
  },
  app: {
    eyebrow: "COMPRUKI",
    title: "No se pudo abrir",
    body: "Esta pantalla no cargó. No se creó ni se cambió un pedido. Nadie cobra.",
    retryTitle: "Reintentar no crea un pedido ni cobra.",
    links: [
      { href: "/tienda", label: "Ir a la tienda", title: "Abrirla no registra pedido ni cobra." },
      { href: "/ingresar", label: "Entrar al panel", title: "Abrirlo no cobra ni cambia pedidos." },
    ],
  },
};

export function failureCopy(scope: FailureScope) {
  return COPY[scope];
}

/** Solo un código opaco. Nunca el mensaje, una clave ni una URL. */
export function safeFailureCode(digest: string | undefined) {
  if (!digest || !/^[A-Za-z0-9_-]{6,40}$/.test(digest)) return "";
  return digest;
}

export function failureBody(scope: FailureScope, digest?: string) {
  const code = safeFailureCode(digest);
  const body = failureCopy(scope).body;
  return code ? `${body} Código ${code}.` : body;
}
