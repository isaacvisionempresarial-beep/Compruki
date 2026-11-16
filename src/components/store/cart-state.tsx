"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { isSizeKind, type SizeKind } from "@/lib/catalog";

const storageKey = "store_cart";

export type CartLine = { sku: string; quantity: number; variant: string; sizeKind?: SizeKind };

function sameLine(line: CartLine, sku: string, variant: string) {
  return line.sku === sku && line.variant === variant;
}

function readStoredLines(): CartLine[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as CartLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((line) => typeof line.sku === "string" && Number.isInteger(line.quantity) && line.quantity > 0)
      .map((line) => ({
        sku: line.sku,
        quantity: line.quantity,
        variant: typeof line.variant === "string" ? line.variant : "",
        ...(isSizeKind(line.sizeKind) ? { sizeKind: line.sizeKind } : {}),
      }));
  } catch {
    return [];
  }
}

type CartApi = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  add: (sku: string, quantity?: number, variant?: string, sizeKind?: SizeKind) => void;
  setQuantity: (sku: string, variant: string, quantity: number) => void;
  setVariant: (sku: string, from: string, to: string, sizeKind?: SizeKind) => void;
  remove: (sku: string, variant: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartApi | null>(null);

const emptySubscribe = () => () => {};

export function CartProvider({ children }: { children: ReactNode }) {
  const client = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  if (client && !ready) {
    setLines(readStoredLines());
    setReady(true);
  }

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storageKey, JSON.stringify(lines));
  }, [lines, ready]);

  const add = useCallback((sku: string, quantity = 1, variant = "", sizeKind?: SizeKind) => {
    setLines((current) => {
      const found = current.find((line) => sameLine(line, sku, variant));
      const kind = isSizeKind(sizeKind) ? sizeKind : undefined;
      if (!found) return [...current, { sku, variant, quantity: Math.min(5, quantity), ...(kind ? { sizeKind: kind } : {}) }];
      return current.map((line) =>
        sameLine(line, sku, variant) ? { ...line, quantity: Math.min(5, line.quantity + quantity), ...(kind ? { sizeKind: kind } : {}) } : line,
      );
    });
  }, []);

  const setQuantity = useCallback((sku: string, variant: string, quantity: number) => {
    setLines((current) =>
      quantity < 1
        ? current.filter((line) => !sameLine(line, sku, variant))
        : current.map((line) => (sameLine(line, sku, variant) ? { ...line, quantity: Math.min(5, quantity) } : line)),
    );
  }, []);

  const setVariant = useCallback((sku: string, from: string, to: string, sizeKind?: SizeKind) => {
    setLines((current) => {
      if (from === to) return current;
      const source = current.find((line) => sameLine(line, sku, from));
      if (!source) return current;
      const kind = isSizeKind(sizeKind) ? sizeKind : source.sizeKind;
      const target = current.find((line) => sameLine(line, sku, to));
      if (!target) {
        return current.map((line) =>
          sameLine(line, sku, from) ? { ...line, variant: to, ...(kind ? { sizeKind: kind } : {}) } : line,
        );
      }
      const quantity = Math.min(5, source.quantity + target.quantity);
      return current
        .filter((line) => !sameLine(line, sku, from))
        .map((line) => (sameLine(line, sku, to) ? { ...line, quantity, ...(kind ? { sizeKind: kind } : {}) } : line));
    });
  }, []);

  const remove = useCallback((sku: string, variant: string) => {
    setLines((current) => current.filter((line) => !sameLine(line, sku, variant)));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <CartContext.Provider value={{ lines, ready, count, add, setQuantity, setVariant, remove, clear }}>{children}</CartContext.Provider>
  );
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("El carrito solo está disponible dentro de la tienda.");
  return cart;
}
