import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DropiHandoff } from "@/components/panel/dropi-handoff";
import { StatusPill } from "@/components/panel/status-pill";
import { formatDay } from "@/lib/format";
import { canNoteDropiNumber, orderFocusHref } from "@/lib/store-order";
import { listOrders } from "@/server/order-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await params;
  const order = (await listOrders()).find((item) => item.number === decodeURIComponent(number));
  return { title: order ? `Sincronización ${order.number}` : "No encontrado" };
}

export default async function SyncOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const order = (await listOrders()).find((item) => item.number === decodeURIComponent(number));
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Sincronización</p>
      <div className="mt-0.5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] leading-7 font-extrabold tracking-tight">{order.number}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatDay(order.createdAt.slice(0, 10))} · {order.customerName} · {order.city}
            {order.department ? ` · ${order.department}` : ""}
          </p>
        </div>
        <StatusPill status={order.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
        <Link href="/panel/sincronizacion" className="text-accent-strong">
          Volver a sincronización
        </Link>
        <Link href={orderFocusHref(order.number)} className="text-accent-strong">
          Abrir el pedido
        </Link>
      </div>
      {canNoteDropiNumber(order) ? (
        <>
          <p className="mt-3 max-w-2xl text-sm leading-5 text-muted">
            Dropi no está conectado. Copia los datos, créalo ahí a mano y escribe aquí el número que te
            devuelve. Esta página no lo envía. No cobra. El total guardado no cambia.
          </p>
          <DropiHandoff order={order} />
        </>
      ) : (
        <p className="elevate-1 mt-3 max-w-2xl rounded-[14px] border border-line bg-card px-3 py-2 text-sm leading-5 text-ink">
          Este pedido sigue pendiente. El número de Dropi se anota después de confirmarlo. Confírmalo en Pedidos.
        </p>
      )}
    </div>
  );
}
