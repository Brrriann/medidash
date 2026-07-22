import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "도매몰 통합 검색" };

export default async function SourcingPage({
  searchParams,
}: {
  searchParams: Promise<{ symptom?: string; ingredients?: string }>;
}) {
  const { symptom, ingredients } = await searchParams;
  const context =
    symptom || ingredients
      ? `지도에서 넘어온 소싱 조건 — ${symptom ? `증상: #${symptom}` : ""}${
          symptom && ingredients ? " · " : ""
        }${ingredients ? `원료: ${ingredients.split(",").join(", ")}` : ""}`
      : null;

  return (
    <ComingSoon
      title="도매몰 통합 검색"
      week="W2"
      description="건온연B2B · 건강산 · 유픽B2B 3사의 월 1회 크롤링 캐시(wholesale_products)를 통합 검색합니다. 실시간 조회가 아닌 배치 캐시 기준이며 갱신일이 함께 표시됩니다."
      context={context}
      features={[
        "키워드/원료 검색 → 3사 통합 카드 리스트 (사이트별 필터)",
        "카드: 도매가 · 추천 판매가(기본 도매가×2, 조정 가능) · 마진율 미리보기",
        "원본 상품 페이지 링크, [썸네일 만들기] · [상품명 만들기] 버튼",
        "원료 칩 클릭 시 해당 원료 매칭 상품 필터링",
        "홈쇼핑모아 방송 지표(broadcast_stats) 병기",
      ]}
    />
  );
}
