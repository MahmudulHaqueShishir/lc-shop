"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { findProduct } from "@/lib/products";

export default function CartPage() {
  const { lines, incrementQty, decrementQty, removeItem, subtotal, itemCount } = useCart();
  const router = useRouter();

  if (itemCount === 0) {
    return (
      <>
        <h1>Cart</h1>
        <p className="muted">Your cart is empty.</p>
        <Link href="/">
          <button type="button">Browse products</button>
        </Link>
      </>
    );
  }

  return (
    <>
      <h1>Cart</h1>
      <div>
        {lines.map((line) => {
          const product = findProduct(line.productId);
          if (!product) return null;
          return (
            <div className="cart-line" key={line.productId}>
              <span>{product.emoji}</span>
              <span className="cart-line-name">{product.name}</span>
              <span className="muted">${product.price.toFixed(2)} each</span>
              <div className="qty-controls">
                <button type="button" className="secondary" onClick={() => decrementQty(line.productId)}>
                  −
                </button>
                <span>{line.qty}</span>
                <button type="button" className="secondary" onClick={() => incrementQty(line.productId)}>
                  +
                </button>
              </div>
              <span>${(product.price * line.qty).toFixed(2)}</span>
              <button type="button" className="secondary" onClick={() => removeItem(line.productId)}>
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <div className="cart-summary">
        <span>Subtotal ({itemCount} items)</span>
        <span>${subtotal.toFixed(2)}</span>
      </div>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        This total is for display only. The actual charge is computed server-side at checkout
        from the product catalog — the server never trusts this number.
      </p>

      <div className="actions">
        <button type="button" onClick={() => router.push("/checkout")}>
          Checkout
        </button>
        <Link href="/">
          <button type="button" className="secondary">
            Continue shopping
          </button>
        </Link>
      </div>
    </>
  );
}
