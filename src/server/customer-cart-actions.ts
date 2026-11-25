"use server";

import { revalidatePath } from "next/cache";
import { isSizeKind, type SizeKind } from "@/lib/catalog";
import { assertCustomerSession } from "@/server/customer-auth";
import { loadCustomerCart, mergeCartLines, saveCustomerCart, type CustomerCartLine } from "@/server/customer-cart";

export type SyncCartState = { error: string | null; lines: CustomerCartLine[] | null };

function parseLines(raw: unknown): CustomerCartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as { sku?: unknown; quantity?: unknown; variant?: unknown; sizeKind?: unknown };
      const sku = String(row.sku ?? "").trim().toUpperCase();
      const quantity = Number(row.quantity);
      if (!sku || !Number.isInteger(quantity) || quantity < 1) return null;
      return {
        sku,
        quantity: Math.min(5, quantity),
        variant: typeof row.variant === "string" ? row.variant : "",
        ...(isSizeKind(row.sizeKind) ? { sizeKind: row.sizeKind as SizeKind } : {}),
      } satisfies CustomerCartLine;
    })
    .filter((line): line is CustomerCartLine => Boolean(line));
}

/** Al entrar: fusiona localStorage con servidor y devuelve el carrito canónico. */
export async function syncCustomerCartAction(localLinesJson: string): Promise<SyncCartState> {
  const session = await assertCustomerSession();
  if (!session) return { error: null, lines: null };

  let local: CustomerCartLine[] = [];
  try {
    local = parseLines(JSON.parse(localLinesJson));
  } catch {
    local = [];
  }

  const server = await loadCustomerCart(session.user.id);
  const merged = mergeCartLines(server, local);
  const saved = await saveCustomerCart(session.user.id, merged);
  if (saved.error && !saved.skipped) {
    return { error: "No se pudo sincronizar el carrito.", lines: merged };
  }
  revalidatePath("/tienda/carrito");
  return { error: null, lines: merged };
}

export async function persistCustomerCartAction(linesJson: string): Promise<SyncCartState> {
  const session = await assertCustomerSession();
  if (!session) return { error: null, lines: null };

  let lines: CustomerCartLine[] = [];
  try {
    lines = parseLines(JSON.parse(linesJson));
  } catch {
    return { error: "Carrito inválido.", lines: null };
  }

  const saved = await saveCustomerCart(session.user.id, lines);
  if (saved.error && !saved.skipped) {
    return { error: "No se pudo guardar el carrito.", lines };
  }
  return { error: null, lines };
}
