import ProductClient from "./Client";

type Props = {
  params: { sku: string } | Promise<{ sku: string }>;
};

export default async function ProductPage({ params }: Props) {
  const p = await params; // ✅ Next 16에서 params Promise 이슈 방지
  return <ProductClient sku={p.sku} />;
}
