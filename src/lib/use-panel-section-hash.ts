"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";

/**
 * Tras navegar a /ruta#seccion (o cambiar el hash), hace scroll al id permitido.
 * No toca el foco de #contenido (useRouteFocus).
 */
export function usePanelSectionHash(ids: readonly string[]) {
  const pathname = usePathname();
  const allowed = useMemo(() => new Set(ids), [ids]);

  useEffect(() => {
    function scrollToHash() {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash || !allowed.has(hash)) return;

      const run = () => {
        const node = document.getElementById(hash);
        if (!(node instanceof HTMLElement)) return;
        node.scrollIntoView({ block: "start", behavior: "smooth" });
      };

      // Doble rAF: el bloque ya está en el DOM tras el paint de la ruta.
      requestAnimationFrame(() => requestAnimationFrame(run));
    }

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [pathname, allowed]);
}
