"use client";

import { useActionState } from "react";
import { ProductEditor, ProductDangerZone } from "@/components/panel/catalog-screen";
import type { CatalogProduct } from "@/lib/catalog";
import { saveProductAction, type SaveProductState } from "@/server/catalog-actions";

const initialState: SaveProductState = { error: null, productId: null, message: null };

export function ProductEditorPage({
  product,
  relatedOrderCount = 0,
}: {
  product: CatalogProduct | null;
  relatedOrderCount?: number;
}) {
  const [state, formAction, pending] = useActionState(saveProductAction, initialState);

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
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
