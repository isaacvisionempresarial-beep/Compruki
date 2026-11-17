"use client";

import { useActionState } from "react";
import { ProductEditor, ProductDangerZone } from "@/components/panel/catalog-screen";
import type { CatalogProduct } from "@/lib/catalog";
import { saveProductAction, type SaveProductState } from "@/server/catalog-actions";

const initialState: SaveProductState = { error: null, productId: null, message: null };

export function ProductEditorPage({
  product,
  relatedOrderCount = 0,
  canManageCommerce = false,
}: {
  product: CatalogProduct | null;
  relatedOrderCount?: number;
  canManageCommerce?: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveProductAction, initialState);

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      {!canManageCommerce ? (
        <p className="mb-3 rounded-[14px] border border-line bg-card px-3 py-2 text-sm text-muted">
          Solo el propietario cambia precio, costo, envío, comisiones, publicación, SKU, alta y eliminación.
          Puedes editar textos, fotos y disponibilidad.
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="mb-3 rounded-[14px] bg-accent-tint px-3 py-2 text-sm font-medium text-accent-strong">
          {state.message}
        </p>
      ) : null}
      <ProductEditor
        key={`${product?.id ?? "new"}-${product?.updatedAt ?? ""}`}
        product={product}
        formAction={formAction}
        pending={pending}
        error={state.error}
        relatedOrderCount={relatedOrderCount}
      />
      {product ? <ProductDangerZone product={product} relatedOrderCount={relatedOrderCount} /> : null}
    </div>
  );
}
