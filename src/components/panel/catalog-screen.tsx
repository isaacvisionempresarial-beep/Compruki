"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import Link from "next/link";
import { MAX_PRODUCT_IMAGES, parsePesos, parseVariants, productMargin, type CatalogProduct } from "@/lib/catalog";
import { prepareProductImage } from "@/lib/prepare-image";
import { formatCop, formatDay } from "@/lib/format";
import { campaignPath } from "@/lib/campaign";
import { catalogDriftText, fichaDrift, fichaDriftNote, orderFocusHref, pendingSizeHoldPhrase, pendingSizeHolds, outsideCostCopyNote, skuCostGroupNote, skuCostGroups, skuCostPreviewNote, storedSkuLines, type StoredSkuLine, type StoreOrder } from "@/lib/store-order";
import { cx } from "@/lib/cx";
import { usePanelQuery } from "@/components/panel/panel-shell";
import { PhotoCarousel } from "@/components/photo-carousel";
import {
  deactivateProductAction,
  deleteProductAction,
  type ProductLifecycleState,
} from "@/server/catalog-actions";
import { applySkuCatalogCostAction, type SkuCostState } from "@/server/store-actions";

const filters = [
  { id: "todos", label: "Todos" },
  { id: "diferencia", label: "Otra cifra" },
  { id: "tienda", label: "En tienda" },
  { id: "agotados", label: "Publicado no pedible" },
  { id: "ocultos", label: "Borrador" },
] as const;

type FilterId = (typeof filters)[number]["id"];

const lifecycleInitial: ProductLifecycleState = { error: null, message: null };
const skuCostInitial: SkuCostState = { error: null, saved: 0, scope: null };

export function CatalogScreen({
  products,
  orders,
  canManageCommerce = false,
}: {
  products: CatalogProduct[];
  orders: StoreOrder[];
  canManageCommerce?: boolean;
}) {
  const [filter, setFilter] = useState<FilterId>("todos");
  const query = usePanelQuery().trim().toLocaleLowerCase("es");
  const skusInOrders = useMemo(() => {
    const skus = new Set<string>();
    for (const order of orders) {
      for (const line of order.lines) skus.add(line.sku);
    }
    return skus;
  }, [orders]);
  const holds = useMemo(
    () =>
      pendingSizeHolds(
        orders,
        products.map((product) => ({ sku: product.sku, variants: product.variants, sizeKind: product.sizeKind ?? null })),
      ),
    [orders, products],
  );
  const rowDrift = useMemo(() => {
    const notes = new Map<string, { note: string; plan: string; preview: string; outside: string; numbers: string[]; pending: string[]; cancel: string[]; incidence: string[]; returned: string[] }>();
    for (const product of products) {
      const drift = fichaDrift(storedSkuLines(orders, product.sku), {
        price: product.price,
        cost: product.cost,
        shipping: product.shipping,
        commissions: product.commissions,
      });
      const note = fichaDriftNote(drift, product.price);
      if (!note) continue;
      notes.set(product.sku, {
        note,
        plan: skuCostGroupNote(
          skuCostGroups(storedSkuLines(orders, product.sku), {
            cost: product.cost,
            shipping: product.shipping,
            commissions: product.commissions,
          }),
        ),
        preview: skuCostPreviewNote(orders, product.sku, {
          sku: product.sku,
          cost: product.cost,
          shipping: product.shipping,
          commissions: product.commissions,
        }),
        outside: outsideCostCopyNote(storedSkuLines(orders, product.sku), {
          cost: product.cost,
          shipping: product.shipping,
          commissions: product.commissions,
        }),
        numbers: [...new Set([...drift.priceNumbers, ...drift.costNumbers])],
        pending: drift.pendingNumbers,
        cancel: drift.cancelNumbers,
        incidence: drift.incidenceNumbers,
        returned: drift.returnedNumbers,
      });
    }
    return notes;
  }, [orders, products]);
  const driftText = useMemo(() => catalogDriftText(products, orders), [orders, products]);

  const searched = useMemo(
    () =>
      products.filter(
        (product) =>
          !query ||
          product.title.toLocaleLowerCase("es").includes(query) ||
          product.sku.toLocaleLowerCase("es").includes(query) ||
          product.category.toLocaleLowerCase("es").includes(query) ||
          product.highlights.toLocaleLowerCase("es").includes(query) ||
          product.answers.toLocaleLowerCase("es").includes(query) ||
          product.variants.some((name) => name.toLocaleLowerCase("es").includes(query)) ||
          (holds.get(product.sku) ? pendingSizeHoldPhrase(holds.get(product.sku)!.orders, holds.get(product.sku)!.kind, "ficha") : "")
            .toLocaleLowerCase("es")
            .includes(query) ||
          (rowDrift.get(product.sku)?.note ?? "").toLocaleLowerCase("es").includes(query) ||
          (rowDrift.get(product.sku)?.plan ?? "").toLocaleLowerCase("es").includes(query) ||
          (rowDrift.get(product.sku)?.preview ?? "").toLocaleLowerCase("es").includes(query) ||
          (rowDrift.get(product.sku)?.outside ?? "").toLocaleLowerCase("es").includes(query) ||
          (rowDrift.get(product.sku)?.numbers ?? []).some((number) => number.toLocaleLowerCase("es").includes(query)),
      ),
    [products, query, holds, rowDrift],
  );
  const visible = useMemo(
    () => searched.filter((product) => matches(product, filter, rowDrift.has(product.sku))),
    [searched, filter, rowDrift],
  );

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Catálogo interno</p>
        <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Catálogo</h1>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-muted">
          Precio y margen de la ficha. No son el total de un pedido ni dinero cobrado. Desactivar no cambia el precio ni la publicación. Dropi no está conectado.
        </p>
      </div>
      <nav aria-label="Herramientas" className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
        {canManageCommerce ? (
          <Link
            href="/panel/catalogo/nuevo"
            title="Crearlo no cobra ni confirma un pedido."
            className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold hover:bg-subtle"
          >
            Nuevo producto
          </Link>
        ) : (
          <p className="text-sm text-muted">Solo el propietario crea productos. No cobra.</p>
        )}
        <button
          type="button"
          disabled
          title="Disponible cuando Dropi esté autorizado. No cobra."
          className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-[10px] bg-subtle px-3 text-sm font-semibold text-muted"
        >
          Importar desde Dropi
          <span className="sr-only">, pendiente de autorización</span>
        </button>
      </nav>

      <section className="mt-5" aria-labelledby="fichas-titulo">
        <h2 id="fichas-titulo" className="text-base font-bold">Fichas</h2>
        <p className="mt-0.5 max-w-2xl text-xs leading-5 text-muted">
          {canManageCommerce
            ? "Cada ficha guarda precio, costo, publicación y fotos. Se edita en su página."
            : "Textos, fotos y disponibilidad se editan en su página. Precio, publicación y alta los guarda el propietario."}{" "}
          Lo publicado se ve en la tienda. Copiar el enlace no cambia el precio ni crea una campaña. Lo vendido está en{" "}
          <Link href="/panel/rentabilidad" title="Verla no cobra ni cambia los pedidos." className="font-semibold text-accent-strong">
            Rentabilidad
          </Link>
          . Leer esto no cobra ni cambia el precio ni la publicación.
        </p>
        <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-3">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Lista</p>
          <p className="mt-0.5 text-xs leading-5 text-muted">Filtrar no cobra ni cambia el precio ni la publicación.</p>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Filtrar productos">
            {filters.map((item) => {
              const count = searched.filter((product) => matches(product, item.id, rowDrift.has(product.sku))).length;
              const selectedFilter = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedFilter}
                  title="Filtrar no cobra ni cambia el precio ni la publicación."
                  className={cx(
                    "min-h-9 rounded-[10px] px-2.5 text-sm font-semibold",
                    selectedFilter ? "bg-primary text-on-dark" : "border border-line bg-canvas text-muted",
                  )}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                  <span className="ml-1 tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        {rowDrift.size > 0 ? (
          <p className="mt-3 text-xs leading-5 text-warning">
            Si la ficha de hoy no es el precio o el costo guardado, va en esa fila. Pendiente o cancelado no entra al margen ni a la utilidad. En incidencia no suma como venta confirmada. Devuelto, el total no entra a la utilidad. Abrir el pedido no reescribe el total ni cobra.
          </p>
        ) : null}
        <CatalogDriftSheet text={driftText} />

          {visible.length === 0 ? (
            <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2">
              <p className="text-sm leading-5 text-muted">
                {catalogEmptyMessage(products.length, searched.length, filter, query, canManageCommerce)}
              </p>
              {products.length === 0 && canManageCommerce ? (
                <Link
                  href="/panel/catalogo/nuevo"
                  title="Crearlo no cobra ni confirma un pedido."
                  className="mt-3 inline-flex h-10 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark"
                >
                  Nuevo producto
                </Link>
              ) : null}
            </div>
          ) : (
            <ul className="elevate-1 mt-3 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-card">
              {visible.map((product) => (
                <CatalogProductRow
                  key={product.id}
                  product={product}
                  hasOrders={skusInOrders.has(product.sku)}
                  hold={holds.get(product.sku) ?? null}
                  drift={rowDrift.get(product.sku) ?? null}
                  canManageCommerce={canManageCommerce}
                />
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}

function CatalogProductRow({
  product,
  hasOrders,
  hold,
  drift,
  canManageCommerce,
}: {
  product: CatalogProduct;
  hasOrders: boolean;
  hold: { orders: number; kind: "talla" | "tamano" } | null;
  drift: { note: string; plan: string; preview: string; outside: string; numbers: string[]; pending: string[]; cancel: string[]; incidence: string[]; returned: string[] } | null;
  canManageCommerce: boolean;
}) {
  const margin = productMargin(product);
  const cover = product.assets.find((asset) => asset.kind === "image");
  const sizeCount = product.variants.length;
  const sizeWord =
    product.sizeKind === "tamano"
      ? sizeCount === 1
        ? "tamaño"
        : "tamaños"
      : sizeCount === 1
        ? "talla"
        : "tallas";
  const meta = [
    `SKU ${product.sku}`,
    product.category || "",
    sizeCount > 0 ? `${sizeCount} ${sizeWord}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="px-3 py-2">
      <div className="flex items-start gap-3">
        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-line bg-subtle">
          {cover || product.image ? (
            // Miniatura local del panel; next/image no aporta en esta fila densa.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover ? `/panel/imagen/${product.sku}?m=${cover.id}` : `/panel/imagen/${product.sku}`}
              alt=""
              title="Verla no cambia el precio de la ficha."
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="px-1 text-center text-[10px] font-semibold text-muted" title="El precio de la ficha no cambia.">Sin foto</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-sm font-bold tracking-tight">{product.title}</h2>
                <ProductMarks product={product} inline />
              </div>
              <p className="mt-0.5 truncate text-xs text-muted" title={meta}>
                {meta}
              </p>
              {hold ? (
                <p className="mt-1 truncate text-xs font-semibold text-warning">
                  {pendingSizeHoldPhrase(hold.orders, hold.kind, "ficha")}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {product.published ? (
                <a
                  href={campaignPath(product.sku)}
                  title="Visitarla no cobra ni cambia el precio ni la publicación."
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center justify-center rounded-[10px] border border-line bg-card px-2.5 text-xs font-semibold hover:bg-canvas"
                >
                  Visitar
                </a>
              ) : null}
              <Link
                href={`/panel/catalogo/${product.sku}`}
                title="Abrirla no cobra ni cambia el precio ni la publicación."
                className="inline-flex h-8 items-center justify-center rounded-[10px] border border-line bg-card px-2.5 text-xs font-semibold hover:bg-canvas"
              >
                {canManageCommerce ? "Editar" : "Editar textos"}
              </Link>
              <CatalogRowLifecycle product={product} hasOrders={hasOrders} canManageCommerce={canManageCommerce} />
            </div>
          </div>

          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
            <span>
              <span className="text-muted">Precio de la ficha </span>
              <span className="font-semibold">{formatCop(product.price)}</span>
            </span>
            <span className="text-muted">
              Costo <span className="tabular-nums">{formatCop(product.cost)}</span>
            </span>
            <span>
              <span className="text-muted">Margen estimado </span>
              <span className={cx("font-bold", margin < 0 ? "text-warning" : "text-accent-strong")}>
                {formatCop(margin)}
              </span>
            </span>
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">El precio y el margen son de la ficha. No son dinero cobrado.</p>
          {drift ? (
            <div className="mt-1 text-xs leading-5 text-warning">
              <p>{drift.note}</p>
              {drift.plan ? <p className="mt-1">{drift.plan}</p> : null}
              {drift.preview ? <p className="mt-1">{drift.preview}</p> : null}
              {drift.outside ? <p className="mt-1">{drift.outside}</p> : null}
              {drift.numbers.length > 0 ? (
                <p className="mt-0.5">
                  {drift.numbers.map((number) => (
                    <Link
                      key={number}
                      href={orderFocusHref(number)}
                      title={driftLinkTitle(number, drift)}
                      className="mr-2 font-semibold text-accent-strong"
                    >
                      {number}
                    </Link>
                  ))}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function CatalogRowLifecycle({
  product,
  hasOrders,
  canManageCommerce,
}: {
  product: CatalogProduct;
  hasOrders: boolean;
  canManageCommerce: boolean;
}) {
  const [deleteState, deleteAction, deletePending] = useActionState(deleteProductAction, lifecycleInitial);
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(
    deactivateProductAction,
    lifecycleInitial,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!canManageCommerce) {
    if (!product.available) {
      return <span className="text-xs font-semibold text-muted">{deactivateState.message ?? "Inactivo"}</span>;
    }
    return (
      <form action={deactivateAction}>
        <input type="hidden" name="id" value={product.id} />
        <button
          type="submit"
          disabled={deactivatePending}
          title="No se puede pedir. No cambia el precio ni la publicación."
          className={`inline-flex h-8 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold hover:bg-canvas ${
            deactivatePending ? "cursor-wait opacity-70" : ""
          }`}
        >
          {deactivatePending ? "…" : "Desactivar"}
        </button>
        {deactivateState.error ? <span className="ml-2 text-xs font-semibold text-danger">{deactivateState.error}</span> : null}
      </form>
    );
  }

  if (!hasOrders) {
    if (confirmDelete) {
      return (
        <form action={deleteAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={product.id} />
          <button
            type="submit"
            title="Quita el producto del catálogo. No cobra ni confirma un pedido."
            disabled={deletePending}
            className={`inline-flex h-8 items-center justify-center rounded-[10px] bg-danger px-3 text-sm font-semibold text-on-dark ${
              deletePending ? "cursor-wait opacity-70" : ""
            }`}
          >
            {deletePending ? "…" : "Confirmar"}
          </button>
          <button
            type="button"
            title="No lo quita ni cobra."
            className="inline-flex h-8 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold"
            onClick={() => setConfirmDelete(false)}
          >
            No
          </button>
          <p className="w-full text-xs leading-5 text-muted">Quita el producto del catálogo. No cobra ni confirma un pedido.</p>
          {deleteState.error ? <span className="text-xs font-semibold text-danger">{deleteState.error}</span> : null}
        </form>
      );
    }
    return (
      <button
        type="button"
        title="Todavía no elimina. No cobra."
        className="inline-flex h-8 items-center justify-center rounded-[10px] border border-danger bg-card px-3 text-sm font-semibold text-danger hover:bg-danger-tint"
        onClick={() => setConfirmDelete(true)}
      >
        Eliminar
      </button>
    );
  }

  if (!product.available) {
    return <span className="text-xs font-semibold text-muted">{deactivateState.message ?? "Inactivo"}</span>;
  }

  return (
    <form action={deactivateAction}>
      <input type="hidden" name="id" value={product.id} />
      <button
        type="submit"
        disabled={deactivatePending}
        title="Hay pedidos con este producto; no se puede eliminar. Desactivar no cambia el precio ni la publicación."
        className={`inline-flex h-8 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold hover:bg-canvas ${
          deactivatePending ? "cursor-wait opacity-70" : ""
        }`}
      >
        {deactivatePending ? "…" : "Desactivar"}
      </button>
      {deactivateState.error ? (
        <span className="ml-2 text-xs font-semibold text-danger">{deactivateState.error}</span>
      ) : null}
    </form>
  );
}

function catalogEmptyMessage(total: number, searched: number, filter: FilterId, query: string, canManageCommerce: boolean) {
  if (total === 0) {
    return canManageCommerce
      ? "Todavía no hay productos en el catálogo. Crea uno a mano. No cobra. Importar desde Dropi sigue pendiente de autorización."
      : "Todavía no hay productos en el catálogo. Solo el propietario puede crear uno. No cobra. Importar desde Dropi sigue pendiente de autorización.";
  }
  if (query && searched === 0) return "Ningún producto coincide con la búsqueda. Filtrar no cobra ni cambia el precio ni la publicación.";
  if (filter === "diferencia") return "Ninguna ficha tiene otro precio o costo guardado. Filtrar no cobra ni cambia el precio ni la publicación.";
  if (filter === "tienda") return "No hay productos en tienda. Filtrar no cobra ni cambia el precio ni la publicación.";
  if (filter === "ocultos") return "No hay borradores. Filtrar no cobra ni cambia el precio ni la publicación.";
  if (filter === "agotados") return "No hay publicados no pedibles. Filtrar no cobra ni cambia el precio ni la publicación.";
  return "No hay productos en este grupo. Filtrar no cobra ni cambia el precio ni la publicación.";
}

function matches(product: CatalogProduct, filter: FilterId, drifted: boolean) {
  if (filter === "diferencia") return drifted;
  if (filter === "tienda") return product.published && product.available;
  if (filter === "ocultos") return !product.published;
  if (filter === "agotados") return product.published && !product.available;
  return true;
}

function driftLinkTitle(
  number: string,
  hold: { pending: string[]; cancel: string[]; incidence: string[]; returned: string[] },
) {
  if (hold.pending.includes(number) || hold.cancel.includes(number)) {
    return "No entra al margen ni a la utilidad. Abrirlo no cobra ni cambia el total guardado.";
  }
  if (hold.incidence.includes(number)) {
    return "No suma como venta confirmada mientras dure. Abrirlo no cobra ni cambia el total guardado.";
  }
  if (hold.returned.includes(number)) {
    return "El total guardado no entra a la utilidad. Abrirlo no cobra ni cambia el total guardado.";
  }
  return "Abrirlo no cobra ni cambia el total guardado.";
}

function CampaignLink({
  product,
  compact = false,
}: {
  product: Pick<CatalogProduct, "title" | "sku" | "published" | "available">;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const path = campaignPath(product.sku);

  function copy() {
    const url = `${window.location.origin}${path}`;
    const area = document.createElement("textarea");
    area.value = url;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    let copiedByCommand = false;
    try {
      copiedByCommand = document.execCommand("copy");
    } catch {
      copiedByCommand = false;
    }
    area.remove();
    if (copiedByCommand) {
      setCopied("ok");
      return;
    }
    void navigator.clipboard.writeText(url).then(
      () => setCopied("ok"),
      () => setCopied("fail"),
    );
  }

  if (!product.published) {
    if (compact) return null;
    return <p className="mt-1 text-xs leading-5 text-muted">Sin publicar: no tiene enlace para una campaña. No cobra.</p>;
  }

  if (compact) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-semibold text-muted">Campaña</span>
        <a href={path} target="_blank" rel="noreferrer" title="Abrirla no cobra ni cambia el precio ni la publicación." className="font-semibold text-accent-strong underline-offset-2 hover:underline">
          Abrir
        </a>
        <button
          type="button"
          className="font-semibold text-accent-strong underline-offset-2 hover:underline"
          aria-label={`Copiar enlace de ${product.title}`}
          title="Copiarlo no cobra ni cambia el precio ni la publicación."
          onClick={copy}
        >
          {copied === "ok" ? "Copiado" : "Copiar enlace"}
        </button>
        {copied === "ok" ? <span className="text-accent-strong">No cambia el precio ni crea la campaña.</span> : null}
        {product.available ? null : <span className="text-warning">Se abre, pero no se puede pedir.</span>}
        {copied === "fail" ? (
          <span role="alert" className="text-danger">
            No se pudo copiar. No cobra.
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-1">
      <p className="text-[10px] font-bold tracking-[0.06em] text-muted uppercase">Enlace de campaña</p>
      <p className="mt-1 text-xs leading-5 break-all text-muted" title={path}>
        {path}
      </p>
      {product.available ? null : (
        <p className="text-xs leading-5 text-warning">La página se abre, pero ahora no se puede pedir.</p>
      )}
      <div className="mt-1 flex flex-wrap gap-2">
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          title="Abrirla no cobra ni cambia el precio ni la publicación."
          className="inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold hover:bg-canvas"
        >
          Abrir página
        </a>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold hover:bg-canvas"
          aria-label={`Copiar enlace de ${product.title}`}
          title="Copiarlo no cobra ni cambia el precio ni la publicación."
          onClick={copy}
        >
          {copied === "ok" ? "Enlace copiado" : "Copiar enlace"}
        </button>
      </div>
      {copied === "ok" ? (
        <p role="status" className="mt-1 text-xs leading-5 text-accent-strong">
          Pégalo en el anuncio. No crea la campaña, no cambia el precio publicado y no es gasto.
        </p>
      ) : null}
      {copied === "fail" ? (
        <p role="alert" className="mt-1 text-xs leading-5 text-danger">
          No se pudo copiar. Selecciona el enlace y cópialo a mano. No cobra.
        </p>
      ) : null}
    </div>
  );
}

function ProductMarks({ product, inline = false }: { product: { published: boolean; available: boolean }; inline?: boolean }) {
  const mark = catalogMark(product);
  return (
    <span
      className={cx(
        "inline-flex shrink-0 rounded-[8px] px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        mark.tone === "on" && "bg-accent-tint text-accent-strong",
        mark.tone === "off" && "bg-subtle text-ink",
        mark.tone === "warn" && "bg-warning-tint text-warning",
        !inline && "mt-1",
      )}
    >
      {mark.label}
    </span>
  );
}

function catalogMark(product: { published: boolean; available: boolean }) {
  if (product.published && product.available) return { label: "En tienda", tone: "on" as const };
  if (product.published && !product.available) return { label: "Publicado no pedible", tone: "warn" as const };
  return { label: "Borrador", tone: "off" as const };
}

function CatalogDriftSheet({ text }: { text: string }) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  if (!text) return null;

  function copy() {
    const node = document.getElementById("catalogo-fichas-distintas");
    if (!(node instanceof HTMLTextAreaElement)) return;
    node.focus();
    node.select();
    let copiedByCommand = false;
    try {
      copiedByCommand = document.execCommand("copy");
    } catch {
      copiedByCommand = false;
    }
    if (copiedByCommand) {
      setCopied("ok");
      return;
    }
    void navigator.clipboard.writeText(text).then(
      () => setCopied("ok"),
      () => setCopied("fail"),
    );
  }

  return (
    <section className="mt-3" aria-labelledby="catalogo-fichas-distintas-titulo">
      <h2 id="catalogo-fichas-distintas-titulo" className="text-sm font-semibold">
        Fichas para copiar
      </h2>
      <p className="mt-0.5 text-xs leading-5 text-muted">
        El catálogo completo, no el filtro de la pantalla. Van el precio, el costo, el envío y las comisiones de hoy junto a lo guardado, y el número del pedido. Si sigue pendiente o está cancelado, no entra al margen ni a la utilidad. En incidencia no suma como venta confirmada. Devuelto, el total guardado no entra a la utilidad. En la ficha, un botón anota el costo en los que ya cuentan y otro en los que siguen fuera. Si aparece un margen, es el que quedaría en los que ya cuentan. Copiar esta lista no lo guarda ni cambia el total.
      </p>
      <div className="elevate-1 mt-2 rounded-[14px] border border-line bg-card px-3 py-2">
        <label className="text-sm font-semibold" htmlFor="catalogo-fichas-distintas">
          Texto de las fichas
          <textarea
            id="catalogo-fichas-distintas"
            title="Leerlo no cobra ni cambia el total guardado."
            readOnly
            rows={8}
            value={text}
            className="mt-1 min-h-32 w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm leading-5 font-normal text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
          />
        </label>
        <button
          type="button"
          title="Copiar no cobra ni cambia el total guardado."
          className="mt-2 inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold"
          onClick={copy}
        >
          {copied === "ok" ? "Fichas copiadas" : "Copiar fichas"}
        </button>
        {copied === "ok" ? (
          <p role="status" className="mt-2 text-sm text-accent-strong">
            Listo para pegarlo a mano. Copiar no cobra ni reescribe los pedidos. El total guardado no cambia.
          </p>
        ) : null}
        {copied === "fail" ? (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger">
            No se pudo copiar. El texto queda seleccionado. No cobra. El total guardado no cambia.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SkuCostApply({
  product,
  lines,
  amounts,
  costPreview,
  canManageCommerce,
}: {
  product: CatalogProduct;
  lines: StoredSkuLine[];
  amounts: { cost: string; shipping: string; commissions: string };
  costPreview: string;
  canManageCommerce: boolean;
}) {
  const [state, action, pending] = useActionState(applySkuCatalogCostAction, skuCostInitial);
  const saved = fichaDrift(lines, {
    price: product.price,
    cost: product.cost,
    shipping: product.shipping,
    commissions: product.commissions,
  });
  if (saved.costNumbers.length === 0 && state.saved === 0) return null;
  const dirty =
    parsePesos(amounts.cost) !== product.cost ||
    parsePesos(amounts.shipping) !== product.shipping ||
    parsePesos(amounts.commissions) !== product.commissions;
  const groups = skuCostGroups(lines, { cost: product.cost, shipping: product.shipping, commissions: product.commissions });
  const plan = skuCostGroupNote(groups);
  const outsideCopy = outsideCostCopyNote(lines, { cost: product.cost, shipping: product.shipping, commissions: product.commissions });
  const countedLabel = groups.counted.length === 1 ? "1 pedido que ya cuenta" : `${groups.counted.length} pedidos que ya cuentan`;
  const outsideLabel = groups.outside.length === 1 ? "1 pedido que sigue fuera" : `${groups.outside.length} pedidos que siguen fuera`;
  return (
    <div className="mt-3 rounded-[10px] border border-line bg-card px-3 py-2">
      <p className="text-sm font-semibold">Costo de hoy en los pedidos</p>
      <p className="mt-1 text-sm leading-5 text-muted">
        {canManageCommerce
          ? "Cada botón copia un grupo. El de los que ya cuentan no toca a los que siguen fuera. No usa lo que está escrito y todavía no guardaste. El precio de cada pedido no cambia. El total guardado no cambia. No es dinero cobrado."
          : "Solo el propietario copia estas cifras a los pedidos. El precio y el total guardado no cambian."}
      </p>
      {plan ? <p className="mt-1 text-sm leading-5 text-warning">{plan}</p> : null}
      {outsideCopy ? <p className="mt-1 text-sm leading-5">{outsideCopy}</p> : null}
      {costPreview ? <p className="mt-1 text-sm leading-5">{costPreview}</p> : null}
      {dirty ? (
        <p className="mt-1 text-sm leading-5 text-warning">Guarda la ficha primero. Este botón usa lo ya guardado, no lo que está escrito.</p>
      ) : null}
      {saved.costNumbers.length > 0 ? (
        <p className="mt-1 text-sm leading-5">
          {saved.costNumbers.map((number) => (
            <Link
              key={number}
              href={orderFocusHref(number)}
              title="Abrirlo no cobra ni cambia el total guardado."
              className="mr-2 font-semibold text-accent-strong"
            >
              {number}
            </Link>
          ))}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="mt-1 text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
      {state.saved > 0 ? (
        <p role="status" className="mt-1 text-sm text-accent-strong">
          {state.scope === "fuera"
            ? `Quedó anotado en ${state.saved === 1 ? "1 pedido que sigue fuera" : `${state.saved} pedidos que siguen fuera`}. No entran al margen ni a la utilidad. El precio y el total guardado no cambiaron.`
            : `Quedó anotado en ${state.saved === 1 ? "1 pedido que ya cuenta" : `${state.saved} pedidos que ya cuentan`}. Los que siguen fuera no cambiaron. El precio y el total guardado no cambiaron.`}
        </p>
      ) : null}
      {canManageCommerce ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            title="No toca a los que siguen fuera. El precio y el total guardado no cambian."
            disabled={pending || dirty || groups.counted.length === 0}
            className={`inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold ${
              pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
            }`}
            onClick={() => {
              const data = new FormData();
              data.set("sku", product.sku);
              data.set("scope", "cuentan");
              action(data);
            }}
          >
            {pending ? "…" : `Usar las cifras de hoy en ${countedLabel}`}
          </button>
          <button
            type="button"
            title="No los mete al margen ni a la utilidad. El precio y el total guardado no cambian."
            disabled={pending || dirty || groups.outside.length === 0}
            className={`inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold ${
              pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
            }`}
            onClick={() => {
              const data = new FormData();
              data.set("sku", product.sku);
              data.set("scope", "fuera");
              action(data);
            }}
          >
            {pending ? "…" : `Usarlas en ${outsideLabel}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FichaDriftNotice({
  lines,
  amounts,
}: {
  lines: StoredSkuLine[];
  amounts: { price: number | null; cost: number | null; shipping: number | null; commissions: number | null };
}) {
  const drift = fichaDrift(lines, amounts);
  const note = fichaDriftNote(drift, amounts.price);
  if (!note) return null;
  const numbers = [...new Set([...drift.priceNumbers, ...drift.costNumbers])];
  const hold = {
    pending: drift.pendingNumbers,
    cancel: drift.cancelNumbers,
    incidence: drift.incidenceNumbers,
    returned: drift.returnedNumbers,
  };
  return (
    <div className="mt-2 text-sm leading-5 text-warning">
      <p>{note}</p>
      {numbers.length > 0 ? (
        <p className="mt-1">
          {numbers.map((number) => (
            <Link
              key={number}
              href={orderFocusHref(number)}
              title={driftLinkTitle(number, hold)}
              className="mr-2 font-semibold text-accent-strong"
            >
              {number}
            </Link>
          ))}
        </p>
      ) : null}
    </div>
  );
}

export function ProductEditor({
  product,
  formAction,
  pending,
  error,
  relatedOrderCount = 0,
  storedLines = [],
  costPreview = "",
  canManageCommerce = false,
}: {
  product: CatalogProduct | null;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
  relatedOrderCount?: number;
  storedLines?: StoredSkuLine[];
  costPreview?: string;
  canManageCommerce?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.scrollIntoView({ block: "start" });
  }, []);

  const [title, setTitle] = useState(product?.title ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [highlights, setHighlights] = useState(product?.highlights ?? "");
  const [answers, setAnswers] = useState(product?.answers ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [externalRef, setExternalRef] = useState(product?.externalRef ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [variantsText, setVariantsText] = useState(product?.variants.join("\n") ?? "");
  const [sizeKind, setSizeKind] = useState(product?.sizeKind ?? "");
  const [published, setPublished] = useState(product?.published ?? false);
  const [unavailable, setUnavailable] = useState(product ? !product.available : false);
  const [amounts, setAmounts] = useState({
    price: product?.price.toString() ?? "",
    cost: product?.cost.toString() ?? "",
    shipping: product?.shipping.toString() ?? "",
    commissions: product?.commissions.toString() ?? "",
  });
  const imagesRef = useRef<HTMLInputElement>(null);
  const imagePickerRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const videoPickerRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<string[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [imageNote, setImageNote] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [clearVideo, setClearVideo] = useState(false);
  const videoUrlRef = useRef<string | null>(null);
  useEffect(() => {
    const previews = previewsRef;
    const videoUrl = videoUrlRef;
    return () => {
      for (const url of previews.current) URL.revokeObjectURL(url);
      if (videoUrl.current) URL.revokeObjectURL(videoUrl.current);
    };
  }, []);

  const savedImages = product?.assets.filter((asset) => asset.kind === "image") ?? [];
  const savedVideo = product?.assets.some((asset) => asset.kind === "video") ?? false;

  async function onPickImages(event: ChangeEvent<HTMLInputElement>) {
    const picked = [...(event.target.files ?? [])];
    event.target.value = "";
    if (picked.length === 0) return;
    const kept = savedImages.filter((asset) => !removed.includes(asset.id)).length;
    const queued = imagesRef.current?.files?.length ?? 0;
    if (kept + queued + picked.length > MAX_PRODUCT_IMAGES) {
      setImageError(`Puedes guardar hasta ${MAX_PRODUCT_IMAGES} fotos.`);
      return;
    }
    const prepared: File[] = [];
    let reduced = false;
    for (const file of picked) {
      const result = await prepareProductImage(file);
      if ("error" in result) {
        setImageError(result.error);
        return;
      }
      prepared.push(result.file);
      reduced = reduced || result.reduced;
    }
    const transfer = new DataTransfer();
    if (imagesRef.current?.files) {
      for (const file of imagesRef.current.files) transfer.items.add(file);
    }
    for (const file of prepared) transfer.items.add(file);
    if (imagesRef.current) imagesRef.current.files = transfer.files;
    const urls = prepared.map((file) => URL.createObjectURL(file));
    previewsRef.current.push(...urls);
    setPhotoIndex(savedImages.length + pendingPreviews.length);
    setPendingPreviews((current) => [...current, ...urls]);
    setImageError(null);
    setImageNote(savedMediaNote("fotos", reduced));
  }

  function onPickVideo(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    if (picked.size > 8_000_000) {
      setImageError("El video puede pesar hasta 8 MB.");
      return;
    }
    if (picked.type && picked.type !== "video/mp4") {
      setImageError("El video tiene que ser MP4.");
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(picked);
    if (videoRef.current) videoRef.current.files = transfer.files;
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    const url = URL.createObjectURL(picked);
    videoUrlRef.current = url;
    setVideoPreview(url);
    setClearVideo(false);
    setImageError(null);
    setImageNote(savedMediaNote("video", false));
  }

  const price = parsePesos(amounts.price);
  const cost = parsePesos(amounts.cost);
  const shipping = parsePesos(amounts.shipping);
  const commissions = parsePesos(amounts.commissions);
  const amountsReady = price !== null && cost !== null && shipping !== null && commissions !== null;
  const margin = amountsReady ? productMargin({ price: price!, cost: cost!, shipping: shipping!, commissions: commissions! }) : null;
  const draftVariants = parseVariants(variantsText);
  const draftSizeKind = draftVariants.length > 0 ? sizeKind : "";
  const fieldsReady = Boolean(title.trim() && sku.trim() && amountsReady && (draftVariants.length === 0 || draftSizeKind));
  const unchanged = Boolean(
    product &&
      pendingPreviews.length === 0 &&
      !videoPreview &&
      removed.length === 0 &&
      !clearVideo &&
      title === product.title &&
      description === product.description &&
      highlights === product.highlights &&
      answers === product.answers &&
      sku === product.sku &&
      externalRef === product.externalRef &&
      category === product.category &&
      draftVariants.length === product.variants.length &&
      draftVariants.every((name, index) => name === product.variants[index]) &&
      draftSizeKind === (product.sizeKind ?? "") &&
      published === product.published &&
      unavailable === !product.available &&
      price === product.price &&
      cost === product.cost &&
      shipping === product.shipping &&
      commissions === product.commissions,
  );
  const canSave = fieldsReady && !unchanged;

  function savedMediaNote(kind: "fotos" | "video", reduced: boolean) {
    const ready =
      kind === "fotos" && reduced
        ? "Alguna foto pesaba demasiado y quedó reducida."
        : kind === "fotos"
          ? "Fotos listas."
          : "Video listo.";
    if (!published) {
      return canManageCommerce
        ? `${ready} Pulsa Guardar producto. Sigue oculto hasta que lo publiques. El precio no cambia.`
        : `${ready} Pulsa Guardar producto. Sigue oculto: la publicación la cambia el propietario. El precio no cambia.`;
    }
    if (unavailable) {
      return `${ready} Pulsa Guardar producto. Sigue publicado, pero no se puede pedir. El precio y la publicación no cambian.`;
    }
    return `${ready} Pulsa Guardar producto. El producto ya está publicado: estas fotos se verán en la tienda. El precio y la publicación no cambian.`;
  }
  function mediaPickNote(noun: "fotos" | "video") {
    const lead = noun === "fotos" ? "Elegirlas no las publica solas." : "Elegirlo no lo publica solo.";
    if (!published) {
      return canManageCommerce
        ? `${lead} El precio no cambia.`
        : `${lead} El precio no cambia. La publicación la cambia el propietario.`;
    }
    return `${lead} No cambia el precio ni la publicación.`;
  }
  function mediaRemovalNote(noun: "foto" | "video") {
    const lead = noun === "foto" ? "Quitar esta foto al guardar." : "Quitar el video al guardar.";
    if (!published) {
      return canManageCommerce
        ? `${lead} El precio no cambia.`
        : `${lead} El precio no cambia. La publicación la cambia el propietario.`;
    }
    return `${lead} No cambia el precio ni la publicación.`;
  }
  const photoCount = savedImages.length + pendingPreviews.length;
  const shownPhoto = photoCount === 0 ? 0 : ((photoIndex % photoCount) + photoCount) % photoCount;

  return (
    <div ref={panelRef} className="scroll-mt-16">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            <Link href="/panel/catalogo" title="Volver no cobra ni cambia el precio ni la publicación." className="font-semibold text-accent-strong">
              Catálogo
            </Link>
            <span aria-hidden="true"> / </span>
            {product ? product.sku : "Nuevo"}
          </p>
          <h1 id="ficha-titulo" className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">
            {product ? product.title : "Nuevo producto"}
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            Margen estimado de la ficha · no es dinero cobrado de pedidos
          </p>
        </div>
        <Link
          href="/panel/catalogo"
          title="Volver no cobra ni cambia el precio ni la publicación."
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold hover:bg-subtle"
        >
          Volver al catálogo
        </Link>
      </div>

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_14rem]">
        <form action={formAction} className="elevate-1 order-2 overflow-hidden rounded-[14px] border border-line bg-card xl:order-1">
          {product ? <input type="hidden" name="id" value={product.id} /> : null}
          {product ? <input type="hidden" name="previousSku" value={product.sku} /> : null}
          <div className="border-b border-line px-3 py-2">
            <div className="flex flex-wrap items-center gap-3">
              <ProductMarks product={{ published, available: !unavailable }} />
            </div>
            {product ? <CampaignLink product={product} compact /> : null}
          </div>
          <div className="grid gap-3 px-3 py-2 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)] xl:items-start">
            <div className="rounded-[14px] border border-dashed border-line bg-subtle p-3">
              <p className="text-sm font-semibold">Fotos y video</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Hasta {MAX_PRODUCT_IMAGES} fotos (1,5 MB) y 1 video MP4 (8 MB). Completas, sin recorte. Con derechos de
                uso. No viene de Dropi.
              </p>
              {savedImages.length === 0 && pendingPreviews.length === 0 ? (
                <p className="mt-2 text-sm leading-5">
                  {published && !unavailable
                    ? "Todavía no hay fotos. Agrega una o varias para verlas aquí y en la tienda. El producto ya está publicado. Guardarlas no cambia el precio ni la publicación."
                    : published
                      ? "Todavía no hay fotos. Agrega una o varias para verlas aquí. En la tienda no se puede pedir mientras esté no disponible. Guardarlas no cambia el precio ni la publicación."
                      : canManageCommerce
                        ? "Todavía no hay fotos. Agrega una o varias para verlas aquí. Siguen ocultas hasta que publiques. El precio no cambia."
                        : "Todavía no hay fotos. Agrega una o varias para verlas aquí. Siguen ocultas: la publicación la cambia el propietario. El precio no cambia."}
                </p>
              ) : (
                <div className="mt-3">
                  <PhotoCarousel
                    slides={[
                      ...savedImages.map((asset) => ({
                        key: asset.id,
                        src: `/panel/imagen/${product?.sku}?m=${asset.id}`,
                        alt: "",
                      })),
                      ...pendingPreviews.map((url) => ({
                        key: url,
                        src: url,
                        alt: "Vista previa de una foto nueva",
                      })),
                    ]}
                    label="Fotos del producto"
                    photoTitle="Verla no cambia el precio ni la publicación."
                    moveTitle="Pasarla no cambia el precio ni la publicación."
                    brokenNote="El precio de la ficha no cambia."
                    frameClassName="h-[min(28rem,56vh)] w-full"
                    singleClassName="max-h-[28rem] w-full object-contain"
                    roundedClassName="rounded-[10px]"
                    index={shownPhoto}
                    onIndexChange={setPhotoIndex}
                  />
                  {savedImages.map((asset) => (
                    <label
                      key={asset.id}
                      className={
                        savedImages[shownPhoto]?.id === asset.id
                          ? "mt-2 flex items-start gap-3 text-sm leading-5"
                          : "hidden"
                      }
                    >
                      <input
                        type="checkbox"
                        name="removeAsset"
                        title="Marcarla no quita la foto hasta guardar. No es el precio ni la publicación."
                        value={asset.id}
                        checked={removed.includes(asset.id)}
                        className="mt-1 h-4 w-4"
                        onChange={(event) =>
                          setRemoved((current) =>
                            event.target.checked ? [...current, asset.id] : current.filter((id) => id !== asset.id),
                          )
                        }
                      />
                      <span>{mediaRemovalNote("foto")}</span>
                    </label>
                  ))}
                </div>
              )}
              <input
                ref={imagePickerRef}
                type="file"
                title="Elegirlas no las publica solas. El precio no cambia."
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                multiple
                className="sr-only"
                onChange={onPickImages}
              />
              <input ref={imagesRef} name="images" type="file" multiple className="hidden" tabIndex={-1} aria-hidden="true" />
              <button
                type="button"
                title="Elegirlas no las publica solas. El precio no cambia."
                className="mt-3 inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-card px-4 text-sm font-semibold hover:bg-canvas"
                onClick={() => imagePickerRef.current?.click()}
              >
                Agregar fotos
              </button>
              <p className="mt-1 text-xs leading-5 text-muted">{mediaPickNote("fotos")}</p>
              <div className="mt-3 border-t border-line pt-2.5">
                <p className="text-sm font-semibold">Video</p>
                {videoPreview ? (
                  <video src={videoPreview} controls title="Verlo no cambia el precio ni la publicación." className="mt-3 max-h-[32rem] w-full rounded-[10px] bg-card" />
                ) : savedVideo && !clearVideo ? (
                  <video src={`/panel/video/${product?.sku}`} controls title="Verlo no cambia el precio ni la publicación." className="mt-3 max-h-[32rem] w-full rounded-[10px] bg-card" />
                ) : (
                  <p className="mt-2 text-sm leading-5">
                    Todavía no hay video. Agregarlo no cambia el precio ni la publicación.
                  </p>
                )}
                <input ref={videoPickerRef} type="file" accept="video/mp4,.mp4" title="Elegirlo no lo publica solo. El precio no cambia." className="sr-only" onChange={onPickVideo} />
                <input ref={videoRef} name="video" type="file" accept="video/mp4,.mp4" className="hidden" tabIndex={-1} aria-hidden="true" />
                <button
                  type="button"
                  title="Elegirlo no lo publica solo. El precio no cambia."
                  className="mt-3 inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-card px-4 text-sm font-semibold hover:bg-canvas"
                  onClick={() => videoPickerRef.current?.click()}
                >
                  {savedVideo || videoPreview ? "Cambiar video" : "Agregar video"}
                </button>
                <p className="mt-1 text-xs leading-5 text-muted">{mediaPickNote("video")}</p>
                {savedVideo ? (
                  <label className="mt-2 flex items-start gap-3 text-sm leading-5">
                    <input
                      type="checkbox"
                      name="clearVideo"
                      title="Marcarla no quita el video hasta guardar. No es el precio ni la publicación."
                      checked={clearVideo}
                      className="mt-1 h-4 w-4"
                      onChange={(event) => setClearVideo(event.target.checked)}
                    />
                    <span>{mediaRemovalNote("video")}</span>
                  </label>
                ) : null}
              </div>
              {imageNote ? <p className="mt-3 text-sm text-ink">{imageNote}</p> : null}
              {imageError ? (
                <p role="alert" className="mt-2 text-sm font-medium text-danger">
                  {imageError}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
            <div className="rounded-[14px] border border-line bg-canvas p-3">
              <p className="text-sm font-semibold">Cifras y estado</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {canManageCommerce
                  ? "El precio, el costo y el margen son de esta ficha. Publicar y poder pedirlo son dos decisiones distintas."
                  : "Precio, costo, envío y comisiones los guarda el propietario. Puedes cambiar la disponibilidad."}
              </p>
              <FichaDriftNotice
                lines={storedLines}
                amounts={{
                  price: parsePesos(amounts.price),
                  cost: parsePesos(amounts.cost),
                  shipping: parsePesos(amounts.shipping),
                  commissions: parsePesos(amounts.commissions),
                }}
              />
              {product ? (
                <SkuCostApply
                  product={product}
                  lines={storedLines}
                  amounts={amounts}
                  costPreview={costPreview}
                  canManageCommerce={canManageCommerce}
                />
              ) : null}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <MoneyField label="Precio de venta" name="price" title="Es el precio de la ficha. No es dinero cobrado." value={amounts.price} readOnly={!canManageCommerce} onValue={(price) => setAmounts((current) => ({ ...current, price }))} />
                <MoneyField label="Costo del producto" name="cost" title="Es el costo de la ficha. No es dinero cobrado." value={amounts.cost} readOnly={!canManageCommerce} onValue={(cost) => setAmounts((current) => ({ ...current, cost }))} />
                <MoneyField label="Envío estimado" name="shipping" title="Es el envío estimado de la ficha. No es dinero cobrado." value={amounts.shipping} readOnly={!canManageCommerce} onValue={(shipping) => setAmounts((current) => ({ ...current, shipping }))} />
                <MoneyField label="Comisiones estimadas" name="commissions" title="Son las comisiones estimadas de la ficha. No es dinero cobrado." value={amounts.commissions} readOnly={!canManageCommerce} onValue={(commissions) => setAmounts((current) => ({ ...current, commissions }))} />
              </div>
              <div className="mt-3 rounded-[10px] bg-card px-3 py-2 text-sm leading-5">
                <p className="font-semibold">Margen estimado</p>
                <p className={cx("mt-1 text-base font-bold tabular-nums", margin !== null && margin < 0 ? "text-warning" : "text-accent-strong")}>
                  {margin === null ? "—" : formatCop(margin)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {margin === null
                    ? "Se calcula con precio de venta, costo, envío y comisiones."
                    : "Precio de venta menos costo, envío y comisiones. No es dinero cobrado."}
                </p>
                {margin !== null && margin < 0 ? (
                  <p className="mt-1 text-warning">
                    {canManageCommerce
                      ? "El margen estimado es negativo. Revísalo antes de publicarlo."
                      : "El margen estimado es negativo. El precio y la publicación los guarda el propietario."}
                  </p>
                ) : null}
              </div>
              <fieldset className="mt-3 space-y-2">
                <legend className="text-sm font-semibold">Publicación y disponibilidad</legend>
                {canManageCommerce ? (
                  <label className="flex items-start gap-3 text-sm leading-5">
                    <input
                      type="checkbox"
                      name="published"
                      title="Marcarla no cobra. El precio de la ficha no cambia."
                      checked={published}
                      className="mt-1 h-4 w-4"
                      onChange={(event) => setPublished(event.target.checked)}
                    />
                    <span>
                      <b className="font-semibold">Publicación.</b> Publicar en la tienda. Si queda sin marcar, el producto se guarda oculto.
                    </span>
                  </label>
                ) : (
                  <p className="text-sm leading-5">
                    {published ? <input type="hidden" name="published" value="on" /> : null}
                    <b className="font-semibold">Publicación.</b>{" "}
                    {published ? "Publicado en la tienda." : "Sin publicar."} Lo cambia el propietario.
                  </p>
                )}
                <label className="flex items-start gap-3 text-sm leading-5">
                  <input
                    type="checkbox"
                    name="unavailable"
                    title="Marcarla no cambia el precio ni la publicación. No cobra."
                    checked={unavailable}
                    className="mt-1 h-4 w-4"
                    onChange={(event) => setUnavailable(event.target.checked)}
                  />
                  <span>
                    <b className="font-semibold">Disponibilidad.</b> Marcar como no disponible. Sigue en el catálogo, pero no se puede pedir. No cambia el precio ni la publicación.
                    {product && relatedOrderCount > 0
                      ? ` Este producto tiene ${relatedOrderCount === 1 ? "1 pedido" : `${relatedOrderCount} pedidos`}: no se puede eliminar.`
                      : ""}
                  </span>
                </label>
              </fieldset>
            </div>
            </div>
          </div>

          <div className="grid gap-3 px-3 pb-3">
            <div className="rounded-[14px] border border-line p-3">
              <p className="text-sm font-semibold">Identidad</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="lg:col-span-2">
            <Field label="Nombre" htmlFor="title" hint="Lo ve el comprador en la ficha. No es el precio ni la publicación.">
              <input
                id="title"
                title="Escribirlo no es el precio ni la publicación."
                name="title"
                required
                value={title}
                maxLength={120}
                className={inputClass}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
              <Field label="SKU interno" htmlFor="sku" hint={canManageCommerce ? undefined : "Lo cambia el propietario."}>
                <input
                  id="sku"
                  title="Escribirlo no es el precio ni la publicación."
                  name="sku"
                  required
                  readOnly={!canManageCommerce}
                  value={sku}
                  autoCapitalize="characters"
                  className={canManageCommerce ? inputClass : `${inputClass} bg-subtle`}
                  onChange={(event) => setSku(event.target.value)}
                />
              </Field>
              <Field label="Referencia del proveedor" htmlFor="externalRef" hint="Opcional. Dropi no está conectado. No es el precio ni la publicación.">
                <input
                  id="externalRef"
                  title="Escribirlo no es el precio ni la publicación."
                  name="externalRef"
                  value={externalRef}
                  className={inputClass}
                  onChange={(event) => setExternalRef(event.target.value)}
                />
              </Field>
            </div>
            <div className="lg:col-span-2">
            <Field label="Categoría" htmlFor="category" hint="Opcional. Agrupa el producto en la tienda. No viene de Dropi. No es el precio ni la publicación.">
              <input
                id="category"
                title="Escribirlo no es el precio ni la publicación."
                name="category"
                value={category}
                maxLength={40}
                className={inputClass}
                onChange={(event) => setCategory(event.target.value)}
              />
            </Field>
            </div>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <Field label="Descripción" htmlFor="description" hint="La ve el comprador en la ficha. No es el precio ni la publicación.">
                <textarea
                  id="description"
                  title="Escribirla no es el precio ni la publicación."
                  name="description"
                  rows={6}
                  value={description}
                  maxLength={2000}
                  className={`${inputClass} h-auto py-2`}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
              <Field
                label="Características y beneficios"
                htmlFor="highlights"
                hint="Opcional. Una idea por línea. El comprador las ve en la página del producto. No vienen de Dropi. No es el precio ni la publicación."
              >
                <textarea
                  id="highlights"
                  title="Escribirlas no es el precio ni la publicación."
                  name="highlights"
                  rows={6}
                  value={highlights}
                  maxLength={2000}
                  className={`${inputClass} h-auto py-2`}
                  onChange={(event) => setHighlights(event.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Respuestas para el comprador"
              htmlFor="answers"
              hint="Opcional. Escribe solo lo que se puede afirmar: medidas, material, qué incluye y qué no. El comprador lo ve en la ficha. El chat que responda con estos datos todavía no está conectado. No escribas aquí el costo ni las comisiones. No es el precio ni la publicación."
            >
              <textarea
                id="answers"
                title="Escribirlas no es el precio ni la publicación."
                name="answers"
                rows={3}
                value={answers}
                maxLength={2000}
                className={`${inputClass} h-auto py-2`}
                onChange={(event) => setAnswers(event.target.value)}
              />
            </Field>

            <div className="rounded-[14px] border border-line p-3">
              <Field
                label="Tallas o tamaños"
                htmlFor="variants"
                hint="Opcional. Una por línea, hasta 12. Por ejemplo S, M, 38 o 50 cm. Si escribes alguna, elige el criterio: el comprador tiene que escoger una antes de pedir. La talla o el tamaño no cambian el precio ni la publicación."
              >
                <textarea
                  id="variants"
                  title="Escribirlas no cambia el precio ni la publicación."
                  name="variants"
                  rows={3}
                  value={variantsText}
                  className={`${inputClass} h-auto py-2`}
                  onChange={(event) => setVariantsText(event.target.value)}
                />
              </Field>
              {variantsText.trim() ? (
                <fieldset className="mt-3">
                  <legend className="text-sm font-semibold">Qué va a elegir el comprador</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-3 rounded-[10px] border border-line bg-card px-3 py-2 text-sm">
                      <input type="radio" name="sizeKind" value="talla" title="Elegirlas no es el precio ni la publicación." checked={sizeKind === "talla"} onChange={() => setSizeKind("talla")} />
                      Tallas, como S, M o 38
                    </label>
                    <label className="flex items-center gap-3 rounded-[10px] border border-line bg-card px-3 py-2 text-sm">
                      <input type="radio" name="sizeKind" value="tamano" title="Elegirlos no es el precio ni la publicación." checked={sizeKind === "tamano"} onChange={() => setSizeKind("tamano")} />
                      Tamaños, como 50 cm o 1.5 m
                    </label>
                  </div>
                </fieldset>
              ) : null}
            </div>

            {error ? (
              <p role="alert" className="rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}

            {product && product.history.length > 0 ? (
              <section aria-labelledby="historial-titulo" className="rounded-[14px] border border-line p-3">
                <h3 id="historial-titulo" className="text-sm font-semibold">
                  Historial de la ficha
                </h3>
                <p className="mt-0.5 text-xs leading-5 text-muted">
                  {canManageCommerce
                    ? "Cada guardado deja el precio y la publicación de ese momento. El precio y el margen de la tabla son de la ficha. No son un pedido ni dinero cobrado."
                    : "Un guardado de textos también queda aquí. El precio y la publicación los guarda el propietario. El precio y el margen de la tabla son de la ficha, no de un pedido."}
                </p>
                <div className="mt-2 hidden grid-cols-[7rem_minmax(0,1.4fr)_6.5rem_6.5rem_6.5rem] gap-3 border-b border-line pb-2 text-[11px] font-semibold tracking-[0.04em] text-muted uppercase md:grid">
                  <span>Fecha</span>
                  <span>Cambio</span>
                  <span className="text-right">Precio</span>
                  <span className="text-right">Costo</span>
                  <span className="text-right">Margen est.</span>
                </div>
                <ol>
                  {[...product.history].reverse().map((entry) => {
                    const entryMargin = entry.price - entry.cost - entry.shipping - entry.commissions;
                    return (
                      <li key={entry.id} className="grid gap-1 border-t border-line py-2 text-sm md:grid-cols-[7rem_minmax(0,1.4fr)_6.5rem_6.5rem_6.5rem] md:items-center md:gap-3">
                        <p className="text-muted">
                          {formatDay(entry.changedAt.slice(0, 10))}
                          <span className="md:hidden"> · {entry.actorName}</span>
                        </p>
                        <p>
                          <span className="font-medium">{entry.summary}</span>
                          <span className="mt-0.5 hidden text-xs text-muted md:block">{entry.actorName}</span>
                        </p>
                        <p className="tabular-nums md:text-right">
                          <span className="mr-2 text-[10px] font-bold tracking-[0.06em] text-muted uppercase md:hidden">Precio</span>
                          {formatCop(entry.price)}
                        </p>
                        <p className="tabular-nums text-muted md:text-right">
                          <span className="mr-2 text-[10px] font-bold tracking-[0.06em] uppercase md:hidden">Costo</span>
                          {formatCop(entry.cost)}
                        </p>
                        <p className={cx("font-semibold tabular-nums md:text-right", entryMargin < 0 ? "text-warning" : "text-accent-strong")}>
                          <span className="mr-2 text-[10px] font-bold tracking-[0.06em] text-muted uppercase md:hidden">Margen est.</span>
                          {formatCop(entryMargin)}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : null}
          </div>

          <div className="border-t border-line px-3 py-2">
            {canSave && margin !== null ? (
              <p className="mb-2 text-sm leading-5 text-ink">
                {canManageCommerce
                  ? `Si guardas, el margen estimado de este producto queda en ${formatCop(margin)}. No es dinero cobrado. Los pedidos ya anotados siguen con sus cifras.`
                  : `Si guardas, el margen estimado sigue en ${formatCop(margin)}. El precio lo guarda el propietario. No es dinero cobrado.`}
              </p>
            ) : null}
            {product ? (
              <p className="mb-2 text-xs leading-5 text-muted">
                {canManageCommerce
                  ? "Precio, costo, envío y comisiones entran al margen estimado. Sin un cambio válido el botón queda bloqueado."
                  : "Puedes guardar textos, fotos y disponibilidad. Precio, publicación y SKU quedan como están."}
              </p>
            ) : (
              <p className="mb-2 text-xs leading-5 text-muted">
                Precio, costo, envío y comisiones entran al margen estimado. Completa nombre, SKU y las cifras para
                guardar.
              </p>
            )}
            <button
              type="submit"
              title="Guardarlo no cobra. Los pedidos ya anotados siguen con sus cifras."
              disabled={pending || !canSave}
              className={`inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft sm:w-auto sm:min-w-56 ${
                pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-55"
              }`}
            >
              {pending ? "Guardando…" : "Guardar producto"}
            </button>
          </div>
        </form>

        <aside className="elevate-1 order-1 rounded-[14px] border border-line bg-card px-3 py-2 xl:sticky xl:top-[3.75rem] xl:order-2">
          <h2 className="text-sm font-semibold">Resumen de la ficha</h2>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <p className="text-xs text-muted">Margen</p>
            <p
              className={cx(
                "text-lg font-extrabold tabular-nums",
                margin !== null && margin < 0 ? "text-warning" : "text-accent-strong",
              )}
            >
              {margin === null ? "—" : formatCop(margin)}
            </p>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-muted">Precio − costo − envío − comisiones. Es el margen de la ficha, no dinero cobrado.</p>
          <dl className="mt-2 space-y-1.5 border-t border-line pt-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Precio</dt>
              <dd className="tabular-nums">{price === null ? "—" : formatCop(price)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Costo</dt>
              <dd className="tabular-nums">{cost === null ? "—" : formatCop(cost)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Envío</dt>
              <dd className="tabular-nums">{shipping === null ? "—" : formatCop(shipping)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Comisiones</dt>
              <dd className="tabular-nums">{commissions === null ? "—" : formatCop(commissions)}</dd>
            </div>
          </dl>
          <ul className="mt-2 space-y-2 border-t border-line pt-2 text-xs leading-5">
            <li>
              <span className="font-semibold text-sm">{published ? "Publicado" : "Sin publicar"}</span>
              <span className="mt-0.5 block text-muted">
                {published ? "Se ve si está disponible." : "Oculto en la tienda."}
              </span>
            </li>
            <li>
              <span className="font-semibold text-sm">{unavailable ? "No disponible" : "Disponible"}</span>
              <span className="mt-0.5 block text-muted">
                {unavailable ? "Se abre, pero no se pide." : "Se puede agregar al carrito."}
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs leading-5 text-muted">Dropi no está conectado. Las fotos se suben aquí. Subirlas no cobra ni cambia el precio ni la publicación.</p>
        </aside>
      </div>
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
      {hint ? <p className="mt-1 text-xs leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}

function MoneyField({
  label,
  name,
  value,
  onValue,
  readOnly = false,
  title,
}: {
  label: string;
  name: string;
  value: string;
  onValue: (value: string) => void;
  readOnly?: boolean;
  title: string;
}) {
  return (
    <Field label={label} htmlFor={name} hint={readOnly ? "Lo guarda el propietario." : "Pesos, sin centavos."}>
      <input
        id={name}
        name={name}
        title={title}
        inputMode="numeric"
        required
        readOnly={readOnly}
        value={value}
        onChange={(event) => onValue(event.target.value)}
        className={readOnly ? `${inputClass} bg-subtle` : inputClass}
      />
    </Field>
  );
}

const inputClass =
  "h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-sm text-ink focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none";

export function ProductDangerZone({
  product,
  relatedOrderCount,
  canManageCommerce = false,
}: {
  product: CatalogProduct;
  relatedOrderCount: number;
  canManageCommerce?: boolean;
}) {
  const canDelete = relatedOrderCount === 0;
  const [deleteState, deleteAction, deletePending] = useActionState(deleteProductAction, lifecycleInitial);
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(
    deactivateProductAction,
    lifecycleInitial,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2" aria-labelledby="peligro-titulo">
      <h2 id="peligro-titulo" className="text-sm font-semibold">
        Eliminar o desactivar
      </h2>
      {canDelete && canManageCommerce ? (
        <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted">
          No hay pedidos con este SKU. Puedes eliminarlo del catálogo. Esta acción no se puede deshacer. No cobra ni confirma un pedido.
        </p>
      ) : canDelete ? (
        <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted">
          No hay pedidos con este SKU. Solo el propietario puede eliminarlo. Puedes marcarlo como no disponible. No cobra ni confirma un pedido.
        </p>
      ) : (
        <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted">
          Hay {relatedOrderCount === 1 ? "1 pedido" : `${relatedOrderCount} pedidos`} con este producto. No se puede
          eliminar; solo puedes marcarlo como no disponible para que no se pida. No cobra ni confirma un pedido.
        </p>
      )}

      {deleteState.error || deactivateState.error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          {deleteState.error ?? deactivateState.error}
        </p>
      ) : null}
      {deactivateState.message ? (
        <p role="status" className="mt-2 text-sm font-semibold text-accent-strong">
          {deactivateState.message}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {canDelete && canManageCommerce ? (
          confirmDelete ? (
            <form action={deleteAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={product.id} />
              <p className="text-sm font-semibold text-danger">¿Eliminar {product.title}?</p>
              <button
                type="submit"
                title="Eliminarlo quita la ficha. No cobra."
                disabled={deletePending}
                className={`inline-flex h-10 items-center justify-center rounded-[10px] bg-danger px-3 text-sm font-semibold text-on-dark ${
                  deletePending ? "cursor-wait opacity-70" : ""
                }`}
              >
                {deletePending ? "Eliminando…" : "Sí, eliminar"}
              </button>
              <button
                type="button"
                title="Cancelar no elimina el producto ni cobra."
                className="inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold"
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </button>
            </form>
          ) : (
            <button
              type="button"
              title="Todavía no elimina. No cobra."
              className="inline-flex h-10 items-center justify-center rounded-[10px] border border-danger bg-card px-3 text-sm font-semibold text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              Eliminar producto
            </button>
          )
        ) : product.available ? (
          <>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-muted">
              Marcarlo como no disponible no cambia el precio ni la publicación. No cobra.
              {product.published ? " Sigue publicado, pero no se puede pedir." : " Sigue sin publicar."}
            </p>
            <form action={deactivateAction}>
            <input type="hidden" name="id" value={product.id} />
            <button
              type="submit"
              title="No cambia el precio ni la publicación. No cobra."
              disabled={deactivatePending}
              className={`inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold ${
                deactivatePending ? "cursor-wait opacity-70" : ""
              }`}
            >
              {deactivatePending ? "Guardando…" : "Marcar como no disponible"}
            </button>
          </form>
          </>
        ) : (
          <p className="text-sm font-semibold text-muted">Ya está marcado como no disponible. No cambia el precio ni la publicación. No cobra.</p>
        )}
      </div>
    </section>
  );
}
