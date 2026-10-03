"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { findProduct } from "./products";

export interface CartLine {
  productId: string;
  qty: number;
}

interface CartContextValue {
  lines: CartLine[];
  addItem: (productId: string) => void;
  incrementQty: (productId: string) => void;
  decrementQty: (productId: string) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  /**
   * Display-only totals, computed client-side from the mock catalog.
   * NEVER sent to the server as an authoritative amount — checkout only ever
   * sends {productId, qty} pairs, and the server recomputes this same total
   * itself from src/lib/products.ts before creating a payment session.
   */
  subtotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "lc-shop-demo:cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      // ignore malformed/blocked storage — cart just starts empty
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // storage unavailable — cart still works for this page load
    }
  }, [lines, hydrated]);

  const addItem = (productId: string) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) {
        return prev.map((l) => (l.productId === productId ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { productId, qty: 1 }];
    });
  };

  const incrementQty = (productId: string) => addItem(productId);

  const decrementQty = (productId: string) => {
    setLines((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    );
  };

  const removeItem = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const clearCart = () => setLines([]);

  const { subtotal, itemCount } = useMemo(() => {
    let sub = 0;
    let count = 0;
    for (const line of lines) {
      const product = findProduct(line.productId);
      if (!product) continue;
      sub += product.price * line.qty;
      count += line.qty;
    }
    return { subtotal: sub, itemCount: count };
  }, [lines]);

  return (
    <CartContext.Provider
      value={{ lines, addItem, incrementQty, decrementQty, removeItem, clearCart, subtotal, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart() must be used inside <CartProvider>.");
  return ctx;
}
