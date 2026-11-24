"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ProductEditor, ProductDangerZone } from "@/components/panel/catalog-screen";
import { OpenProductQuestions } from "@/components/panel/open-product-questions";
import type { CatalogProduct } from "@/lib/catalog";
import type { StoredSkuLine } from "@/lib/store-order";
import { saveProductAction, type SaveProductState } from "@/server/catalog-actions";
import type { ProductQuestionRow } from "@/server/product-questions";

const initialState: SaveProductState = { error: null, productId: null, message: null };

export function ProductEditorPage({
  product,
  relatedOrderCount = 0,
  storedLines = [],
  costPreview = "",
  canManageCommerce = false,
  openQuestions = [],
}: {
  product: CatalogProduct | null;
  relatedOrderCount?: number;
  storedLines?: StoredSkuLine[];
  costPreview?: string;
  canManageCommerce?: boolean;
  openQuestions?: ProductQuestionRow[];
}) {
  const [state, formAction, pending] = useActionState(saveProductAction, initialState);

  if (!product && !canManageCommerce) {
    return (
      <div className="mx-auto max-w-[1600px] pb-8">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Tienda</p>
        <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Nuevo producto</h1>
        <section className="elevate-1 mt-5 max-w-2xl rounded-[14px] border border-line bg-card px-3 py-3" aria-labelledby="alta-bloqueada">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Permiso</p>
          <h2 id="alta-bloqueada" className="mt-0.5 text-sm font-semibold">Alta</h2>
          <p className="mt-1 text-sm text-muted">
            Solo el propietario puede crear productos. Puedes editar textos, fotos y disponibilidad de los que ya están. No cobra ni cambia pedidos.
          </p>
          <nav aria-label="Vista" className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
            <Link href="/panel/catalogo" title="Volver no cobra ni cambia el precio ni la publicación." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
              Volver al catálogo
            </Link>
          </nav>
          <p className="mt-2 text-xs leading-5 text-muted">Volver no cobra ni cambia el precio ni la publicación.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      {!canManageCommerce ? (
        <div className="elevate-1 mb-3 rounded-[14px] border border-line bg-card px-3 py-2">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Permiso</p>
          <p className="mt-0.5 text-sm text-muted">
            Solo el propietario cambia precio, costo, envío, comisiones, publicación, SKU, alta y eliminación.
            Puedes editar textos, fotos y disponibilidad. No es el precio ni la publicación. No cobra.
          </p>
        </div>
      ) : null}
      {state.message ? (
        <p role="status" className="mb-3 rounded-[14px] bg-accent-tint px-3 py-2 text-sm font-medium text-accent-strong">
          {state.message}
        </p>
      ) : null}
      {product ? (
        <OpenProductQuestions items={openQuestions} canApproveCatalog={canManageCommerce} />
      ) : null}
      <ProductEditor
        key={`${product?.id ?? "new"}-${product?.updatedAt ?? ""}`}
        product={product}
        formAction={formAction}
        pending={pending}
        error={state.error}
        relatedOrderCount={relatedOrderCount}
        storedLines={storedLines}
        costPreview={costPreview}
        canManageCommerce={canManageCommerce}
      />
      {product ? (
        <ProductDangerZone
          product={product}
          relatedOrderCount={relatedOrderCount}
          canManageCommerce={canManageCommerce}
        />
      ) : null}
    </div>
  );
}
