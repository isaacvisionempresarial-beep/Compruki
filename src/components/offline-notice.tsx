"use client";

import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("offline", onStoreChange);
  window.addEventListener("online", onStoreChange);
  return () => {
    window.removeEventListener("offline", onStoreChange);
    window.removeEventListener("online", onStoreChange);
  };
}

function getSnapshot() {
  return !navigator.onLine;
}

function getServerSnapshot() {
  return false;
}

/** Aviso corto cuando el navegador pierde red. No implica sincronización con Dropi. */
export function OfflineNotice() {
  const offline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="border-b border-line bg-warning-tint px-4 py-1.5 text-center text-xs leading-5 text-warning"
    >
      Sin conexión. No cobra. Dropi no está conectado ni se sincroniza. El carrito de este navegador puede seguir aquí.
    </div>
  );
}
