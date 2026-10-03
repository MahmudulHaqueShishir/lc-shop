"use client";

import { useCart } from "@/lib/cart-context";
import { findProduct } from "@/lib/products";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    LiquidCashPay?: {
      init: (config: {
        sessionToken: string;
        environment: string;
        mode: "redirect" | "iframe";
        loader?: boolean;
        container?: string | Element;
        onReady?: () => void;
        onSuccess?: (result: {
          transaction_id?: string;
          order_reference?: string;
          payment_channel?: string;
          session_token: string;
        }) => void;
        onCancel?: () => void;
        onError?: (error: { code: string; message: string }) => void;
      }) => void;
      open: () => void;
      close: () => void;
      getCheckoutUrl: () => string;
    };
  }
}

const SDK_URL =
  process.env.NEXT_PUBLIC_LC_SDK_URL ??
  "http://localhost:5173/liquidcash-pay.js";
const SDK_ENVIRONMENT = process.env.NEXT_PUBLIC_LC_SDK_ENVIRONMENT ?? "local";
const LAST_ORDER_KEY = "lc-shop-demo:last-order";
const PAY_CONTAINER_ID = "lc-pay-container";

type Status =
  | "sdk-loading"
  | "sdk-error"
  | "creating-session"
  | "checkout-open"
  | "cancelled"
  | "error";

/**
 * liquidcash-pay.js is a plain <script> tag, not an ES module — so there is nothing
 * to import/cache via the module graph. This module-level promise is the caching
 * layer instead: at most one <script src=SDK_URL> is ever injected into the page for
 * its whole lifetime, no matter how many times a component calls this (StrictMode's
 * double-invoke, Fast Refresh, or multiple checkout mounts across navigations all
 * share it). If a script tag for this exact URL already exists (e.g. injected by a
 * prior mount), this attaches to THAT tag instead of creating a second one.
 */
let sdkLoadPromise: Promise<void> | null = null;

function loadLiquidCashSdk(url: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.LiquidCashPay) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${url}"]`,
    );

    if (existing) {
      if (window.LiquidCashPay) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error(`Failed to load ${url}`)),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkLoadPromise = null; // allow a retry to re-attempt the load
      reject(new Error(`Failed to load ${url}`));
    };
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

/**
 * Iframe-mode checkout: liquidcash-pay.js renders the hosted checkout INLINE into
 * #lc-pay-container (below), right next to this page's own order summary — the
 * customer never leaves this page. The whole payment surface (card entry, LiquidCash
 * login, wallet/points/saved-card selection) lives inside that iframe; this page only
 * ever sees the session_token it already had and the outcome via onSuccess/onCancel/
 * onError. It never touches NMI, wallet, reward-point, or saved-card APIs directly —
 * see SDK-MERCHANT-INTEGRATION.md.
 *
 * The checkout starts itself: no "Pay with LiquidCash" click is required. On mount,
 * this loads the SDK, creates a session, then calls init()+open() automatically, so
 * the iframe (with its own built-in loader) appears as soon as the page does.
 */
export default function CheckoutPage() {
  const { lines, subtotal, itemCount } = useCart();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("sdk-loading");
  const [message, setMessage] = useState("");
  const sessionTokenRef = useRef<string>("");

  // Guards against React 18 Strict Mode's dev-only double-invoke of this effect
  // (mount -> cleanup -> mount again, synchronously). See the effect below for how
  // these three refs cooperate to guarantee: the session-creating fetch and
  // init()+open() fire AT MOST ONCE per component instance, no matter how many times
  // the effect body itself runs; and close() fires on the real final unmount even
  // though the Strict Mode "phantom" cleanup fires first and must be a no-op.
  const startedRef = useRef(false);
  const unmountedRef = useRef(false);
  const sdkOpenedRef = useRef(false);

  useEffect(() => {
    // Every effect invocation (phantom or real) resets this to false on the way in,
    // and its own cleanup sets it back to true on the way out. Because JS runs the
    // Strict Mode sequence synchronously — setup(A) -> cleanup(A) [sets true] ->
    // setup(B) [resets false] — an async continuation from setup(A) that checks this
    // AFTER that whole synchronous burst correctly sees `false` (component is alive),
    // while a continuation resuming after the REAL final unmount correctly sees
    // `true` (nothing ran afterward to reset it).
    unmountedRef.current = false;

    if (itemCount > 0 && !startedRef.current) {
      startedRef.current = true;
      void startCheckout();
    }

    return () => {
      unmountedRef.current = true;

      // sdkOpenedRef is only true once open() has actually run. During the Strict
      // Mode phantom cleanup this is still false (open() can't have fired yet — it's
      // behind at least a script-load and a fetch, both genuinely async), so this is
      // a harmless no-op there and only does real work on a true unmount.
      if (sdkOpenedRef.current) {
        window.LiquidCashPay?.close();
        sdkOpenedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCheckout() {
    setStatus("sdk-loading");
    setMessage("");

    try {
      await loadLiquidCashSdk(SDK_URL);
      if (unmountedRef.current) return;

      setStatus("creating-session");

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        }),
      });
      const body = await res.json();
      if (unmountedRef.current) return;

      if (!body.success) {
        setStatus("error");
        setMessage(body.message ?? "Could not create payment session.");
        return;
      }

      sessionTokenRef.current = body.sessionToken;

      // Display-only correlation for /order/cancel and /order/success — never used
      // to decide payment status, only to show what was being purchased.
      try {
        window.localStorage.setItem(
          LAST_ORDER_KEY,
          JSON.stringify({
            sessionToken: body.sessionToken,
            orderReference: body.orderReference,
            amount: body.amount,
            currency: body.currency,
          }),
        );
      } catch {
        // non-fatal
      }

      if (!window.LiquidCashPay) {
        setStatus("sdk-error");
        setMessage(
          `${SDK_URL} loaded but did not define window.LiquidCashPay.`,
        );
        return;
      }

      window.LiquidCashPay.init({
        sessionToken: body.sessionToken,
        environment: SDK_ENVIRONMENT,
        mode: "iframe",
        loader: true,
        container: `#${PAY_CONTAINER_ID}`,
        onReady: () => {
          // The iframe has mounted and fetched its own session state. The SDK's
          // built-in loader already hides itself on this same signal — nothing
          // else required here for the loader to disappear.
        },
        onSuccess: (result) => {
          // The iframe already told the LiquidCash backend the payment succeeded;
          // this page's job is only to navigate to a page that RE-VERIFIES that
          // server-side (see /order/success) — never trust this callback alone.
          sdkOpenedRef.current = false; // SDK already closed the iframe itself
          const token = result.session_token || sessionTokenRef.current;
          router.push(
            `/order/success?status=success&session_token=${encodeURIComponent(token)}`,
          );
        },
        onCancel: () => {
          // SDK already closed the iframe itself before this fires.
          sdkOpenedRef.current = false;
          setStatus("cancelled");
        },
        onError: (error) => {
          // Iframe stays open by SDK design so the shopper can see why it declined
          // and retry another payment method inside the same checkout.
          setStatus("error");
          setMessage(error.message || "Payment failed.");
        },
      });

      if (unmountedRef.current) return;

      window.LiquidCashPay.open();
      sdkOpenedRef.current = true;
      setStatus("checkout-open");
    } catch (err) {
      if (unmountedRef.current) return;
      setStatus("error");
      setMessage(
        err instanceof Error
          ? err.message
          : "Unexpected error creating the session.",
      );
    }
  }

  /** Explicit customer retry after a cancel/error — not the initial auto-start trigger. */
  function handleRetry() {
    startedRef.current = true;
    void startCheckout();
  }

  if (itemCount === 0 && status !== "checkout-open") {
    return (
      <>
        <h1>Checkout</h1>
        <p className="muted">Your cart is empty.</p>
        <Link href="/">
          <button type="button">Browse products</button>
        </Link>
      </>
    );
  }

  return (
    <>
      <h1>Checkout</h1>

      <p
        className="muted"
        style={{ fontSize: "0.85rem", marginBottom: "1rem" }}
      >
        The payment panel below is the LiquidCash hosted checkout, loaded
        automatically in an iframe by <code>liquidcash-pay.js</code> — this page
        never sees card numbers, wallet credentials, or reward-point balances
        directly.
      </p>

      {status === "sdk-error" && (
        <div className="banner error">
          {message}
          <div style={{ marginTop: "0.5rem" }}>
            <button type="button" onClick={handleRetry}>
              Try again
            </button>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="banner error">
          {message}
          <div style={{ marginTop: "0.5rem" }}>
            <button type="button" className="secondary" onClick={handleRetry}>
              Start a new checkout
            </button>
          </div>
        </div>
      )}
      {status === "cancelled" && (
        <div className="banner pending">
          Checkout was closed before payment completed. Your cart is unchanged.
          <div style={{ marginTop: "0.5rem" }}>
            <button type="button" onClick={handleRetry}>
              Pay with LiquidCash
            </button>
          </div>
        </div>
      )}

      <div className="checkout-grid">
        <div className="checkout-payment-col">
          <h2>Payment</h2>

          {/*
            #lc-pay-container is rendered EXACTLY ONCE, with no React children,
            in every status. Once open() runs, liquidcash-pay.js takes over that
            div's DOM directly (innerHTML swap, iframe insert). If React ever
            re-rendered children into this same div afterwards, its reconciler
            would try to remove/update DOM nodes the SDK already replaced out
            from under it and throw. The pre-open placeholder below is therefore
            a SIBLING overlay, never a child of #lc-pay-container, and it
            disappears (via the status !== "checkout-open" check) the moment
            open() has run — from then on the SDK's own loader/iframe are the
            only thing occupying this space.
          */}
          <div className="lc-pay-mount-wrap">
            <div id={PAY_CONTAINER_ID} />

            {status !== "checkout-open" &&
              status !== "cancelled" &&
              status !== "error" &&
              status !== "sdk-error" && (
                <div className="lc-pay-cta-overlay">
                  <p className="muted">
                    {status === "sdk-loading" && "Loading payment SDK…"}
                    {status === "creating-session" &&
                      "Preparing your checkout…"}
                  </p>
                </div>
              )}
          </div>
        </div>

        <div className="order-ticket">
          <p className="order-ticket-label">Order ticket</p>
          <p className="order-ticket-title">Your bag</p>

          {lines.map((line) => {
            const product = findProduct(line.productId);
            if (!product) return null;
            return (
              <div className="order-ticket-item" key={line.productId}>
                <div>
                  <div className="name">
                    {product.emoji} {product.name}
                  </div>
                  <div className="meta">Qty {line.qty}</div>
                </div>
                <div className="name">
                  ${(product.price * line.qty).toFixed(2)}
                </div>
              </div>
            );
          })}

          <div className="order-ticket-totals">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="order-ticket-totals">
            <span>Delivery</span>
            <span>Free</span>
          </div>

          <div className="order-ticket-grand">
            <span>Total</span>
            <span className="amount">${subtotal.toFixed(2)}</span>
          </div>

          <p className="order-ticket-footnote">
            Hosted by LiquidCash · card, wallet, points, saved cards.
          </p>
        </div>
      </div>
    </>
  );
}
