const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatCop(value: number) {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const amount = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}$${amount}`;
}

export function formatDay(iso: string) {
  const [, month, day] = iso.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1]}`;
}

/** Relativo corto para listas (es): "ahora", "5m", "2h", "3d", "12 nov". */
export function formatRelativeShort(iso: string, now = Date.now()) {
  if (!iso) return "";
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return "";
  const deltaSec = Math.round((now - at) / 1000);
  if (deltaSec < 45) return "ahora";
  if (deltaSec < 3600) return `${Math.max(1, Math.round(deltaSec / 60))}m`;
  if (deltaSec < 86_400) return `${Math.max(1, Math.round(deltaSec / 3600))}h`;
  if (deltaSec < 86_400 * 7) return `${Math.max(1, Math.round(deltaSec / 86_400))}d`;
  const day = new Date(at);
  return `${day.getDate()} ${MONTHS[day.getMonth()]}`;
}

const CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Tiempo restante de ventana Meta 24 h desde el último entrante. */
export function formatWindowLeft(lastInboundAt: string, now = Date.now()) {
  if (!lastInboundAt) return null;
  const at = new Date(lastInboundAt).getTime();
  if (!Number.isFinite(at)) return null;
  const leftMs = at + CUSTOMER_WINDOW_MS - now;
  if (leftMs <= 0) return { label: "cerrada", urgent: true, leftMs: 0 };
  const hours = Math.floor(leftMs / 3_600_000);
  const mins = Math.floor((leftMs % 3_600_000) / 60_000);
  const label = hours > 0 ? `${hours}h ${mins}m` : `${Math.max(1, mins)}m`;
  return { label, urgent: leftMs < 2 * 3_600_000, leftMs };
}
