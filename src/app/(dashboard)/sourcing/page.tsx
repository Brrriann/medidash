import type { Metadata } from "next";
import { getWholesaleProducts, getBroadcastStats, getKeywordStats } from "@/lib/data";
import { SourcingExplorer } from "@/components/sourcing/SourcingExplorer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTiles } from "@/components/ui/StatTiles";

export const metadata: Metadata = { title: "상품 소싱" };

export default async function SourcingPage({
  searchParams,
}: {
  searchParams: Promise<{ symptom?: string; ingredients?: string; q?: string }>;
}) {
  const { symptom, ingredients, q } = await searchParams;
  const { products, crawledAt, isSample } = await getWholesaleProducts();
  const [broadcast, keywords] = await Promise.all([
    getBroadcastStats(),
    getKeywordStats(),
  ]);

  // 지도 CTA에서 넘어온 원료 → 첫 원료를 검색어로 자동 입력
  const initialQuery = q ?? ingredients?.split(",")[0]?.trim() ?? "";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="상품 소싱"
        description={
          <>
            건온연B2B · 건강산 · 유픽B2B 상품 캐시를 한 번에 검색합니다. 실시간
            조회가 아닌 <strong>월 1회 배치 캐시</strong> 기준입니다.
          </>
        }
        aside={
          isSample ? (
            <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
              샘플 데이터 — 크롤러 연결 시 실데이터로 대체
            </span>
          ) : undefined
        }
      />

      <div className="card p-5">
        <StatTiles
          items={[
            { label: "상품 수", value: products.length.toLocaleString("ko-KR") },
            { label: "도매몰", value: "3사", hint: "건온연 · 건강산 · 유픽" },
            {
              label: "캐시 갱신일",
              value: crawledAt
                ? new Date(crawledAt).toLocaleDateString("ko-KR")
                : "없음",
              hint: "월 1회 배치",
            },
            {
              label: "키워드 지표",
              value: Object.keys(keywords).length.toLocaleString("ko-KR"),
              hint: "네이버 검색량 수집분",
            },
          ]}
        />
      </div>

      <SourcingExplorer
        products={products}
        broadcast={broadcast}
        keywords={keywords}
        initialQuery={initialQuery}
        symptom={symptom ?? null}
      />
    </div>
  );
}
