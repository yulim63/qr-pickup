import ProductClient from "./Client";

export default async function ProductPage(props: { params: Promise<{ sku: string }> }) {
  const { sku } = await props.params;
  return <ProductClient sku={sku} />;
}
