import Link from "next/link";
import { getSession } from "@/lib/liquidcash-server";
import { ClearCartOnMount } from "@/components/ClearCartOnMount";

interface Props {
  searchParams: { session_token?: string; status?: string; transaction_id?: string };
}

/**
 * Server component. The ?status=success in the URL (appended by the hosted
 * checkout, PayPage.tsx) is a UI convenience, not proof of payment — this
 * page re-fetches the session from the LiquidCash merchant API itself
 * (server-to-server, X-API-Key) and renders THAT, per base plan §6.11:
 * never mark an order paid off the browser signal alone.
 */
export default async function OrderSuccessPage({ searchParams }: Props) {
  const token = searchParams.session_token ?? "";

  if (!token) {
    return (
      <>
        <h1>Order confirmation</h1>
        <div className="banner error">
          No session_token in the URL. This page is meant to be reached via the LiquidCash
          checkout redirect, not visited directly.
        </div>
        <Link href="/">
          <button type="button">Back to shop</button>
        </Link>
      </>
    );
  }

  let session;
  let fetchError = "";
  try {
    session = await getSession(token);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Could not verify this order.";
  }

  const isPaid = session?.status === "paid" || session?.status === "success";

  return (
    <>
      <h1>Order confirmation</h1>

      {fetchError && <div className="banner error">{fetchError}</div>}

      {session && (
        <>
          {isPaid && <ClearCartOnMount />}

          <div className={`banner ${isPaid ? "success" : "pending"}`}>
            {isPaid
              ? "Payment confirmed by the LiquidCash server."
              : `Server-side status: "${session.status}" — not confirmed as paid.`}
          </div>

          <dl className="order-details">
            <dt>Order ID</dt>
            <dd>{session.order_reference}</dd>

            <dt>Payment status</dt>
            <dd>{session.status}</dd>

            <dt>Amount</dt>
            <dd>
              {session.currency} {session.amount.toFixed(2)}
            </dd>

            <dt>Payment method</dt>
            <dd>{session.payment_channel ?? "—"}</dd>
          </dl>

          <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.75rem" }}>
            This is the merchant API's own <code>getSession()</code> response, fetched server-side
            with this shop's <code>X-API-Key</code> just now — not data read from the URL.
          </p>
        </>
      )}

      <div className="actions">
        <Link href="/">
          <button type="button">Continue shopping</button>
        </Link>
      </div>
    </>
  );
}
