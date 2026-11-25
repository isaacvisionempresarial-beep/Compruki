"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import type { PublicProduct } from "@/server/catalog-store";
import { readCampaignSkus } from "@/lib/campaign";
import { variantFits } from "@/lib/catalog";
import { citiesForDepartment, listColombiaDepartments } from "@/lib/colombia-places";
import { LinePhotos, ProductThumb } from "@/components/store/product-thumb";
import { useCart } from "@/components/store/cart-state";
import { formatCop } from "@/lib/format";
import { customerDeliveryPreviewText, lineName, normalizePhone, orderTotal, validateCheckout } from "@/lib/store-order";
import { placeOrderAction, type PlaceOrderState } from "@/server/store-actions";

const initialState: PlaceOrderState = { error: null };
const colombiaDepartments = listColombiaDepartments();

export function CheckoutScreen({ products }: { products: PublicProduct[] }) {
  const cart = useCart();
  const [state, formAction, pending] = useActionState(placeOrderAction, initialState);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [campaignSkus] = useState(() => readCampaignSkus());
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [city, setCity] = useState("");
  const [department, setDepartment] = useState("");
  const [address, setAddress] = useState("");
  const [reference, setReference] = useState("");
  const [accepted, setAccepted] = useState(false);
  const cities = useMemo(() => citiesForDepartment(department), [department]);
  const rows = cart.lines.map((line) => ({
    line,
    product: products.find((item) => item.sku === line.sku) ?? null,
  }));
  const payable = rows.filter(
    (row) => row.product?.available && variantFits(row.product.variants, row.line.variant),
  );
  const total = orderTotal(payable.map((row) => ({ unitPrice: row.product?.price ?? 0, quantity: row.line.quantity })));
  const payload = payable.map((row) => ({ sku: row.line.sku, quantity: row.line.quantity, variant: row.line.variant }));
  const blocked = rows.some((row) => !payable.includes(row));
  const checkoutError = validateCheckout({
    idempotencyKey,
    customerName,
    phone,
    document: documentId,
    city,
    department,
    address,
    reference,
    accepted,
    lines: payload,
  });
  const canConfirm = !checkoutError;
  const handoff = canConfirm
    ? customerDeliveryPreviewText({
        number: "sin número",
        customerName: customerName.trim(),
        phone: normalizePhone(phone),
        document: documentId.trim() || undefined,
        department: department.trim().replace(/\s+/g, " "),
        city: city.trim(),
        address: address.trim(),
        reference: reference.trim(),
        lines: payable.map(({ line, product }) => ({
          sku: line.sku,
          title: product?.title ?? line.sku,
          variant: line.variant,
          sizeKind: line.sizeKind ?? product?.sizeKind ?? undefined,
          unitPrice: product?.price ?? 0,
          quantity: line.quantity,
        })),
        total,
      })
    : null;

  if (!cart.ready) {
    return (
      <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-3" aria-busy="true">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Estado</p>
        <p className="mt-0.5 text-sm text-muted">Cargando el carrito… No registra pedido ni cobra.</p>
      </section>
    );
  }

  if (blocked || payload.length === 0) {
    return (
      <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-3">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
        <p className="mt-0.5 text-sm text-muted">No hay productos que se puedan pedir. No registra pedido ni cobra.</p>
        <nav aria-label="Vista" className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
          <Link href="/tienda/carrito" title="Volver no confirma el pedido ni cobra." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
            Volver al carrito
          </Link>
        </nav>
        <p className="mt-2 text-xs leading-5 text-muted">Volver no confirma el pedido ni cobra.</p>
      </section>
    );
  }

  return (
    <div>
      <section
        className="store-hero store-rise relative overflow-hidden rounded-[18px] border border-line px-4 py-4 sm:px-5"
        style={{ animationDelay: "40ms" }}
      >
        <p className="text-[10px] font-bold tracking-[0.1em] text-accent-strong uppercase">Carrito</p>
        <h1 className="store-display mt-2 text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em]">Datos de entrega</h1>
        <p className="mt-1 max-w-xl text-sm leading-5 text-muted">
          Pago contra entrega. Al confirmar queda pendiente. Nadie cobra aquí. Pagas {formatCop(total)} al recibir.
        </p>
      </section>

      <form action={formAction} className="store-rise mt-3 space-y-3" style={{ animationDelay: "120ms" }}>
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <input type="hidden" name="lines" value={JSON.stringify(payload)} />
        <input
          type="hidden"
          name="campaignSkus"
          value={JSON.stringify(payload.filter((line) => campaignSkus.includes(line.sku)).map((line) => line.sku))}
        />

        <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-3" aria-labelledby="pago-resumen">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Estado</p>
          <h2 id="pago-resumen" className="mt-0.5 text-sm font-semibold">Resumen</h2>
          <ul className="mt-2 space-y-2">
            {payable.map(({ line, product }) => (
              <li key={`${line.sku}:${line.variant}`} className="text-xs">
                <LinePhotos sku={line.sku} title={product?.title ?? line.sku} images={product?.images ?? []} />
                <div className={`flex items-start gap-2 ${(product?.images.length ?? 0) > 1 ? "mt-2" : ""}`}>
                  <ProductThumb sku={line.sku} show={product?.images.length === 1} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-5">
                      {lineName({
                        title: product?.title ?? line.sku,
                        variant: line.variant,
                        sizeKind: line.sizeKind ?? product?.sizeKind ?? undefined,
                      })}
                    </span>
                    <span className="mt-0.5 block text-muted">
                      {line.quantity} × {formatCop(product?.price ?? 0)}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{formatCop((product?.price ?? 0) * line.quantity)}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-baseline justify-between gap-2 border-t border-line pt-3">
            <span className="text-xs text-muted">Total al recibir</span>
            <span className="text-lg font-extrabold tabular-nums">{formatCop(total)}</span>
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">Pagas al recibir. Envío aparte. Nadie cobra aquí.</p>
          <p className="mt-1.5 text-xs leading-5 text-muted">
            Confirmar registra en la tienda y no cobra. El envío se acuerda aparte.
          </p>
          <nav aria-label="Vista" className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
            <Link href="/tienda/carrito" title="Volver no confirma el pedido ni cobra." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
              Volver al carrito
            </Link>
          </nav>
          <p className="mt-2 text-xs leading-5 text-muted">Volver no confirma el pedido ni cobra.</p>

        </section>

        <div className="space-y-2">
          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="entrega-titulo">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Entrega</p>
            <h2 id="entrega-titulo" className="mt-0.5 text-sm font-semibold">
              Quién recibe
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-2 sm:grid-cols-6">
              <p className="col-span-2 text-[10px] font-bold tracking-[0.08em] text-muted uppercase sm:col-span-6">Persona</p>
              <div className="col-span-2 sm:col-span-6">
                <Field label="Nombre" htmlFor="customerName" hint="Quien recibe. No es un pago.">
                  <input
                    id="customerName"
                    title="Escribirlo no confirma el pedido ni cobra."
                    name="customerName"
                    required
                    autoComplete="name"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="col-span-1 sm:col-span-3">
                <Field label="Celular" htmlFor="phone" hint="10 dígitos, inicia en 3.">
                  <input
                    id="phone"
                    title="Escribirlo no confirma el pedido ni cobra."
                    name="phone"
                    required
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="col-span-1 sm:col-span-3">
                <Field label="Cédula" htmlFor="document" hint="Opcional. 6 a 10 dígitos.">
                  <input
                    id="document"
                    title="Escribirlo no confirma el pedido ni cobra."
                    name="document"
                    inputMode="numeric"
                    autoComplete="off"
                    value={documentId}
                    onChange={(event) => setDocumentId(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>

              <p className="col-span-2 text-[10px] font-bold tracking-[0.08em] text-muted uppercase sm:col-span-6">Dónde</p>
              <div className="col-span-1 sm:col-span-3">
                <Field label="Departamento" htmlFor="department" hint="Elige de la lista.">
                  <select
                    id="department"
                    title="Elegirlo no confirma el pedido ni cobra."
                    name="department"
                    required
                    autoComplete="address-level1"
                    value={department}
                    onChange={(event) => {
                      setDepartment(event.target.value);
                      setCity("");
                    }}
                    className={selectClass}
                  >
                    <option value="">Departamento</option>
                    {colombiaDepartments.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="col-span-1 sm:col-span-3">
                <Field label="Ciudad" htmlFor="city" hint={department ? "Según el departamento." : "Primero el departamento."}>
                  <select
                    id="city"
                    title="Elegirla no confirma el pedido ni cobra."
                    name="city"
                    required
                    autoComplete="address-level2"
                    value={city}
                    disabled={!department || cities.length === 0}
                    onChange={(event) => setCity(event.target.value)}
                    className={selectClass}
                  >
                    <option value="">{department ? "Ciudad o municipio" : "Elige departamento"}</option>
                    {cities.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <Field label="Dirección" htmlFor="address" hint="Calle, carrera o detalle de entrega.">
                  <input
                    id="address"
                    title="Escribirla no confirma el pedido ni cobra."
                    name="address"
                    required
                    autoComplete="street-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="col-span-2 sm:col-span-2">
                <Field label="Barrio / ref." htmlFor="reference" hint="Opcional.">
                  <input
                    id="reference"
                    title="Escribirla no confirma el pedido ni cobra."
                    name="reference"
                    autoComplete="off"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="pago-titulo">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Pago</p>
            <h2 id="pago-titulo" className="mt-0.5 text-sm font-semibold">
              Cómo se paga
            </h2>
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">Cómo se paga</legend>
              <label className="flex items-start gap-3 rounded-[10px] border border-accent bg-accent-tint px-3 py-2 text-sm">
                <input type="radio" name="payment" value="contra_entrega" defaultChecked title="Marcarlo no cobra." className="mt-1" />
                <span>
                  <span className="block font-semibold">Efectivo contra entrega</span>
                  <span className="text-muted">Pagas el precio publicado cuando los recibes. Marcarlo no cobra.</span>
                </span>
              </label>
              <p className="rounded-[10px] border border-line bg-subtle px-3 py-2 text-sm text-muted">
                Transferencia y tarjeta todavía no están conectadas. No es un pago.
              </p>
            </fieldset>

            <div className="mt-2 flex items-start gap-3 text-sm leading-5">
              <input
                id="accepted"
                type="checkbox"
                name="accepted"
                checked={accepted}
                className="mt-1 h-4 w-4"
                required
                title="Marcarla no confirma el pedido ni cobra."
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <p>
                <label htmlFor="accepted">
                  Acepto las condiciones: el pedido queda pendiente, el envío se acuerda antes de despachar y pago el precio
                  publicado al recibir.
                </label>
              </p>
            </div>
            <nav aria-label="Vista" className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
              <Link href="/tienda/condiciones" title="Leerlas no confirma el pedido ni cobra." className="inline-flex h-9 scroll-mb-24 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
                Leer condiciones
              </Link>
            </nav>
            <p className="mt-2 text-xs leading-5 text-muted">Leerlas no confirma el pedido ni cobra.</p>

            {state.error ? (
              <p role="alert" className="mt-3 rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
                {state.error}
              </p>
            ) : null}

            {handoff ? (
              <details className="mt-3">
                <summary className="cursor-pointer" title="Abrirla no confirma el pedido ni cobra.">
                  <span className="block text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
                  <span className="mt-0.5 block text-sm font-semibold text-muted">Vista previa del texto de entrega</span>
                </summary>
                <p className="mt-1 text-xs leading-5 text-muted">Abrirla no confirma el pedido ni cobra.</p>
                <p className="mt-2 text-sm leading-5 text-ink">
                  Si confirmas, el pedido queda pendiente por {formatCop(total)}. Nadie cobra aquí.
                  <span className="mt-1 block font-normal whitespace-pre-wrap text-muted">{handoff}</span>
                </p>
              </details>
            ) : (
              <p className="mt-3 text-xs leading-5 text-muted">
                Completa los datos y acepta las condiciones. Sin eso el botón queda bloqueado. Nadie cobra aquí.
              </p>
            )}

            <p className="mt-3 text-xs leading-5 text-muted">
              Si este mismo pedido ya está pendiente, no se crea otro. Un celular puede dejar hasta 3 pendientes a la vez. Muchos intentos seguidos desde el mismo lugar se detienen un rato y no crean otro. El total guardado no cambia.
            </p>
            <nav aria-label="Herramientas" className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
              <button
                type="submit"
                title="Confirmar deja el pedido pendiente. Si ya existe o el celular ya tiene 3, no crea otro. Nadie cobra aquí."
                disabled={pending || !canConfirm}
                className={`inline-flex h-9 scroll-mb-24 sm:min-w-56 items-center justify-center rounded-[10px] bg-accent px-3 text-sm font-extrabold text-primary-dark ${
                  pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-55"
                }`}
              >
                {pending ? "Registrando…" : `Confirmar · pagas ${formatCop(total)} al recibir`}
              </button>
            </nav>
          </section>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] leading-4 text-muted">{hint}</p> : null}
    </div>
  );
}

const inputClass =
  "h-9 w-full rounded-[10px] border border-line bg-canvas px-2.5 text-sm focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none";

const selectClass =
  `${inputClass} disabled:cursor-not-allowed disabled:opacity-55`;
