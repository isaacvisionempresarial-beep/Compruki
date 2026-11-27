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
