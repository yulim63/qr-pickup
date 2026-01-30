import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QR Pickup",
  description: "QR 기반 회수 요청",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
