import ProductClient from "./Client";

type Props = {
  params: { sku: string } | Promise<{ sku: string }>;
};

export default async function ProductPage({ params }: Props) {
  const p = await params;

  // ✅ Client.tsx는 { sku } prop만 받음
  return <ProductClient sku={p.sku} />;
}
