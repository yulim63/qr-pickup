export type Product = {
  sku: "BPS" | "MS108" | "MS112";
  name: string;
  image: string;
  message: string;
};

export const PRODUCTS: Record<string, Product> = {
  BPS: {
    sku: "BPS",
    name: "BPS",
    image: "/products/BPS.jpg",
    message: "회수 대상 제품입니다. 아래 버튼을 눌러 회수 요청을 보내주세요.",
  },
  MS108: {
    sku: "MS108",
    name: "MS108",
    image: "/products/MS108.jpg",
    message: "회수 대상 제품입니다. 아래 버튼을 눌러 회수 요청을 보내주세요.",
  },
  MS112: {
    sku: "MS112",
    name: "MS112",
    image: "/products/MS112.jpg",
    message: "회수 대상 제품입니다. 아래 버튼을 눌러 회수 요청을 보내주세요.",
  },
};
