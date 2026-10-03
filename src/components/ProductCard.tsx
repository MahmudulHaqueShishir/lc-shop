"use client";

import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();

  return (
    <div className="card">
      <div className="product-emoji">{product.emoji}</div>
      <p className="product-name">{product.name}</p>
      <p className="product-desc">{product.description}</p>
      <p className="product-price">${product.price.toFixed(2)}</p>
      <button type="button" onClick={() => addItem(product.id)}>
        Add to cart
      </button>
    </div>
  );
}
