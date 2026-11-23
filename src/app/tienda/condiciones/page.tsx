import type { Metadata } from "next";
import Link from "next/link";

const conditionsDescription =
  "Condiciones de la compra: pedido pendiente, pago contra entrega, envío sin guía prometida y consulta por número y celular. Dropi no está conectado.";

export const metadata: Metadata = {
  title: "Condiciones",
  description: conditionsDescription,
  robots: { index: false, follow: false },
  openGraph: {
    title: "Condiciones · COMPRUKI",
    description: conditionsDescription,
    url: "/tienda/condiciones",
  },
  twitter: {
    card: "summary_large_image",
    title: "Condiciones · COMPRUKI",
    description: conditionsDescription,
  },
};

const points = [
  {
    label: "El pedido",
    text: "Queda pendiente hasta que la tienda lo confirme. Confirmar no cobra. Mientras sigue pendiente, puedes cancelarlo desde el pedido. Cancelarlo no cobra aquí: ya no se paga al recibir y el total guardado no cambia.",
  },
  {
    label: "La talla",
    text: "Si el producto tiene tallas o tamaños, eliges uno antes de que la tienda confirme. Mientras sigue pendiente, puedes cambiarlo desde el pedido. Eso no cambia el precio guardado.",
  },
  {
    label: "El pago",
    text: "Es efectivo contra entrega, por el precio publicado de los productos. Ese monto queda guardado en el pedido. Nadie lo cobra en esta tienda. Transferencia y tarjeta no están conectadas.",
  },
  {
    label: "El envío",
    text: "No está incluido y se acuerda antes de despachar. No hay guía ni fecha prometida. Acordarlo no cobra y el total guardado no cambia. Dropi no está conectado.",
  },
  {
    label: "Tus datos",
    text: "Nombre, celular, cédula si la escribes, departamento, ciudad, dirección y referencia. Sirven para preparar este pedido. Sin departamento, el texto para Dropi no lo lleva y la tienda puede confirmar igual. Mientras sigue pendiente, puedes corregirlos. Corregirlos no cobra y el total guardado no cambia.",
  },
  {
    label: "El estado",
    text: "Se consulta con el número del pedido y el celular de la entrega. Consultar no cobra ni cambia el total guardado.",
  },
  {
    label: "Un aviso",
    text: "Mientras sigue pendiente, puedes dejarle uno a la tienda desde el pedido. No es un chat ni WhatsApp. Dejarlo no cobra y el total guardado no cambia.",
  },
  {
    label: "Devolución",
    text: "Si la tienda la anota, el motivo queda en el pedido. Ya no se paga al recibir. Nadie cobra aquí y el total guardado no cambia. Esta página no fija un plazo de retracto.",
  },
];

export default function ConditionsPage() {
  return (
    <div>
      <section className="store-hero relative overflow-hidden rounded-[14px] border border-line px-3 py-2 sm:px-4">
        <p className="text-[10px] font-bold tracking-[0.08em] text-accent-strong uppercase">Tienda piloto · Colombia</p>
        <h1 className="mt-1 text-[24px] leading-7 font-extrabold tracking-tight">Condiciones de la compra</h1>
        <p className="mt-1 max-w-xl text-sm leading-5 text-muted">
          Lo que aceptas al dejar el pedido. Leerlas no registra pedido ni cobra. Dropi no está conectado. La identidad de la tienda sigue en prueba.
        </p>
      </section>

      <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-3" aria-labelledby="en-corto">
        <h2 id="en-corto" className="text-sm font-semibold">En corto</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          <li>
            <span className="font-semibold text-sm">Nadie cobra aquí</span>
            <span className="mt-0.5 block text-xs leading-5 text-muted">Pagas al recibir el precio publicado, en efectivo. Confirmar no cobra.</span>
          </li>
          <li>
            <span className="font-semibold text-sm">Envío aparte</span>
            <span className="mt-0.5 block text-xs leading-5 text-muted">Se acuerda antes de despachar. No se cobra aquí.</span>
          </li>
          <li>
            <span className="font-semibold text-sm">Dropi</span>
            <span className="mt-0.5 block text-xs leading-5 text-muted">No está conectado. Consulta con número y celular.</span>
          </li>
        </ul>
        <nav aria-label="Herramientas" className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
          <Link
            href="/tienda"
            title="Volver no registra pedido ni cobra."
            className="inline-flex h-9 items-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark"
          >
            Volver a la tienda
          </Link>
          <Link
            href="/tienda/consultar"
            title="Consultar no cobra ni cambia el total guardado."
            className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold"
          >
            Consultar pedido
          </Link>
        </nav>
        <p className="mt-2 text-xs leading-5 text-muted">Volver no registra pedido ni cobra. Consultar no cobra ni cambia el total guardado.</p>
      </section>

      <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="condiciones-lista">
          <h2 id="condiciones-lista" className="text-sm font-semibold">
            Lo que aceptas
          </h2>
          <dl className="mt-2 space-y-2 text-sm leading-5">
            {points.map((point) => (
              <div key={point.label} className="grid gap-0.5 sm:grid-cols-[7rem_1fr] sm:gap-3">
                <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase sm:pt-0.5">{point.label}</dt>
                <dd>{point.text}</dd>
              </div>
            ))}
          </dl>
        </section>
    </div>
  );
}
