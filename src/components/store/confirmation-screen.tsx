"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { LinePhotos, ProductThumb } from "@/components/store/product-thumb";
import { useCart } from "@/components/store/cart-state";
import { STATUS_LABEL } from "@/lib/demo-data";
import { formatCop, formatDay } from "@/lib/format";
import { sizeChoiceLabel, type SizeKind } from "@/lib/catalog";
import {
  customerMissingReasonNote,
  customerPayLine,
  customerProgressNote,
  customerSizeHoldNote,
  customerStatusNote,
  customerSteps,
  dropiHandoffText,
  lineName,
  payableTotalLabel,
  validateBuyerNote,
  validateDelivery,
  type CustomerOrder,
} from "@/lib/store-order";
import {
  cancelCustomerOrderAction,
  chooseCustomerSizeAction,
  correctCustomerDeliveryAction,
  saveBuyerNoteAction,
  type BuyerNoteState,
  type CancelCustomerOrderState,
  type ChooseSizeState,
  type CorrectDeliveryState,
} from "@/server/customer-lookup";

const cancelInitial: CancelCustomerOrderState = { error: null };
const noteInitial: BuyerNoteState = { error: null };
const deliveryInitial: CorrectDeliveryState = { error: null };
const sizeInitial: ChooseSizeState = { error: null };

export type CustomerSizeChoice = { sku: string; sizeKind: SizeKind; variants: string[] };
export type CustomerImages = { sku: string; images: { id: string }[] };

function photosOf(images: CustomerImages[], sku: string) {
  return images.find((item) => item.sku === sku)?.images ?? [];
}
const fieldClass =
  "h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-sm focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none";

export function ConfirmationScreen({
  order,
  justPlaced,
  images = [],
  sizes = [],
  token = "",
}: {
  order: CustomerOrder;
  justPlaced: boolean;
  images?: CustomerImages[];
  sizes?: CustomerSizeChoice[];
  token?: string;
}) {
  const { clear } = useCart();

  useEffect(() => {
    if (justPlaced) clear();
  }, [clear, justPlaced]);

  return (
    <div>
      <section className="store-hero relative overflow-hidden rounded-[14px] border border-line px-3 py-2 sm:px-4">
        <p className="text-[10px] font-bold tracking-[0.08em] text-accent-strong uppercase">
          {justPlaced ? "Pedido registrado" : "Tu pedido"}
        </p>
        <h1 className="mt-1 text-[24px] leading-7 font-extrabold tracking-tight">{order.number}</h1>
        <p className="mt-1 text-sm font-semibold">{STATUS_LABEL[order.status]}</p>
        <p className="mt-1 text-sm text-muted">Lo dejaste el {formatDay(order.createdAt.slice(0, 10))}.</p>
      </section>
      <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="siguiente-paso">
        <h2 id="siguiente-paso" className="text-sm font-semibold">
          Siguiente paso
        </h2>
        <p className="mt-1 text-sm leading-5 text-ink">{nextStepCopy(order)}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{deliveryFollowUp(order.status)}</p>
      </section>

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="order-2 space-y-2 xl:order-1">
          <OrderProgress order={order} sizes={sizes} />
          {order.status === "pendiente_confirmacion" && token ? (
            <CustomerDelivery order={order} token={token} />
          ) : (
            <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2 text-sm leading-5">
              <h2 className="text-sm font-semibold">Entrega</h2>
              <p className="mt-1">{order.customerName}</p>
              <p>{order.phone}</p>
              {order.document ? <p>Cédula {order.document}</p> : null}
              <p>
                {order.address}
                {order.reference ? ` · ${order.reference}` : ""}
              </p>
              <p>
                {order.city}
                {order.department ? ` · ${order.department}` : ""}
              </p>
              <p className="mt-1.5 font-semibold">Pago contra entrega</p>
            </section>
          )}
          {order.status === "pendiente_confirmacion" && token ? (
            <CustomerProducts order={order} token={token} images={images} sizes={sizes} />
          ) : (
            <ProductList order={order} images={images} />
          )}
          {order.status === "pendiente_confirmacion" && token ? (
            <details className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold">Aviso para la tienda y cancelar</summary>
              <div className="mt-2 space-y-2">
                <CustomerBuyerNote orderId={order.id} token={token} note={order.buyerNote} />
                <CustomerCancel order={order} token={token} />
              </div>
            </details>
          ) : order.buyerNote ? (
            <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2 text-sm leading-5">
              <h2 className="text-sm font-semibold">Aviso para la tienda</h2>
              <p className="mt-1">{order.buyerNote}</p>
            </section>
          ) : null}
          <Link href="/tienda/condiciones" className="inline-flex text-sm font-semibold text-accent-strong">
            Condiciones de la compra
          </Link>
        </div>

        <aside className="elevate-1 order-1 rounded-[14px] border border-line bg-card px-3 py-2 xl:sticky xl:top-[3rem] xl:order-2">
          <h2 className="text-sm font-semibold">Resumen</h2>
          <ul className="mt-2 space-y-2">
            {order.lines.map((line) => {
              const photos = photosOf(images, line.sku);
              return (
                <li key={`${line.sku}:${line.variant ?? ""}`} className="text-xs">
                  <LinePhotos sku={line.sku} title={line.title} images={photos} />
                  <div className={`flex items-start gap-2 ${photos.length > 1 ? "mt-2" : ""}`}>
                    <ProductThumb sku={line.sku} show={photos.length === 1} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-5">{lineName(line)}</span>
                      <span className="mt-0.5 block text-muted">
                        {line.quantity} × {formatCop(line.unitPrice)}
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{formatCop(line.unitPrice * line.quantity)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-line pt-3">
            <p className="text-xs text-muted">{payableTotalLabel(order.status)}</p>
            <p className="text-lg font-extrabold tabular-nums">{formatCop(order.total)}</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            {customerPayLine(order.status, order.collected)}
            Dropi no está conectado. Sin guía ni fecha exacta.
          </p>
          <Link
            href="/tienda"
            className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-primary text-sm font-semibold text-on-dark"
          >
            Volver a la tienda
          </Link>
        </aside>
      </div>
    </div>
  );
}

const STEP_WORD = { hecho: "Listo", ahora: "Ahora", despues: "Después" } as const;

function nextStepCopy(order: CustomerOrder) {
  if (order.status === "pendiente_confirmacion") {
    return "Espera la confirmación de la tienda. Pagas al recibir. El total guardado no cambió. Mientras tanto puedes corregir la entrega o la talla si falta.";
  }
  if (order.status === "confirmado" || order.status === "en_preparacion") {
    return "La tienda prepara el envío. Pagas al recibir. El total guardado no cambió. Te escriben a este celular si hace falta algo.";
  }
  if (order.status === "en_transporte") {
    return "El pedido va en camino. Pagas al recibirlo. El total guardado no cambió.";
  }
  if (order.status === "entregado") {
    return order.collected
      ? "Pedido entregado. La tienda anotó el cobro. El total guardado no cambió."
      : "Pedido entregado. El cobro contra entrega todavía no está anotado. El total guardado no cambió.";
  }
  if (order.status === "incidencia") {
    return "La tienda está resolviendo una incidencia. Mientras dure, no se cobra. El total guardado no cambió.";
  }
  if (order.status === "devuelto") {
    return "El pedido fue marcado como devuelto. Ya no se cobra. El total guardado no cambió.";
  }
  if (order.status === "cancelado") {
    return "Este pedido quedó cancelado. Ya no se cobra. El total guardado no cambió.";
  }
  return "Consulta el avance abajo.";
}

function deliveryFollowUp(status: CustomerOrder["status"]) {
  if (status === "pendiente_confirmacion") return "No hay chat ni WhatsApp conectado.";
  if (status === "confirmado" || status === "en_preparacion" || status === "en_transporte" || status === "incidencia") {
    return "Si hay que cambiar la dirección, la tienda te escribe a este celular.";
  }
  return "No hay chat ni WhatsApp conectado.";
}

function OrderProgress({ order, sizes }: { order: CustomerOrder; sizes: CustomerSizeChoice[] }) {
  const steps = customerSteps(order.status);
  if (!steps) {
    const missing = customerMissingReasonNote(order);
    return (
      <div className="mt-2">
        <p className="text-sm leading-5 text-muted">
          {customerStatusNote(order.status, order.customerReason, order.cancelledByCustomer, order.collected)}
        </p>
        {missing ? <p className="mt-2 text-sm leading-5 font-semibold">{missing}</p> : null}
      </div>
    );
  }
  const hold = order.status === "pendiente_confirmacion" ? customerSizeHoldNote(order.lines, sizes) : "";
  const note = customerProgressNote(order.status, order.collected);
  return (
    <section aria-label="Avance" className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2">
      <h2 className="text-sm font-semibold">Avance</h2>
      <ol className="mt-2 space-y-1.5">
        {steps.map((step) => (
          <li
            key={step.label}
            className="flex items-baseline justify-between gap-3 text-sm"
            aria-current={step.state === "ahora" ? "step" : undefined}
          >
            <span className={step.state === "despues" ? "text-muted" : "font-semibold"}>{step.label}</span>
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{STEP_WORD[step.state]}</span>
          </li>
        ))}
      </ol>
      {hold ? <p className="mt-3 text-sm leading-5 font-semibold">{hold}</p> : null}
      {note ? <p className="mt-3 text-sm leading-5 text-muted">{note}</p> : null}
    </section>
  );
}

function CustomerDelivery({ order, token }: { order: CustomerOrder; token: string }) {
  const [state, action, pending] = useActionState(correctCustomerDeliveryAction, deliveryInitial);
  const [customerName, setCustomerName] = useState(order.customerName);
  const [phone, setPhone] = useState(order.phone);
  const [documentId, setDocumentId] = useState(order.document);
  const [department, setDepartment] = useState(order.department);
  const [city, setCity] = useState(order.city);
  const [address, setAddress] = useState(order.address);
  const [reference, setReference] = useState(order.reference);

  const checked = validateDelivery({
    customerName,
    phone,
    city,
    department,
    address,
    reference,
    document: documentId,
  });
  const draft = checked.value;
  const unchanged =
    Boolean(draft) &&
    draft!.customerName === order.customerName &&
    draft!.phone === order.phone &&
    draft!.city === order.city &&
    draft!.department === (order.department ?? "") &&
    draft!.address === order.address &&
    draft!.reference === order.reference &&
    draft!.document === (order.document ?? "");
  const canSave = Boolean(draft) && !unchanged;
  const previewText =
    canSave && draft
      ? dropiHandoffText({
          number: order.number,
          customerName: draft.customerName,
          phone: draft.phone,
          document: draft.document || undefined,
          department: draft.department || undefined,
          city: draft.city,
          address: draft.address,
          reference: draft.reference,
          lines: order.lines,
          total: order.total,
        })
      : null;

  return (
    <form action={action} className="elevate-1 space-y-2 rounded-[14px] border border-line bg-card px-3 py-2">
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="token" value={token} />
      <h2 className="text-sm font-semibold">Entrega</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nombre de quien recibe" htmlFor="customerName">
            <input id="customerName" name="customerName" required autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} className={fieldClass} />
          </Field>
        </div>
        <Field label="Celular" htmlFor="phone" hint="10 dígitos, empieza por 3.">
          <input id="phone" name="phone" required inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={fieldClass} />
        </Field>
        <Field label="Cédula de quien recibe" htmlFor="document" hint="Opcional. De 6 a 10 dígitos, sin puntos. Vacío: se quita.">
          <input id="document" name="document" inputMode="numeric" autoComplete="off" value={documentId} onChange={(event) => setDocumentId(event.target.value)} className={fieldClass} />
        </Field>
        <Field
          label="Departamento"
          htmlFor="department"
          hint={
            department.trim()
              ? "No es la ciudad."
              : "Opcional. No es la ciudad. La tienda puede confirmar sin él."
          }
        >
          <input id="department" name="department" autoComplete="address-level1" value={department} onChange={(event) => setDepartment(event.target.value)} className={fieldClass} />
        </Field>
        <Field label="Ciudad" htmlFor="city">
          <input id="city" name="city" required autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} className={fieldClass} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Dirección" htmlFor="address">
            <input id="address" name="address" required autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} className={fieldClass} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field
            label="Barrio o referencia"
            htmlFor="reference"
            hint="Opcional. Vacío: se quita. Sin un cambio válido el botón queda bloqueado. El total guardado no cambia."
          >
            <input id="reference" name="reference" autoComplete="off" value={reference} onChange={(event) => setReference(event.target.value)} className={fieldClass} />
          </Field>
        </div>
      </div>
      <p className="text-sm font-semibold">Pago contra entrega</p>
      <p className="text-xs leading-5 text-muted">Guardar la entrega no cobra. El total guardado no cambia. Pagas al recibir.</p>
      {previewText ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-muted">Vista previa al guardar</summary>
          <p className="mt-2 text-sm leading-5 whitespace-pre-line text-muted">{previewText}</p>
        </details>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !canSave}
        className={`inline-flex h-10 scroll-mb-24 items-center justify-center rounded-[10px] bg-accent px-3 text-sm font-extrabold text-primary-dark ${
          pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-55"
        }`}
      >
        {pending ? "Guardando…" : "Guardar entrega"}
      </button>
    </form>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
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

function ProductList({ order, images }: { order: CustomerOrder; images: CustomerImages[] }) {
  return (
    <section className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2">
      <h2 className="text-sm font-semibold">Productos</h2>
      <ul className="mt-2 space-y-2 text-sm">
        {order.lines.map((line) => {
          const photos = photosOf(images, line.sku);
          return (
          <li key={`${line.sku}:${line.variant ?? ""}`}>
            <LinePhotos sku={line.sku} title={line.title} images={photos} />
            <div className={`flex items-center gap-3 ${photos.length > 1 ? "mt-2" : ""}`}>
            <ProductThumb sku={line.sku} show={photos.length === 1} />
            <span className="min-w-0 flex-1">
              {lineName(line)} · {line.quantity}
            </span>
            <span className="tabular-nums">{formatCop(line.unitPrice * line.quantity)}</span>
            </div>
          </li>
          );
        })}
      </ul>
      <p className="mt-2 flex justify-between border-t border-line pt-2.5 text-sm font-extrabold">
        <span>{payableTotalLabel(order.status)}</span>
        <span className="tabular-nums">{formatCop(order.total)}</span>
      </p>
    </section>
  );
}

function CustomerProducts({
  order,
  token,
  images,
  sizes,
}: {
  order: CustomerOrder;
  token: string;
  images: CustomerImages[];
  sizes: CustomerSizeChoice[];
}) {
  const choices = order.lines.map(
    (line) => sizes.find((item) => item.sku === line.sku && item.sizeKind && item.variants.length > 0) ?? null,
  );
  if (!choices.some(Boolean)) return <ProductList order={order} images={images} />;

  return <CustomerSizeForm order={order} token={token} images={images} choices={choices} />;
}

function CustomerSizeForm({
  order,
  token,
  images,
  choices,
}: {
  order: CustomerOrder;
  token: string;
  images: CustomerImages[];
  choices: Array<CustomerSizeChoice | null>;
}) {
  const [state, action, pending] = useActionState(chooseCustomerSizeAction, sizeInitial);
  const [picked, setPicked] = useState(order.lines.map((line) => line.variant ?? ""));
  const kinds = choices.flatMap((choice) => (choice ? [choice.sizeKind] : []));
  const onlySize = kinds.every((kind) => kind === "tamano");
  const onlyFit = kinds.every((kind) => kind === "talla");
  const saveLabel = onlySize ? "Guardar tamaño" : onlyFit ? "Guardar talla" : "Guardar talla o tamaño";
  const incomplete = choices.some((choice, index) => choice && !choice.variants.includes(picked[index] ?? ""));
  const unchanged = order.lines.every((line, index) => (picked[index] ?? "") === (line.variant ?? ""));
  const canSave = !incomplete && !unchanged;
  const wasMissing = choices.some(
    (choice, index) => choice && !choice.variants.includes(order.lines[index]?.variant ?? ""),
  );
  const preview = canSave
    ? order.lines
        .map((line, index) => {
          const choice = choices[index];
          if (!choice) return "";
          return `${line.title}: ${sizeChoiceLabel(choice.sizeKind, picked[index] ?? "")}`;
        })
        .filter(Boolean)
        .join(". ")
    : "";
  const hint = onlySize
    ? "Mientras sigue pendiente, puedes cambiar el tamaño. El precio guardado no cambia. Sin una elección o sin un cambio el botón queda bloqueado."
    : onlyFit
      ? "Mientras sigue pendiente, puedes cambiar la talla. El precio guardado no cambia. Sin una elección o sin un cambio el botón queda bloqueado."
      : "Mientras sigue pendiente, puedes cambiar la talla o el tamaño. El precio guardado no cambia. Sin una elección o sin un cambio el botón queda bloqueado.";

  return (
    <form action={action} className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2">
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="token" value={token} />
      <h2 className="text-sm font-semibold">Productos</h2>
      <ul className="mt-2 space-y-2">
        {order.lines.map((line, index) => {
          const choice = choices[index];
          return (
            <li key={`${line.sku}:${line.variant ?? ""}:${index}`} className="text-sm">
              <input type="hidden" name="sku" value={line.sku} />
              <input type="hidden" name="variant" value={line.variant ?? ""} />
              <LinePhotos sku={line.sku} title={line.title} images={photosOf(images, line.sku)} />
              <div className={`flex items-center gap-3 ${photosOf(images, line.sku).length > 1 ? "mt-3" : ""}`}>
                <ProductThumb sku={line.sku} show={photosOf(images, line.sku).length === 1} />
                <span className="min-w-0 flex-1">
                  {line.title} · {line.quantity}
                </span>
                <span className="tabular-nums">{formatCop(line.unitPrice * line.quantity)}</span>
              </div>
              {choice ? (
                <label className="mt-2 block font-semibold" htmlFor={`linea-talla-${index}`}>
                  {choice.sizeKind === "tamano" ? "Tamaño" : "Talla"}
                  <select
                    id={`linea-talla-${index}`}
                    name="next"
                    value={picked[index] ?? ""}
                    onChange={(event) =>
                      setPicked((current) => current.map((item, position) => (position === index ? event.target.value : item)))
                    }
                    className={`mt-1 ${fieldClass}`}
                  >
                    <option value="">{choice.sizeKind === "tamano" ? "Elige el tamaño" : "Elige la talla"}</option>
                    {choice.variants.map((name) => (
                      <option key={name} value={name}>
                        {sizeChoiceLabel(choice.sizeKind, name)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="next" value={line.variant ?? ""} />
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex justify-between border-t border-line pt-3 font-extrabold">
        <span>Total al recibir</span>
        <span className="tabular-nums">{formatCop(order.total)}</span>
      </p>
      <p className="mt-2 text-xs leading-5 text-muted">{hint}</p>
      {preview ? (
        <p className="mt-2 text-sm leading-5 text-ink">
          Si guardas, queda así: {preview}. El total guardado sigue en {formatCop(order.total)}.
          {wasMissing
            ? onlySize
              ? " Con el tamaño anotado, la tienda puede confirmarlo."
              : onlyFit
                ? " Con la talla anotada, la tienda puede confirmarlo."
                : " Con la talla o el tamaño anotado, la tienda puede confirmarlo."
            : ""}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !canSave}
        className={`mt-3 inline-flex h-10 scroll-mb-24 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold ${
          pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-55"
        }`}
      >
        {pending ? "Guardando…" : saveLabel}
      </button>
    </form>
  );
}

function CustomerBuyerNote({ orderId, token, note }: { orderId: string; token: string; note: string }) {
  const [state, action, pending] = useActionState(saveBuyerNoteAction, noteInitial);
  const [value, setValue] = useState(note);
  const checked = validateBuyerNote(value);
  const current = validateBuyerNote(note).value ?? "";
  const canSave = !checked.error && (checked.value ?? "") !== current;
  const next = checked.value ?? "";

  return (
    <form action={action} className="rounded-[10px] border border-line bg-canvas px-3 py-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm font-semibold" htmlFor="buyer-note">
        Aviso para la tienda
        <textarea
          id="buyer-note"
          name="buyerNote"
          rows={3}
          maxLength={160}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="mt-1 min-h-20 w-full rounded-[10px] border border-line bg-card px-3 py-2 text-sm font-normal leading-5 focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
        />
      </label>
      <p className="mt-1 text-xs leading-5 text-muted">Opcional. Hasta 160 caracteres. Vacío: se quita. El total guardado no cambia.</p>
      {canSave ? (
        <p className="mt-2 text-sm leading-5 text-ink">
          {next ? "Si guardas, la tienda ve este aviso." : "Si guardas, se quita el aviso."}
          {next ? <span className="mt-1 block font-normal text-muted">{next}</span> : null}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !canSave}
        className={`mt-3 inline-flex h-10 scroll-mb-24 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold ${
          pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-55"
        }`}
      >
        {pending ? "Guardando…" : "Guardar aviso"}
      </button>
    </form>
  );
}

function CustomerCancel({ order, token }: { order: CustomerOrder; token: string }) {
  const [state, action, pending] = useActionState(cancelCustomerOrderAction, cancelInitial);
  const [reason, setReason] = useState("");
  const next = reason.trim().replace(/\s+/g, " ");
  const canSave = Boolean(next) && next.length <= 160;
  const preview = canSave ? customerStatusNote("cancelado", next, true, order.collected) : null;

  return (
    <form action={action} className="rounded-[10px] border border-line bg-canvas px-3 py-2">
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm font-semibold" htmlFor="cancel-reason">
        Cancelar este pedido
        <textarea
          id="cancel-reason"
          name="reason"
          rows={3}
          maxLength={160}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 min-h-20 w-full rounded-[10px] border border-line bg-card px-3 py-2 text-sm font-normal leading-5 focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
        />
      </label>
      <p className="mt-1 text-xs leading-5 text-muted">
        Solo mientras sigue pendiente. Hasta 160 caracteres. Vacío no cancela. El total guardado no cambia.
      </p>
      {preview ? (
        <p className="mt-2 text-sm leading-5 text-ink">
          Si cancelas, en tu pedido queda así.
          <span className="mt-1 block font-normal text-muted">{preview}</span>
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !canSave}
        className={`mt-3 inline-flex h-10 scroll-mb-24 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-danger ${
          pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-55"
        }`}
      >
        {pending ? "Cancelando…" : "Cancelar mi pedido"}
      </button>
    </form>
  );
}
