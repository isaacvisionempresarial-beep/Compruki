import type { Metadata } from "next";
import Link from "next/link";

const privacyDescription =
  "Política de privacidad de COMPRUKI: qué datos usamos al crear cuenta, pedir y avisar el estado del pedido.";

export const metadata: Metadata = {
  title: "Privacidad",
  description: privacyDescription,
  robots: { index: false, follow: false },
  openGraph: {
    title: "Privacidad · COMPRUKI",
    description: privacyDescription,
    url: "/tienda/privacidad",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacidad · COMPRUKI",
    description: privacyDescription,
  },
};

const sections = [
  {
    title: "Quiénes somos",
    text: "COMPRUKI opera esta tienda piloto en Colombia (compruki.com). Si escribes por la cuenta de la tienda o por WhatsApp publicado, contactas al administrador del proyecto.",
  },
  {
    title: "Qué datos pedimos",
    text: "Cuenta: correo, nombre y, si entras con Google, los datos básicos que Google comparte (nombre, correo e imagen de perfil). Pedido: nombre de quien recibe, celular, cédula si la escribes, departamento, ciudad, dirección, referencia y productos del carrito. Opcional: aviso para la tienda y preferencia de avisos por correo.",
  },
  {
    title: "Para qué los usamos",
    text: "Identificarte en la tienda, guardar el carrito y el pedido, preparar la entrega, consultar el estado con número y celular, y enviarte avisos de cambio de estado si lo activaste. No vendemos tu lista de contactos.",
  },
  {
    title: "Inicio con Google",
    text: "Si eliges Continuar con Google, usamos el inicio de sesión de Google (OAuth) solo para autenticarte. Pedimos correo y perfil básicos. No publicamos en tu nombre ni leemos tu Gmail. Puedes dejar de usar Google cerrando sesión y, si quieres, eliminando el acceso a COMPRUKI desde tu cuenta de Google.",
  },
  {
    title: "Correos de estado",
    text: "Si marcas avisos por correo, podemos enviarte mensajes transaccionales (por ejemplo, pedido confirmado) con un proveedor de correo. Esos mensajes no cobran ni cambian el total guardado.",
  },
  {
    title: "Dónde se guardan",
    text: "Los datos del pedido y de la cuenta se guardan en la base de datos de la tienda (Supabase) y en el servicio de autenticación. El hosting de la app puede estar en Railway u otro proveedor equivalente. Google y el proveedor de correo procesan solo lo necesario para login o envío.",
  },
  {
    title: "Cuánto tiempo",
    text: "Conservamos la cuenta mientras exista y los pedidos el tiempo necesario para operación, soporte y registro comercial del piloto. Si pides borrar tu cuenta, quitamos el acceso de comprador; los pedidos ya creados pueden quedar en el historial de la tienda con los datos de entrega.",
  },
  {
    title: "Tus opciones",
    text: "Puedes corregir nombre y celular en Tu cuenta, corregir la entrega mientras el pedido sigue pendiente, desactivar avisos por correo, cerrar sesión o escribirnos para pedir ayuda con tu cuenta. Consultar un pedido no cobra ni cambia el total guardado.",
  },
  {
    title: "Menores",
    text: "La tienda no está dirigida a menores de 18 años. No buscamos reunir datos de menores a propósito.",
  },
  {
    title: "Cambios",
    text: "Si actualizamos esta política, la publicamos en esta misma página con la fecha de actualización. Seguir usando la tienda después de un cambio implica que leíste la versión vigente.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="space-y-3">
      <section className="store-hero store-rise relative overflow-hidden rounded-[18px] border border-line bg-card">
        <div className="absolute inset-0 bg-gradient-to-r from-card via-card to-[#e8eef5]" aria-hidden="true" />
        <div className="relative z-10 p-3.5 sm:p-4">
          <p className="text-[10px] font-bold tracking-[0.1em] text-accent-strong uppercase">Legal</p>
          <h1 className="store-display mt-1 text-[1.7rem] leading-tight font-extrabold tracking-[-0.03em]">
            Política de privacidad
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-5 text-muted">
            Cómo usamos tus datos en la tienda COMPRUKI. Actualizado el 25 nov 2026. Leerla no registra pedido ni
            cobra.
          </p>
        </div>
      </section>

      <section className="elevate-1 rounded-[14px] border border-line bg-card px-3.5 py-3.5" aria-labelledby="privacidad-lista">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Detalle</p>
        <h2 id="privacidad-lista" className="mt-0.5 text-sm font-semibold">
          Qué debes saber
        </h2>
        <ul className="mt-3 space-y-3">
          {sections.map((item) => (
            <li key={item.title} className="rounded-[12px] border border-line bg-canvas px-3 py-2.5">
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-sm leading-5 text-muted">{item.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-5 text-muted">
          Las reglas de compra (pago, envío, cancelación) están en{" "}
          <Link href="/tienda/condiciones" className="font-semibold text-accent-strong underline-offset-2 hover:underline">
            Condiciones
          </Link>
          .
        </p>
      </section>

      <nav aria-label="Vista" className="flex flex-wrap items-center gap-2">
        <Link
          href="/tienda"
          className="inline-flex h-9 items-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark"
        >
          Volver a la tienda
        </Link>
        <Link
          href="/tienda/condiciones"
          className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold hover:bg-subtle"
        >
          Condiciones
        </Link>
        <Link
          href="/tienda/cuenta"
          className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold hover:bg-subtle"
        >
          Tu cuenta
        </Link>
      </nav>
    </div>
  );
}
