import ProductClient from "./Client";

type Props = { params: { sku: string } | Promise<{ sku: string }> };

export default async function ProductPage({ params }: Props) {
  const p = await params;
  return <ProductClient rawSku={p.sku} />;
}
