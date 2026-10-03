# LC Shop Demo (Next.js)

A minimal merchant demo for exercising the existing `liquidcash-pay.js` SDK
end-to-end. It does not implement any payment logic itself — see
[Integration notes](#integration-notes).

## Run it

Prerequisites (all already running if you've been through Phase 4 testing):

1. `alvin_iyap360_micro` backend on `http://localhost:8000`
2. `lc_payment_gateway` pay-app dev server on `http://localhost:5173`, with the SDK built (`npm run build:sdk` in that project, so `public/liquidcash-pay.js` exists)
3. A valid `sandbox_api_key` for a merchant with an NMI sandbox gateway configured

```bash
cp .env.local.example .env.local
# fill in LC_MERCHANT_API_KEY — the same value works as in
# liquidcash-pay-sdk/examples/plain-php/.env from Phase 4

npm install
npm run dev
```

Open `http://localhost:3000`.

## Integration notes

- **`liquidcash-pay.js` is loaded from its existing URL** (`http://localhost:5173/liquidcash-pay.js`), not copied into this project — see `NEXT_PUBLIC_LC_SDK_URL`. No SDK files were modified.
- **Session creation is server-side only** (`src/lib/liquidcash-server.ts`, called from `src/app/api/checkout/route.ts`), using the same merchant API `liquidcash-pay-sdk` (PHP) calls. That PHP SDK can't run inside a Next.js server, so this replicates the one HTTP call it makes — it is not a second payment system.
- **The server, never the client, computes the amount.** `/api/checkout` accepts only `{productId, qty}` pairs and looks prices up in `src/lib/products.ts`. Verified: POSTing a spoofed `amount` field is silently ignored.
- **`/order/success` re-verifies server-side** via `getSession()` before showing "paid" — the `?status=success` query param from the redirect is treated as a UI hint only, not proof.
- **Two different "environment" values, both required, not interchangeable:**
  - `LC_MERCHANT_ENVIRONMENT` (server) — the merchant API's sandbox/production.
  - `NEXT_PUBLIC_LC_SDK_ENVIRONMENT` (browser) — which pay-app host the SDK redirects to. For a local pay-app dev server this **must** be `"local"`, independent of the merchant environment.
- **Cancel has no token.** `PayPage.tsx` navigates to `cancel_url` with no query params on cancel (only `success_url` gets `?status=…&session_token=…` appended). `/order/cancel` shows order info from `localStorage` (stashed by the checkout page before redirecting) purely for display — never used to decide anything.
- **Webhook receiver included** (`/api/webhook`) because `createSession()` requires a `webhook_url`. It verifies `X-LC-Signature` (HMAC-SHA256, timing-safe) the same way `WebhookVerifier` does, and logs verified deliveries to the console — no order/fulfillment system exists in this demo to act on it further.

No issues found in the SDK itself during this build; nothing in `lc_payment_gateway/sdk/` or `public/liquidcash-pay.js` was touched.
