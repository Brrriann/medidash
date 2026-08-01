import type { Metadata } from "next";
import { isMockMode } from "@/lib/supabase/env";
import { getMarginHistory } from "@/lib/data";
import { MarginCalculator } from "@/components/margin/MarginCalculator";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "마진 계산" };

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

export default async function MarginPage({
  searchParams,
}: {
  searchParams: Promise<{ cost?: string; ref?: string }>;
}) {
  const { cost, ref } = await searchParams;
  const initialCost = cost && Number(cost) > 0 ? Number(cost) : null;
  const productRef = ref && Number(ref) > 0 ? Number(ref) : null;
  const history = await getMarginHistory();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="마진 계산"
        description="고객 제공 엑셀 수식(플랫폼별 수수료·부가세·종합소득세)을 그대로 적용해 판매마진과 세금 제외 최종마진을 계산합니다."
        aside={
          initialCost ? (
            <span className="inline-flex rounded bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700">
              도매몰 카드에서 원가 {won(initialCost)} 자동 입력됨
            </span>
          ) : undefined
        }
      />

      <MarginCalculator
        initialCost={initialCost}
        productRef={productRef}
        mock={isMockMode()}
      />

      <section className="card p-6">
        <h2 className="mb-3 text-sm font-bold text-slate-800">계산 히스토리</h2>
        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            저장된 계산이 없습니다
            {isMockMode() && " (mock 모드 — Supabase 연결 후 활성화)"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="py-2 pr-4 font-medium">일시</th>
                  <th className="py-2 pr-4 font-medium">플랫폼</th>
                  <th className="py-2 pr-4 font-medium">원가</th>
                  <th className="py-2 pr-4 font-medium">판매가</th>
                  <th className="py-2 pr-4 font-medium">최종마진</th>
                  <th className="py-2 font-medium">최종마진율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2 pr-4 text-xs text-slate-400">
                      {new Date(h.createdAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="py-2 pr-4">{h.platform === "coupang" ? "쿠팡" : h.platform === "naver" ? "네이버" : h.platform}</td>
                    <td className="py-2 pr-4">{won(h.cost)}</td>
                    <td className="py-2 pr-4">{won(h.price)}</td>
                    <td
                      className={`py-2 pr-4 font-semibold ${
                        h.finalMargin >= 0 ? "text-brand-700" : "text-red-600"
                      }`}
                    >
                      {won(h.finalMargin)}
                    </td>
                    <td className="py-2">{(h.finalMarginRate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
