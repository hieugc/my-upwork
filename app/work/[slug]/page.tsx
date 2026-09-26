import { notFound } from "next/navigation";
import products from "@/data/products.json";
import ProductExperience from "@/components/ProductExperience";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = products.find((item) => item.slug === slug);
  if (!product) notFound();
  return <ProductExperience product={product} />;
}
