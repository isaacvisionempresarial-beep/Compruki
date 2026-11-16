"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Tras un cambio de ruta, mueve el foco a #contenido (sin robar el foco en la carga inicial). */
export function useRouteFocus(contentId = "contenido") {
  const pathname = usePathname();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const node = document.getElementById(contentId);
    if (!(node instanceof HTMLElement)) return;
    node.focus({ preventScroll: true });
  }, [pathname, contentId]);
}
