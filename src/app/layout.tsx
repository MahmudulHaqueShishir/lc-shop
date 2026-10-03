import type { ReactNode } from "react";
import Link from "next/link";
import { CartProvider } from "@/lib/cart-context";
import "./globals.css";

export const metadata = {
  title: "LC Shop Demo",
  description: "Minimal Next.js merchant demo for testing liquidcash-pay.js",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <header className="site-header">
            <Link href="/" className="brand">
              LC Shop Demo
            </Link>
            <nav>
              <Link href="/cart">Cart</Link>
            </nav>
          </header>
          <main>{children}</main>
        </CartProvider>
      </body>
    </html>
  );
}
