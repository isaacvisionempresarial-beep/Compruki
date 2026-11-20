"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicProduct } from "@/server/catalog-store";
import { PhotoCarousel } from "@/components/photo-carousel";
import { CatalogPhoto } from "@/components/store/product-thumb";
import { formatCop } from "@/lib/format";
import { cx } from "@/lib/cx";

export function StoreHome({ products }: { products: PublicProduct[] }) {
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

  return (
    <div>
      <section className="store-hero relative overflow-hidden rounded-[14px] border border-line px-3 py-2 sm:px-4">
        <p className="text-[10px] font-bold tracking-[0.08em] text-accent-strong uppercase">Tienda piloto · Colombia</p>
        <h1 className="mt-1 max-w-xl text-[24px] leading-7 font-extrabold tracking-tight">
          Pagas al recibir
        </h1>
        <p className="mt-1 max-w-xl text-sm leading-5 text-muted">
          Elige y deja el pedido. El envío se acuerda aparte. Los precios son los publicados. Nadie cobra aquí. Dropi no está conectado.
        </p>
      </section>

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_13.5rem]">
        <div className="order-2 min-w-0 xl:order-1">
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
              className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm shadow-[0_1px_0_rgb(34_38_56/0.02)] transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none"
            />
            <span className="mt-1 block text-xs leading-5 text-muted">Buscar no cambia los precios publicados ni crea un pedido.</span>
          </label>
          {categories.length > 0 ? (
            <>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Filtrar por categoría">
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
            <p className="mt-2 text-xs leading-5 text-muted">Filtrar no cambia los precios publicados ni crea un pedido.</p>
            </>
          ) : null}

          {visible.length === 0 ? (
            <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-2">
              <p className="text-sm leading-5 text-muted">{storeEmptyMessage(products.length, category, query)}</p>
              {products.length > 0 && (category !== "todas" || query.trim()) ? (
                <>
                <button
                  type="button"
                  title="Verlos no cambia los precios publicados ni crea un pedido."
                  className="mt-3 inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-canvas px-4 text-sm font-semibold"
                  onClick={() => {
                    setCategory("todas");
                    setQuery("");
                  }}
                >
                  Ver todos los productos
                </button>
                <p className="mt-2 text-xs leading-5 text-muted">Verlos no cambia los precios publicados ni crea un pedido.</p>
                </>
              ) : null}
            </div>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
              {visible.map((product, index) => (
                <li
                  key={product.id}
                  className="store-card elevate-1 group overflow-hidden rounded-[14px] border border-line bg-card transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_22px_-12px_rgb(34_38_56/0.16)]"
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
                      frameClassName="h-32 w-full bg-subtle sm:h-36"
                      roundedClassName="rounded-none"
                      compact
                      openLabel={`Ver ${product.title}`}
                      onOpen={() => router.push(`/tienda/producto/${product.sku}`)}
                    />
                  ) : null}
                  <Link href={`/tienda/producto/${product.sku}`} title="Abrirla no cambia el precio publicado ni crea un pedido." className="block">
                    {product.images.length <= 1 && product.hasImage ? (
                      <CatalogPhoto
                        sku={product.sku}
                        alt={product.title}
                        frameClassName="h-32 sm:h-36"
                        imgClassName="h-32 w-full object-contain transition-transform duration-500 group-hover:scale-[1.04] sm:h-36"
                        note="El precio publicado no cambia."
                      />
                    ) : null}
                    {!product.hasImage && product.images.length === 0 ? (
                      <div className="grid h-32 place-items-center bg-subtle px-2 text-center sm:h-36">
                        <span>
                          <span className="block text-xs font-semibold text-muted">Sin foto</span>
                          <span className="mt-1 block text-[11px] leading-4 text-muted">El precio publicado no cambia.</span>
                        </span>
                      </div>
                    ) : null}
                    <div className="p-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p
                          className={cx(
                            "inline-flex rounded-[8px] px-2 py-0.5 text-[10px] font-bold tracking-[0.04em] uppercase",
                            product.available ? "bg-accent-tint text-accent-strong" : "bg-coral-tint text-coral-strong",
                          )}
                        >
                          {product.available ? "Disponible" : "No disponible"}
                        </p>
                        {product.category ? (
                          <span className="truncate text-[10px] font-semibold tracking-[0.04em] text-muted uppercase">
                            {product.category}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-1 line-clamp-2 text-sm font-bold tracking-tight">{product.title}</h2>
                      {product.sizeKind && product.variants.length > 0 ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                          {product.sizeKind === "tamano" ? "Tamaños" : "Tallas"}: {product.variants.join(", ")}
                        </p>
                      ) : null}
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-[11px] leading-4 text-muted">Precio publicado</p>
                          <p className="text-base font-extrabold tabular-nums">{formatCop(product.price)}</p>
                        </div>
                        <span className="inline-flex h-8 shrink-0 items-center rounded-[8px] bg-primary px-2.5 text-xs font-semibold text-on-dark transition-colors group-hover:bg-primary-soft">
                          Ver
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-muted">Pagas al recibir. Envío aparte. No se cobra aquí.</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="elevate-1 order-1 rounded-[14px] border border-line bg-card px-3 py-2 xl:sticky xl:top-[3rem] xl:order-2">
          <h2 className="text-sm font-semibold">Cómo pedir</h2>
          <ul className="mt-2 space-y-2 text-xs leading-5">
            <li>
              <span className="font-semibold text-sm">Elige</span>
              <span className="mt-0.5 block text-muted">Entra a la ficha, elige talla o tamaño y agrega al carrito. No registra pedido ni cobra.</span>
            </li>
            <li>
              <span className="font-semibold text-sm">Pagas al recibir</span>
              <span className="mt-0.5 block text-muted">El pedido queda pendiente. Nadie cobra aquí.</span>
            </li>
            <li>
              <span className="font-semibold text-sm">Dropi</span>
              <span className="mt-0.5 block text-muted">No está conectado. Consulta el estado con número y celular.</span>
            </li>
          </ul>
          <Link
            href="/tienda/consultar"
            title="Consultar no cobra ni cambia el total guardado."
            className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-primary text-sm font-semibold text-on-dark transition-colors hover:bg-primary-soft"
          >
            Consultar pedido
          </Link>
          <p className="mt-2 text-xs leading-5 text-muted">Consultar no cobra ni cambia el total guardado.</p>
          <Link
            href="/tienda/condiciones"
            title="Leerlas no registra pedido ni cobra."
            className="mt-2 inline-flex w-full justify-center text-xs font-semibold text-accent-strong"
          >
            Condiciones
          </Link>
          <p className="mt-2 text-xs leading-5 text-muted">Leerlas no registra pedido ni cobra.</p>
        </aside>
      </div>
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
        "min-h-9 rounded-[10px] px-2.5 text-sm font-semibold transition-colors",
        selected ? "bg-primary text-on-dark" : "border border-line bg-card text-muted hover:bg-subtle",
      )}
      onClick={onSelect}
    >
      {label}
      <span className="ml-1 tabular-nums">{count}</span>
    </button>
  );
}
