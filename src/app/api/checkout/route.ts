import { NextRequest, NextResponse } from "next/server";
import { findProduct } from "@/lib/products";
import { createSession } from "@/lib/liquidcash-server";

interface CheckoutRequestLine {
  productId: string;
  qty: number;
}

/**
 * Creates a LiquidCash payment session for the cart.
 *
 * SECURITY: the client sends only {productId, qty} pairs. The amount charged
 * is computed HERE, from src/lib/products.ts, never from anything the client
 * claims the subtotal/total is. A tampered client request can change WHICH
 * products are being bought, never their price or the resulting total.
 */
export async function POST(req: NextRequest) {
  let body: { items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? (body.items as CheckoutRequestLine[]) : [];
  if (items.length === 0) {
    return NextResponse.json({ success: false, message: "Cart is empty." }, { status: 422 });
  }

  let amount = 0;
  const resolvedLines: { name: string; unitPrice: number; qty: number }[] = [];

  for (const item of items) {
    const productId = typeof item?.productId === "string" ? item.productId : "";
    const qty = Number.isFinite(item?.qty) ? Math.trunc(item.qty) : 0;

    if (qty <= 0 || qty > 99) {
      return NextResponse.json(
        { success: false, message: `Invalid quantity for "${productId}".` },
        { status: 422 },
      );
    }

    const product = findProduct(productId);
    if (!product) {
      return NextResponse.json(
        { success: false, message: `Unknown product "${productId}".` },
        { status: 422 },
      );
    }

    amount += product.price * qty;
    resolvedLines.push({ name: product.name, unitPrice: product.price, qty });
  }

  amount = Math.round(amount * 100) / 100;

  const origin = (process.env.LC_MERCHANT_ORIGIN ?? "http://localhost:3000").replace(/\/+$/, "");
  const orderReference = `NEXTSHOP-${Date.now()}`;

  try {
    const session = await createSession({
      amount,
      currency: "USD",
      order_reference: orderReference,
      success_url: `${origin}/order/success`,
      cancel_url: `${origin}/order/cancel`,
      webhook_url: `${origin}/api/webhook`,
    });

    return NextResponse.json({
      success: true,
      sessionToken: session.session_token,
      orderReference,
      amount,
      currency: "USD",
      lines: resolvedLines,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create payment session.";
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}
