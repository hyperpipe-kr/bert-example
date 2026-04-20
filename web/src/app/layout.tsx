import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한국어 감성 분석",
  description: "BERT 기반 감성 분석 결과를 확인하는 웹 페이지",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
