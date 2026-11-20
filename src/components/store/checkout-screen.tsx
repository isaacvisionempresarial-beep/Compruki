"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import type { PublicProduct } from "@/server/catalog-store";
import { readCampaignSkus } from "@/lib/campaign";
import { variantFits } from "@/lib/catalog";
import { LinePhotos, ProductThumb } from "@/components/store/product-thumb";
import { useCart } from "@/components/store/cart-state";
import { formatCop } from "@/lib/format";
import { dropiHandoffText, lineName, normalizePhone, orderTotal, validateCheckout } from "@/lib/store-order";
import { placeOrderAction, type PlaceOrderState } from "@/server/store-actions";

const initialState: PlaceOrderState = { error: null };

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
    ? dropiHandoffText({
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

  if (!cart.ready) return <p className="text-sm text-muted">Cargando el carrito… No registra pedido ni cobra.</p>;

  if (blocked || payload.length === 0) {
    return (
      <p className="text-sm text-muted">
        No hay productos que se puedan pedir. No registra pedido ni cobra.{" "}
        <Link href="/tienda/carrito" className="font-semibold text-accent-strong">
          Volver al carrito
        </Link>
      </p>
    );
  }

  return (
    <div>
      <section className="store-hero relative overflow-hidden rounded-[14px] border border-line px-3 py-2 sm:px-4">
        <p className="text-[10px] font-bold tracking-[0.08em] text-accent-strong uppercase">Pago contra entrega</p>
        <h1 className="mt-1 text-[24px] leading-7 font-extrabold tracking-tight">Datos de entrega</h1>
        <p className="mt-1 max-w-xl text-sm leading-5 text-muted">
          Al confirmar queda pendiente. Nadie cobra aquí. Pagas {formatCop(total)} al recibir. Dropi no está
          conectado.
        </p>
      </section>

      <form action={formAction} className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <input type="hidden" name="lines" value={JSON.stringify(payload)} />
        <input
          type="hidden"
          name="campaignSkus"
          value={JSON.stringify(payload.filter((line) => campaignSkus.includes(line.sku)).map((line) => line.sku))}
        />

        <div className="order-2 space-y-2 xl:order-1">
          <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="entrega-titulo">
            <h2 id="entrega-titulo" className="text-sm font-semibold">
              Quién recibe
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Nombre de quien recibe" htmlFor="customerName" hint="No es un pago. Al confirmar, el pedido queda pendiente.">
                  <input
                    id="customerName"
                    name="customerName"
                    required
                    autoComplete="name"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Celular" htmlFor="phone" hint="10 dígitos, empieza por 3. Sirve para coordinar la entrega. No es un pago.">
                <input
                  id="phone"
                  name="phone"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field
                label="Cédula de quien recibe"
                htmlFor="document"
                hint="Opcional. De 6 a 10 dígitos, sin puntos. La pide la transportadora. No es un pago."
              >
                <input
                  id="document"
                  name="document"
                  inputMode="numeric"
                  autoComplete="off"
                  value={documentId}
                  onChange={(event) => setDocumentId(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Departamento" htmlFor="department" hint="Por ejemplo, Sucre o Antioquia. No es la ciudad. No es un pago.">
                <input
                  id="department"
                  name="department"
                  required
                  autoComplete="address-level1"
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Ciudad" htmlFor="city" hint="No es un pago.">
                <input
                  id="city"
                  name="city"
                  required
                  autoComplete="address-level2"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Dirección" htmlFor="address" hint="No es un pago. Al confirmar, el pedido queda pendiente.">
                  <input
                    id="address"
                    name="address"
                    required
                    autoComplete="street-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Barrio o referencia" htmlFor="reference" hint="Opcional. No es un pago.">
                  <input
                    id="reference"
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
            <h2 id="pago-titulo" className="text-sm font-semibold">
              Cómo se paga
            </h2>
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">Cómo se paga</legend>
              <label className="flex items-start gap-3 rounded-[10px] border border-accent bg-accent-tint px-3 py-2 text-sm">
                <input type="radio" name="payment" value="contra_entrega" defaultChecked className="mt-1" />
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
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <p>
                <label htmlFor="accepted">
                  Acepto las condiciones: el pedido queda pendiente, el envío se acuerda antes de despachar y pago el precio
                  publicado al recibir.
                </label>{" "}
                <Link href="/tienda/condiciones" className="scroll-mb-24 font-semibold text-accent-strong">
                  Leerlas
                </Link>
                <span className="mt-1 block text-xs leading-5 text-muted">Leerlas no confirma el pedido ni cobra.</span>
              </p>
            </div>

            {state.error ? (
              <p role="alert" className="mt-3 rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
                {state.error}
              </p>
            ) : null}

            {handoff ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-muted">
                  Vista previa del texto de entrega
                </summary>
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

            <button
              type="submit"
              disabled={pending || !canConfirm}
              className={`mt-3 inline-flex h-10 w-full scroll-mb-24 items-center justify-center rounded-[10px] bg-accent text-sm font-extrabold text-primary-dark ${
                pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-55"
              }`}
            >
              {pending ? "Registrando…" : `Confirmar · pagas ${formatCop(total)} al recibir`}
            </button>
          </section>
        </div>

        <aside className="elevate-1 order-1 rounded-[14px] border border-line bg-card px-3 py-2 xl:sticky xl:top-[3rem] xl:order-2">
          <h2 className="text-sm font-semibold">Resumen</h2>
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
            Confirmar registra en la tienda y no cobra. Dropi no está conectado: no crea el pedido ahí.
          </p>
          <p className="mt-2 text-sm leading-5 text-muted">
            <Link href="/tienda/carrito" className="font-semibold text-accent-strong">
              Volver al carrito
            </Link>
            <span className="mt-1 block text-xs">Volver no confirma el pedido ni cobra.</span>
          </p>
        </aside>
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
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-sm focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none";
