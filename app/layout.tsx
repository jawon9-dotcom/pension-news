import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "글로벌 연기금 뉴스",
  description: "국내·해외 연기금 실시간 매크로 뉴스 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
