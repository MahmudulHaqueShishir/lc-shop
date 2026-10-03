"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-context";

/** Fires clearCart() once, client-side, when a paid order lands on /order/success. */
export function ClearCartOnMount() {
  const { clearCart } = useCart();
  useEffect(() => {
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
