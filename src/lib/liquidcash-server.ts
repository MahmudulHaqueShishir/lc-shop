/**
 * Server-only client for the LiquidCash MERCHANT API
 * (api/merchant/{environment}/v4/lc-pay/sessions...), X-API-Key auth.
 *
 * This mirrors exactly two calls liquidcash-pay-sdk (PHP) already implements
 * in LiquidCashClient::createSession()/getSession() — it does not exist
 * because the PHP SDK is wrong or incomplete, but because it's PHP and
 * cannot run inside a Next.js server. This is the same API contract, called
 * from a different server-side language, holding the same secret key.
 *
 * NEVER import this from a "use client" component — LC_MERCHANT_API_KEY
 * must never reach the browser bundle.
 */

export interface LiquidCashSession {
  session_token: string;
  payment_url: string;
  status: string;
  amount: number;
  currency: string;
  order_reference: string;
  payment_channel: string | null;
  transaction_id: string | null;
  paid_at: string | null;
}

export interface CreateSessionInput {
  amount: number;
  currency: string;
  order_reference: string;
  customer_email?: string;
  customer_name?: string;
  success_url: string;
  cancel_url: string;
  webhook_url: string;
}

class LiquidCashApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "LiquidCashApiError";
  }
}

function config() {
  const apiKey = process.env.LC_MERCHANT_API_KEY;
  const apiBase = process.env.LC_MERCHANT_API_BASE ?? "http://127.0.0.1:8000/api/merchant";
  const environment = process.env.LC_MERCHANT_ENVIRONMENT ?? "sandbox";

  if (!apiKey) {
    throw new Error(
      "LC_MERCHANT_API_KEY is not set. Copy .env.local.example to .env.local and fill it in.",
    );
  }

  return { apiKey, baseUrl: `${apiBase.replace(/\/+$/, "")}/${environment}` };
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const { apiKey, baseUrl } = config();

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      ...init.headers,
    },
    cache: "no-store",
  });

  const body = (await res.json().catch(() => null)) as
    | { success?: boolean; message?: string; data?: T }
    | null;

  if (!res.ok || !body?.success) {
    throw new LiquidCashApiError(body?.message ?? `LiquidCash API request failed (HTTP ${res.status}).`, res.status);
  }

  return body.data as T;
}

/** Creates a payment session. The server computes `amount` itself — never accepts it from the client. */
export function createSession(input: CreateSessionInput): Promise<LiquidCashSession> {
  return request<LiquidCashSession>("/v4/lc-pay/sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Authoritative status check — used by the success page instead of trusting the browser callback. */
export function getSession(token: string): Promise<LiquidCashSession> {
  return request<LiquidCashSession>(`/v4/lc-pay/sessions/${encodeURIComponent(token)}`, {
    method: "GET",
  });
}
