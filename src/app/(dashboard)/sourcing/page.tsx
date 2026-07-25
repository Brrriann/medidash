import type { Metadata } from "next";
import { getWholesaleProducts, getBroadcastStats } from "@/lib/data";
import { SourcingExplorer } from "@/components/sourcing/SourcingExplorer";

export const metadata: Metadata = { title: "도매몰 통합 검색" };

export default async function SourcingPage({
  searchParams,
}: {
  searchParams: Promise<{ symptom?: string; ingredients?: string; q?: string }>;
}) {
  const { symptom, ingredients, q } = await searchParams;
  const { products, crawledAt, isSample } = await getWholesaleProducts();
  const broadcast = await getBroadcastStats();

  // 지도 CTA에서 넘어온 원료 → 첫 원료를 검색어로 자동 입력
  const initialQuery = q ?? ingredients?.split(",")[0]?.trim() ?? "";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">도매몰 통합 검색</h1>
          <p className="mt-1 text-sm text-slate-500">
            건온연B2B · 건강산 · 유픽B2B 상품 캐시를 한 번에 검색합니다.
            실시간 조회가 아닌 <strong>월 1회 배치 캐시</strong> 기준입니다.
          </p>
        </div>
        <div className="text-right text-[11px] leading-relaxed text-slate-400">
          <p>
            캐시 갱신일:{" "}
            {crawledAt
              ? new Date(crawledAt).toLocaleDateString("ko-KR")
              : "갱신 이력 없음"}
          </p>
          {isSample && (
            <p className="font-semibold text-amber-600">
              샘플 데이터 — W2 크롤러 연결 시 실데이터로 대체
            </p>
          )}
        </div>
      </div>

      <SourcingExplorer
        products={products}
        broadcast={broadcast}
        initialQuery={initialQuery}
        symptom={symptom ?? null}
      />
    </div>
  );
}
