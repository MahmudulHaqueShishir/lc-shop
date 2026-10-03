import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed webhook receiver — createSession() requires a webhook_url, and per
 * the SDK architecture this (not the browser callback) is the one thing a
 * merchant is supposed to trust for fulfillment. Verifies X-LC-Signature the
 * same way liquidcash-pay-sdk's WebhookVerifier does: HMAC-SHA256 over the
 * raw body, timing-safe compare.
 *
 * This demo only logs verified deliveries — no order/inventory system exists
 * here to fulfill against. A real merchant would mark the order paid here,
 * idempotently keyed on payload.delivery_id or payload.transaction_id.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-lc-signature") ?? "";
  const apiKey = process.env.LC_MERCHANT_API_KEY ?? "";

  if (!apiKey) {
    return NextResponse.json({ success: false, message: "Server misconfigured." }, { status: 500 });
  }

  const expected = createHmac("sha256", apiKey).update(rawBody).digest("hex");

  const signatureBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  const valid =
    signatureBuf.length === expectedBuf.length && timingSafeEqual(signatureBuf, expectedBuf);

  if (!valid) {
    console.warn("[lc-shop-demo webhook] invalid signature", { signaturePresent: signature !== "" });
    return NextResponse.json({ success: false, message: "Invalid signature." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  console.log("[lc-shop-demo webhook] verified delivery", {
    session_token: payload.session_token,
    status: payload.status,
    payment_channel: payload.payment_channel,
    transaction_id: payload.transaction_id,
    order_reference: payload.order_reference,
  });

  return NextResponse.json({ success: true });
}
