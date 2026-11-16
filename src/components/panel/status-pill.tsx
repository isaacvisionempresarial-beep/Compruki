import { STATUS_LABEL, type OrderStatus } from "@/lib/demo-data";
import { cx } from "@/lib/cx";

const tone: Record<OrderStatus, string> = {
  pendiente_confirmacion: "bg-warning-tint text-warning",
  confirmado: "bg-accent-tint text-accent-strong",
  en_preparacion: "bg-subtle text-ink ring-1 ring-line",
  en_transporte: "bg-primary/10 text-primary",
  entregado: "bg-accent-tint text-accent-strong",
  devuelto: "bg-coral-tint text-coral-strong",
  incidencia: "bg-warning-tint text-warning",
  cancelado: "bg-danger-tint text-danger",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span className={cx("inline-flex rounded-[8px] px-2 py-0.5 text-[11px] font-bold", tone[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function CollectedPill() {
  return (
    <span className="inline-flex rounded-[8px] bg-accent-tint px-2 py-0.5 text-[11px] font-bold text-accent-strong">
      Cobrado
    </span>
  );
}
