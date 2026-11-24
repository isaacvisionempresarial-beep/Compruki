"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicProduct } from "@/server/catalog-store";
import { PhotoCarousel } from "@/components/photo-carousel";
import { CatalogPhoto } from "@/components/store/product-thumb";
import { formatCop } from "@/lib/format";
import { cx } from "@/lib/cx";
import { storePublicTagline, type StoreIdentity } from "@/lib/store-identity";
import { whatsAppHref } from "@/lib/store-order";

export function StoreHome({
  products,
  identity,
}: {
  products: PublicProduct[];
  identity: StoreIdentity;
}) {
  const tagline = storePublicTagline(identity);
  const contactHref = identity.whatsapp
    ? whatsAppHref(identity.whatsapp, `Hola. Escribo por ${identity.name}.`)
    : null;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("todas");
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const product of products) {
      const label = product.category.trim();
      if (!label) continue;
      const key = label.toLocaleLowerCase("es");
      if (!seen.has(key)) seen.set(key, label);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [products]);
  const hasUncategorized = products.some((product) => !product.category.trim());
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    return products.filter((product) => {
      const key = product.category.trim().toLocaleLowerCase("es");
      if (category === "sin" && key) return false;
      if (category !== "todas" && category !== "sin" && key !== category) return false;
      if (!needle) return true;
      const sizes = product.variants.join(" ");
      const sizeWord = product.sizeKind === "tamano" ? "tamaño tamaños" : product.sizeKind === "talla" ? "talla tallas" : "";
      return (
        key.includes(needle) ||
        product.title.toLocaleLowerCase("es").includes(needle) ||
        product.sku.toLocaleLowerCase("es").includes(needle) ||
        product.highlights.toLocaleLowerCase("es").includes(needle) ||
        product.answers.toLocaleLowerCase("es").includes(needle) ||
        sizes.toLocaleLowerCase("es").includes(needle) ||
        sizeWord.includes(needle)
      );
    });
  }, [products, query, category]);
  const heroProduct = products.find((product) => product.hasImage) ?? products[0] ?? null;

  return (
    <div className="store-home">
      <section
        className="store-hero-bleed relative -mx-4 overflow-hidden border-b border-line/70 px-4 pt-5 pb-8 sm:pt-7 sm:pb-10"
        aria-labelledby="tienda-marca"
      >
        <div className="store-hero-glow" aria-hidden="true" />
        <div className="relative grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] sm:items-stretch sm:gap-8 lg:gap-12">
          <div className="flex min-w-0 flex-col justify-center">
            <p
              id="tienda-marca"
              className="store-display store-rise text-[13px] font-bold tracking-[0.16em] text-accent-strong uppercase"
              style={{ animationDelay: "40ms" }}
            >
              COMPRUKI
            </p>
            <p className="store-rise mt-2 text-sm font-semibold text-ink" style={{ animationDelay: "70ms" }}>
              {identity.name}
            </p>
            <h1
              className="store-display store-rise mt-3 max-w-[12ch] text-[2.6rem] leading-[0.98] font-extrabold tracking-[-0.045em] text-ink sm:text-[3.35rem]"
              style={{ animationDelay: "110ms" }}
            >
              Pagas al recibir
            </h1>
            <p className="store-rise mt-4 max-w-md text-[15px] leading-6 text-muted" style={{ animationDelay: "180ms" }}>
              {tagline}
            </p>
            <div className="store-rise mt-6 flex flex-wrap items-center gap-2.5" style={{ animationDelay: "250ms" }}>
              <a
                href="#catalogo-publicado"
                title="Verlos no cambia los precios publicados ni crea un pedido."
                className="inline-flex h-11 items-center rounded-[12px] bg-primary px-4 text-sm font-semibold text-on-dark transition-[background-color,transform] hover:bg-primary-soft active:translate-y-px"
              >
                Ver productos
              </a>
              <Link
                href="/tienda/consultar"
                title="Consultar no cobra ni cambia el total guardado."
                className="inline-flex h-11 items-center rounded-[12px] border border-line bg-card/85 px-4 text-sm font-semibold text-ink backdrop-blur transition-colors hover:bg-card"
              >
                Consultar pedido
              </Link>
              {contactHref ? (
                <a
                  href={contactHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abre WhatsApp a mano. Compruki no envía."
                  className="inline-flex h-11 items-center rounded-[12px] border border-line bg-card/85 px-4 text-sm font-semibold text-ink backdrop-blur transition-colors hover:bg-card"
                >
                  WhatsApp
                </a>
              ) : null}
            </div>
          </div>

          <div
            className="store-hero-stage store-rise relative min-h-[260px] sm:min-h-full sm:min-h-[320px]"
            style={{ animationDelay: "160ms" }}
          >
            {heroProduct?.hasImage ? (
              <Link
                href={`/tienda/producto/${heroProduct.sku}`}
                title="Abrirla no cambia el precio publicado ni crea un pedido."
                className="store-hero-photo group absolute inset-0 overflow-hidden rounded-[8px] sm:rounded-[14px] outline-none"
                aria-label={`Ver ${heroProduct.title}`}
              >
                <div className="store-hero-photo-live h-full w-full">
                  <CatalogPhoto
                    sku={heroProduct.sku}
                    alt={heroProduct.title}
                    frameClassName="h-full min-h-[260px] sm:min-h-[320px]"
                    imgClassName="h-full min-h-[260px] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] sm:min-h-[320px]"
                  />
                </div>
              </Link>
            ) : (
              <div className="store-hero-photo absolute inset-0 grid place-items-center rounded-[8px] px-6 text-center sm:rounded-[14px]">
                <div>
                  <p className="store-display text-lg font-extrabold tracking-tight text-ink">Tu catálogo aquí</p>
                  <p className="mt-1 text-sm leading-5 text-muted">Cuando publiques productos, esta portada cobra vida.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="store-rise mt-2 border-y border-line/80 py-4" aria-labelledby="como-pedir" style={{ animationDelay: "280ms" }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.1em] text-muted uppercase">En 3 pasos</p>
            <h2 id="como-pedir" className="store-display mt-1 text-lg font-bold tracking-tight">
              Pedir es simple
            </h2>
          </div>
          <Link
            href="/tienda/condiciones"
            title="Leerlas no registra pedido ni cobra."
            className="text-sm font-semibold text-accent-strong hover:underline"
          >
            Condiciones
          </Link>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { step: "1", title: "Elige", text: "Entra a la ficha, elige talla o tamaño y agrega al carrito." },
            { step: "2", title: "Confirma", text: "Dejas tus datos. El pedido queda pendiente. Nadie cobra aquí." },
            { step: "3", title: "Recibe", text: "Pagas al recibir. Consulta con el número y tu celular." },
          ].map((item, index) => (
            <li
              key={item.step}
              className="store-rise flex gap-3"
              style={{ animationDelay: `${320 + index * 70}ms` }}
            >
              <span className="store-display grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-accent-tint text-sm font-extrabold text-accent-strong">
                {item.step}
              </span>
              <span>
                <span className="block text-sm font-bold text-ink">{item.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">{item.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="store-rise mt-6 min-w-0" aria-labelledby="catalogo-publicado" style={{ animationDelay: "420ms" }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.1em] text-muted uppercase">Catálogo</p>
            <h2 id="catalogo-publicado" className="store-display mt-1 text-[1.35rem] font-bold tracking-tight scroll-mt-24">
              Productos
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-5 text-muted">
              Solo lo publicado. Ver una ficha no crea pedido ni cambia el precio.
            </p>
          </div>
          <p className="text-sm font-semibold text-muted tabular-nums">
            {visible.length} de {products.length}
          </p>
        </div>

        <div className="store-toolbar mt-4 rounded-[16px] border border-line bg-card/90 p-3 backdrop-blur-sm">
          <label className="block">
            <span className="sr-only">Buscar producto</span>
            <input
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o SKU"
              title="Buscar no cambia los precios publicados ni crea un pedido."
              className="h-11 w-full rounded-[12px] border border-line bg-canvas px-3.5 text-sm transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.14)] focus:outline-none"
            />
          </label>
          {categories.length > 0 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="radiogroup" aria-label="Filtrar por categoría">
              <CategoryChip label="Todas" count={products.length} selected={category === "todas"} onSelect={() => setCategory("todas")} />
              {categories.map(([key, label]) => (
                <CategoryChip
                  key={key}
                  label={label}
                  count={products.filter((product) => product.category.trim().toLocaleLowerCase("es") === key).length}
                  selected={category === key}
                  onSelect={() => setCategory(key)}
                />
              ))}
              {hasUncategorized ? (
                <CategoryChip
                  label="Sin categoría"
                  count={products.filter((product) => !product.category.trim()).length}
                  selected={category === "sin"}
                  onSelect={() => setCategory("sin")}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <div className="mt-4 rounded-[16px] border border-dashed border-line bg-card/70 px-4 py-8 text-center">
            <p className="store-display text-base font-bold tracking-tight">Nada por aquí</p>
            <p className="mt-1 text-sm leading-5 text-muted">{storeEmptyMessage(products.length, category, query)}</p>
            {products.length > 0 && (category !== "todas" || query.trim()) ? (
              <button
                type="button"
                title="Verlos no cambia los precios publicados ni crea un pedido."
                className="mt-4 inline-flex h-10 items-center justify-center rounded-[12px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft"
                onClick={() => {
                  setCategory("todas");
                  setQuery("");
                }}
              >
                Ver todos los productos
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {visible.map((product, index) => (
              <li
                key={product.id}
                className="store-card group overflow-hidden rounded-[18px] border border-line bg-card transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-accent/35 hover:shadow-[0_18px_36px_-20px_rgb(23_26_40/0.35)]"
                style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
              >
                {product.images.length > 1 ? (
                  <PhotoCarousel
                    slides={product.images.map((image, imageIndex) => ({
                      key: image.id,
                      src: `/tienda/imagen/${product.sku}?m=${image.id}`,
                      alt: imageIndex === 0 ? product.title : "",
                    }))}
                    label={`Fotos de ${product.title}`}
                    frameClassName="h-40 w-full bg-subtle sm:h-44"
                    roundedClassName="rounded-none"
                    compact
                    openLabel={`Ver ${product.title}`}
                    openTitle="Abrirla no cambia el precio publicado ni crea un pedido."
                    onOpen={() => router.push(`/tienda/producto/${product.sku}`)}
                  />
                ) : null}
                <Link href={`/tienda/producto/${product.sku}`} title="Abrirla no cambia el precio publicado ni crea un pedido." className="block">
                  {product.images.length <= 1 && product.hasImage ? (
                    <CatalogPhoto
                      sku={product.sku}
                      alt={product.title}
                      frameClassName="h-40 bg-subtle sm:h-44"
                      imgClassName="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] sm:h-44"
                      note=""
                    />
                  ) : null}
                  {!product.hasImage && product.images.length === 0 ? (
                    <div className="grid h-40 place-items-center bg-gradient-to-br from-subtle to-accent-tint/40 px-3 text-center sm:h-44">
                      <span>
                        <span className="store-display block text-sm font-bold text-muted">Sin foto</span>
                        <span className="mt-1 block text-[11px] leading-4 text-muted">El precio publicado no cambia.</span>
                      </span>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p
                        className={cx(
                          "inline-flex rounded-[8px] px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] uppercase",
                          product.available ? "bg-accent-tint text-accent-strong" : "bg-coral-tint text-coral-strong",
                        )}
                      >
                        {product.available ? "Disponible" : "No disponible"}
                      </p>
                      {product.category ? (
                        <span className="truncate text-[11px] font-semibold text-muted">{product.category}</span>
                      ) : null}
                    </div>
                    <h3 className="store-display line-clamp-2 text-[15px] leading-5 font-bold tracking-tight">{product.title}</h3>
                    {product.sizeKind && product.variants.length > 0 ? (
                      <p className="line-clamp-1 text-xs text-muted">
                        {product.sizeKind === "tamano" ? "Tamaños" : "Tallas"}: {product.variants.join(", ")}
                      </p>
                    ) : null}
                    <div className="mt-auto flex items-end justify-between gap-2 pt-1">
                      <div>
                        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Precio</p>
                        <p className="text-lg font-extrabold tracking-tight tabular-nums">{formatCop(product.price)}</p>
                      </div>
                      <span className="inline-flex h-9 shrink-0 items-center rounded-[10px] bg-primary px-3 text-xs font-semibold text-on-dark transition-colors group-hover:bg-primary-soft">
                        Ver
                      </span>
                    </div>
                    <p className="text-[11px] leading-4 text-muted">Pagas al recibir · Envío aparte</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function storeEmptyMessage(total: number, category: string, query: string) {
  if (total === 0) return "Todavía no hay productos publicados. No cobra. La tienda solo muestra lo que el comercio ya revisó.";
  if (query.trim()) return "Ningún producto publicado coincide con esa búsqueda. Los precios no cambian y no se crea un pedido.";
  if (category !== "todas") return "No hay productos publicados en esta categoría. Los precios no cambian.";
  return "Ningún producto publicado coincide con el filtro. Los precios no cambian.";
}

function CategoryChip({
  label,
  count,
  selected,
  onSelect,
}: {
  label: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      title="Filtrar no cambia los precios publicados ni crea un pedido."
      className={cx(
        "min-h-9 shrink-0 rounded-[11px] px-3 text-sm font-semibold transition-[background-color,color,border-color]",
        selected ? "bg-primary text-on-dark" : "border border-line bg-canvas text-muted hover:bg-subtle hover:text-ink",
      )}
      onClick={onSelect}
    >
      {label}
      <span className="ml-1 tabular-nums opacity-80">{count}</span>
    </button>
  );
}
