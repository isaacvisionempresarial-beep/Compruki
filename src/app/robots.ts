import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site-url";

/** Piloto: no indexar. Alinea robots.txt con metadata robots noindex. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
    host: siteOrigin(),
  };
}
