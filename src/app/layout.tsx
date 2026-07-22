import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MediDash — 건강기능식품 셀러 대시보드",
    template: "%s | MediDash",
  },
  description:
    "인체 지도에서 증상을 클릭하고 추천 원료 확인, 도매몰 소싱, AI 썸네일·상품명·태그, 마진 계산까지 원스톱.",
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
