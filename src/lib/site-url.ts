/** Origen canónico para metadataBase, robots y URLs absolutas de OG. */
export function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  const port = process.env.PORT?.trim() || "3010";
  return `http://localhost:${port}`;
}

export function siteUrl(path = "/") {
  const base = siteOrigin();
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
