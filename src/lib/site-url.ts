/** True si el host es loopback o interno de Railway (no sirve para redirects públicos). */
function isPrivateHost(host: string) {
  const name = host.toLowerCase().split(":")[0]?.trim() ?? "";
  return (
    !name ||
    name === "localhost" ||
    name === "127.0.0.1" ||
    name === "0.0.0.0" ||
    name === "::1" ||
    name.endsWith(".railway.internal")
  );
}

/** Origen canónico para metadataBase, robots y URLs absolutas de OG. */
export function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured.includes("://") ? configured : `https://${configured}`);
      if (!isPrivateHost(url.hostname)) return url.origin;
    } catch {
      /* seguir con otros orígenes */
    }
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  const port = process.env.PORT?.trim() || "3010";
  return `http://localhost:${port}`;
}

/**
 * Origen público para redirects (OAuth, mails).
 * Prefiere env; si falta o es localhost, usa x-forwarded-*; nunca redirige a host interno.
 */
export function publicSiteOrigin(request: { headers: Headers; url: string }) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured.includes("://") ? configured : `https://${configured}`);
      if (!isPrivateHost(url.hostname)) return url.origin;
    } catch {
      /* caer a headers */
    }
  }

  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  const proto = (request.headers.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim() || "https";
  if (host && !isPrivateHost(host)) return `${proto}://${host}`;

  try {
    const url = new URL(request.url);
    if (!isPrivateHost(url.hostname)) return url.origin;
  } catch {
    /* ignore */
  }

  return siteOrigin();
}

export function siteUrl(path = "/") {
  const base = siteOrigin();
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
