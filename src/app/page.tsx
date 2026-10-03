import { PRODUCTS } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

export default function HomePage() {
  return (
    <>
      <h1>Demo products</h1>
      <div className="product-grid">
        {PRODUCTS.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </>
  );
}
