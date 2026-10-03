/**
 * Mock catalog. This is the ONLY source of truth for prices — the server
 * (src/app/api/checkout/route.ts) looks prices up here by id and recomputes
 * the total itself. The client only ever sends {id, qty} pairs; it never
 * sends a price or a total that the server trusts.
 */
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // USD
  emoji: string;
}

export const PRODUCTS: Product[] = [
  {
    id: "mug",
    name: "LiquidCash Mug",
    description: "Ceramic, holds exactly one payment session worth of coffee.",
    price: 12.5,
    emoji: "☕",
  },
  {
    id: "tshirt",
    name: "SDK Integrator Tee",
    description: "100% cotton. Does not throw NOT_IMPLEMENTED.",
    price: 24.0,
    emoji: "👕",
  },
  {
    id: "notebook",
    name: "Idempotency Notebook",
    description: "Write the same note twice — it only counts once.",
    price: 8.99,
    emoji: "📓",
  },
  {
    id: "sticker-pack",
    name: "Webhook Sticker Pack",
    description: "Signed, verified, and stuck on your laptop.",
    price: 4.0,
    emoji: "🏷️",
  },
  {
    id: "keyboard",
    name: "Mechanical Keyboard",
    description: "For typing session tokens with confidence.",
    price: 89.99,
    emoji: "⌨️",
  },
  {
    id: "headphones",
    name: "Focus Headphones",
    description: "Block out everything except the signed webhook arriving.",
    price: 59.5,
    emoji: "🎧",
  },
];

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
