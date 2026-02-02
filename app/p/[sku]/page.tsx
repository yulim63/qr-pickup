import ProductClient from "./Client";

type Props = { params: { sku: string } | Promise<{ sku: string }> };

export default async function Page({ params }: Props) {
  const p = await params;
  return <ProductClient sku={p.sku} />;
}
