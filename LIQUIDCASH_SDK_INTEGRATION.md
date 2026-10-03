# LiquidCash Pay SDK Integration — `lc-nextjs-shop-demo`

How this demo actually integrates `liquidcash-pay.js`. Every claim below was verified
directly against the current source in this project — not assumed.

## Quick Start

```text
1. Install SDK             — nothing to install, it's a <script> tag (see §3)
2. Configure environment   — copy .env.local.example → .env.local, fill in the key
3. Create payment session  — POST /api/checkout (this app's own backend route)
4. Pass sessionToken to SDK — LiquidCashPay.init({ sessionToken, ... })
5. Open LiquidCash checkout — LiquidCashPay.open() (renders inline, iframe mode)
6. Handle payment result   — onSuccess / onCancel / onError callbacks
```

---

## 1. Overview

This is a Next.js 14 (App Router) demo shop that charges a cart through LiquidCash.
It has no payment logic of its own — every card/wallet/points/saved-card flow happens
inside the LiquidCash-hosted checkout, loaded via `liquidcash-pay.js` in **iframe mode**.

## 2. Requirements

- Node.js + npm (project uses `next@14.2.35`, `react@^18.3.1`)
- A running LiquidCash backend reachable from this app's server (`LC_MERCHANT_API_BASE`)
- A merchant `X-API-Key` for that backend
- A reachable URL serving `liquidcash-pay.js` (a deployed pay-app, or a local one for dev)

## 3. SDK Installation

**There is no npm package.** Confirmed in `package.json` — dependencies are only
`next`, `react`, `react-dom`. The SDK is a single JavaScript file, loaded at runtime
with a plain `<script>` tag the app injects itself:

```ts
// src/app/checkout/page.tsx
const script = document.createElement("script");
script.src = url; // NEXT_PUBLIC_LC_SDK_URL
document.head.appendChild(script);
```

There is no install command — copying `liquidcash-pay.js` into this repo, or adding it
to `package.json`, is not how this demo works.

## 4. Environment Configuration

Two files exist: `.env.local.example` (template, committed) and `.env.local` (real
values, gitignored). Next.js loads `.env` then `.env.local` — this project currently
has both, with identical values in each; `.env.local` is the documented/intended one.

| Variable | Required | Used For | Example |
|---|---|---|---|
| `LC_MERCHANT_API_KEY` | Yes | Server-side `X-API-Key` sent to the merchant API. **Never sent to the browser.** | `LIQUIDCASH_API_KEY=your_secret_key` |
| `LC_MERCHANT_API_BASE` | No (has a fallback) | Base URL of the merchant API. Falls back to `http://127.0.0.1:8000/api/merchant` if unset (`src/lib/liquidcash-server.ts`). | `LC_MERCHANT_API_BASE=https://your-backend/api/merchant` |
| `LC_MERCHANT_ENVIRONMENT` | No (defaults to `sandbox`) | Path segment in the merchant API URL: `{LC_MERCHANT_API_BASE}/{LC_MERCHANT_ENVIRONMENT}/v4/lc-pay/sessions`. | `sandbox` or `production` |
| `LC_MERCHANT_ORIGIN` | No (defaults to `http://localhost:3000`) | This app's own base URL, used to build `success_url`/`cancel_url`/`webhook_url` passed to `createSession()`. | `http://localhost:3000` |
| `NEXT_PUBLIC_LC_SDK_URL` | No (has a fallback) | Where the browser loads `liquidcash-pay.js` from. Browser-exposed (`NEXT_PUBLIC_*`). Falls back to `https://liquidcash-pay.vercel.app/liquidcash-pay.js` if unset. | `https://your-pay-app.example.com/liquidcash-pay.js` |
| `NEXT_PUBLIC_LC_SDK_ENVIRONMENT` | No (defaults to `"local"`) | Passed to `LiquidCashPay.init({ environment })`. Controls which pay-app host the SDK itself resolves internally — **not the same axis as `LC_MERCHANT_ENVIRONMENT`.** Browser-exposed. | `local`, `sandbox`, or `production` |

### Required
`LC_MERCHANT_API_KEY` — without it, `src/lib/liquidcash-server.ts` throws before any
API call is made (`"LC_MERCHANT_API_KEY is not set."`).

### Optional
Everything else above has a working fallback baked into the source.

### Do Not Expose
`LC_MERCHANT_API_KEY` must stay server-only. It is read only in
`src/lib/liquidcash-server.ts`, which is imported only from Next.js **API routes**
(`src/app/api/checkout/route.ts`, `src/app/api/webhook/route.ts`) — never from a
`"use client"` file, and never given a `NEXT_PUBLIC_` prefix. `LC_MERCHANT_ENVIRONMENT`
and `LC_MERCHANT_API_BASE` are also server-only in this project (no `NEXT_PUBLIC_`
prefix), even though they aren't secret — only the two `NEXT_PUBLIC_LC_SDK_*` variables
are meant to reach the browser bundle.

## 5. Payment Flow

This is what the code actually does, traced end-to-end:

```text
Browser (checkout page)
    ↓ 1. loads liquidcash-pay.js (script tag)
    ↓ 2. POST /api/checkout  {items: [{productId, qty}]}
Next.js API route (this app's own server)
    ↓ 3. looks up real prices from src/lib/products.ts, computes amount itself
    ↓ 4. POST {LC_MERCHANT_API_BASE}/{LC_MERCHANT_ENVIRONMENT}/v4/lc-pay/sessions
         X-API-Key: ...
LiquidCash Backend
    ↓ 5. returns { session_token, payment_url, ... }
Next.js API route
    ↓ 6. returns { sessionToken, orderReference, amount, currency } to the browser
Browser
    ↓ 7. LiquidCashPay.init({ sessionToken, environment, mode: "iframe", ... })
    ↓ 8. LiquidCashPay.open() → SDK mounts an iframe into #lc-pay-container
LiquidCash hosted checkout (inside the iframe)
    ↓ 9. customer pays (card / wallet / points / saved card — all inside the iframe)
    ↓ 10. SDK fires onSuccess / onCancel / onError in the parent page
Browser
    ↓ 11. onSuccess → router.push("/order/success?session_token=...")
/order/success (Next.js server component)
    ↓ 12. GET {LC_MERCHANT_API_BASE}/.../v4/lc-pay/sessions/{token}  (re-verify server-side)
    ↓ 13. renders "paid" only if the server itself confirms it
```

Separately, **`webhook_url` is sent at session-creation time** and the backend can
call it independently of the browser (`src/app/api/webhook/route.ts`), verified by
HMAC signature.

## 6. Frontend Setup

The only frontend integration point is `src/app/checkout/page.tsx`. It:

1. Injects the SDK `<script>` tag once (`loadLiquidCashSdk()`, deduplicated against
   React Strict Mode's double-invoke and repeated mounts)
2. POSTs the cart to `/api/checkout` to get a `sessionToken`
3. Calls `LiquidCashPay.init({...})` then `LiquidCashPay.open()`

No other page or component touches the SDK.

## 7. Backend Setup

### Frontend (this Next.js app)
Collects cart contents, POSTs `{productId, qty}` pairs to its own `/api/checkout`
route. Never sends a price or total — the server computes it.

### Merchant Backend (this app's own Next.js API routes, acting as the merchant server)

**`POST /api/checkout`** (`src/app/api/checkout/route.ts`)
- Request body: `{ "items": [{ "productId": "mug", "qty": 2 }] }`
- Validates each `productId` against `src/lib/products.ts`, computes `amount` itself
- Calls the real LiquidCash merchant API (below) and returns `{ success, sessionToken, orderReference, amount, currency }`

**Call this app makes to the LiquidCash merchant API** (`src/lib/liquidcash-server.ts`)
```text
POST {LC_MERCHANT_API_BASE}/{LC_MERCHANT_ENVIRONMENT}/v4/lc-pay/sessions
Headers: X-API-Key: {LC_MERCHANT_API_KEY}, Content-Type: application/json
Body: {
  amount, currency, order_reference,
  success_url, cancel_url, webhook_url
}
```
Response (on success): `{ session_token, payment_url, status, amount, currency, order_reference, ... }`

**`GET /api/order-status?token=...`** (`src/app/api/order-status/route.ts`)
Exists in the codebase (calls `getSession()` the same way) but **is not currently
called from anywhere in this app's UI** — `/order/success` calls `getSession()`
directly as a server component instead. Not verified as part of the active flow.

**`POST /api/webhook`** (`src/app/api/webhook/route.ts`)
Receives the signed callback from the LiquidCash backend. Verifies `X-LC-Signature`
(HMAC-SHA256 over the raw body, using `LC_MERCHANT_API_KEY` as the signing secret,
timing-safe compare), then logs the delivery. **No order/inventory system exists in
this demo — nothing is actually fulfilled**, it only logs to the console.

## 8. Minimal Example

```tsx
"use client";
import { useEffect, useState } from "react";

const SDK_URL = "https://your-pay-app.example.com/liquidcash-pay.js";

export default function MinimalCheckout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);

  async function pay() {
    // 1. Ask YOUR OWN backend for a sessionToken (server computes the amount)
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ productId: "mug", qty: 1 }] }),
    });
    const { sessionToken } = await res.json();

    // 2. Initialize and open the hosted checkout
    window.LiquidCashPay.init({
      sessionToken,
      environment: "production", // matches NEXT_PUBLIC_LC_SDK_ENVIRONMENT
      mode: "iframe",
      container: "#lc-pay-container",
      onSuccess: (result) => {
        window.location.href = `/order/success?session_token=${result.session_token}`;
      },
      onCancel: () => console.log("Checkout cancelled"),
      onError: (err) => console.error(err.message),
    });
    window.LiquidCashPay.open();
  }

  return (
    <>
      <div id="lc-pay-container" />
      <button disabled={!ready} onClick={pay}>Pay</button>
    </>
  );
}
```

This omits the cart UI, Strict-Mode guards, and error-state banners the real
`checkout/page.tsx` has — see that file for the production-ready version.

## 9. Redirect / Iframe Behavior

**This demo currently uses iframe mode**, confirmed directly in
`src/app/checkout/page.tsx`: `mode: "iframe"`, `container: "#lc-pay-container"`,
`loader: true`. The hosted checkout renders **inline** inside the page — the
customer never navigates away.

```text
Checkout page (this app)
     ↓ LiquidCashPay.open()
     ↓ SDK inserts an <iframe> into #lc-pay-container
LiquidCash hosted checkout (rendered inside that iframe, same page)
     ↓ postMessage back to the parent on success/cancel/error
This app's onSuccess/onCancel/onError callbacks fire
```

- **On success:** the SDK closes the iframe itself; this app's `onSuccess` then
  does a client-side `router.push` to `/order/success?session_token=...`.
- **On cancel:** handled **inline** — `onCancel` just sets local state to show a
  "cancelled" banner on the checkout page itself. It does **not** navigate anywhere.
- **On error:** the iframe is left open (by SDK design) so the shopper can see the
  failure and try another payment method without losing their session.

> The `mode: "redirect" | "iframe"` type still allows redirect mode, and an
> `/order/cancel` page exists in this codebase with a docstring describing
> redirect-mode behavior (`cancel_url` navigation) — but nothing in the current
> checkout page ever navigates to it. That page appears to be left over from an
> earlier redirect-mode version of this demo and is not reachable from the current
> iframe-mode flow. Not verified as active.

## 10. Security Notes

- **The browser never receives `LC_MERCHANT_API_KEY`.** It exists only in
  server-side code (`src/lib/liquidcash-server.ts`, imported only by API routes).
- **The browser never decides the amount.** `/api/checkout` computes `amount` from
  `src/lib/products.ts` server-side; the client can only choose *which* products and
  *how many*, never the price.
- **The `?status=success` query param is not trusted.** `/order/success` re-fetches
  the session from the LiquidCash backend server-side (`getSession()`) and only
  shows "paid" if that authoritative call confirms it.
- **What's safe to expose to the browser:** the `sessionToken` (opaque, scoped to
  one session) and the two `NEXT_PUBLIC_LC_SDK_*` values (a script URL and an
  environment string — neither is a credential).

## 11. Troubleshooting

### SDK does not load
- Check `NEXT_PUBLIC_LC_SDK_URL` is set and reachable (open it directly in a browser
  tab — it should return JavaScript, not HTML or a redirect)
- Check the browser console for a script load error
- Remember this variable must have the `NEXT_PUBLIC_` prefix to reach the browser at all (see below)

### Payment session creation fails (`/api/checkout` returns `success: false`)
- Check `LC_MERCHANT_API_KEY` is set in `.env.local`
- Check `LC_MERCHANT_API_BASE` and `LC_MERCHANT_ENVIRONMENT` combine into a URL your
  server can actually reach
- Check the request body sent to the merchant API matches what that backend expects
  (see §7)

### Checkout opens but the amount/session looks wrong
- Confirm `LC_MERCHANT_ENVIRONMENT` (server) and `NEXT_PUBLIC_LC_SDK_ENVIRONMENT`
  (browser) point at the **same real environment** — they are two independent
  settings and nothing enforces they match.

### Environment variable is `undefined` in the browser
Next.js only exposes variables prefixed `NEXT_PUBLIC_` to client-side code. Anything
without that prefix (like `LC_MERCHANT_API_KEY`) is `undefined` in the browser by
design — that's intentional here, not a bug, since that value must never reach it.

## 12. Important Files

| File | Purpose |
|---|---|
| `src/app/checkout/page.tsx` | Loads the SDK, creates the session, calls `init()`/`open()`, handles callbacks |
| `src/app/api/checkout/route.ts` | Server route: computes amount, calls the merchant API to create a session |
| `src/lib/liquidcash-server.ts` | Server-only client for the merchant API (`createSession`, `getSession`) |
| `src/lib/products.ts` | The server-trusted product/price catalog |
| `src/app/order/success/page.tsx` | Re-verifies payment status server-side before showing confirmation |
| `src/app/api/webhook/route.ts` | Signed webhook receiver (HMAC-SHA256, logs only) |
| `.env.local.example` | Template for required environment variables |
| `src/app/order/cancel/page.tsx` | Exists, but not currently reachable from the iframe-mode flow (see §9) |
| `src/app/api/order-status/route.ts` | Exists, but not currently called from anywhere in this app (see §7) |
