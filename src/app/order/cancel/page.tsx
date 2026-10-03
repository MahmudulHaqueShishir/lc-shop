"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LastOrder {
  sessionToken: string;
  orderReference: string;
  amount: number;
  currency: string;
}

const LAST_ORDER_KEY = "lc-shop-demo:last-order";

/**
 * Unlike success_url, PayPage.tsx navigates to cancel_url as-is — no query
 * params (confirmed in PayPage.tsx: `window.location.href = cancelUrl`,
 * nothing appended). So there is no token here to look up authoritatively.
 * What's shown below comes from localStorage, stashed by the checkout page
 * right before redirecting — it's DISPLAY ONLY (what you were about to buy),
 * never used to decide anything payment-related. The cart itself is left
 * untouched, since nothing was charged.
 */
export default function OrderCancelPage() {
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LAST_ORDER_KEY);
      if (raw) setLastOrder(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  return (
    <>
      <h1>Payment cancelled</h1>
      <div className="banner pending">
        You returned from LiquidCash checkout without completing payment. Nothing was charged.
      </div>

      {lastOrder && (
        <dl className="order-details">
          <dt>Order ID</dt>
          <dd>{lastOrder.orderReference}</dd>
          <dt>Amount</dt>
          <dd>
            {lastOrder.currency} {lastOrder.amount.toFixed(2)}
          </dd>
        </dl>
      )}

      <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.75rem" }}>
        This order info comes from this browser's local storage, not a server check — the cancel
        redirect carries no session token to verify against. Your cart was left untouched; you can
        try paying again.
      </p>

      <div className="actions">
        <Link href="/cart">
          <button type="button">Back to cart</button>
        </Link>
        <Link href="/">
          <button type="button" className="secondary">
            Continue shopping
          </button>
        </Link>
      </div>
    </>
  );
}
