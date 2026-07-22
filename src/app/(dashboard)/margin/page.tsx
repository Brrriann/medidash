import type { Metadata } from "next";
import { isMockMode } from "@/lib/supabase/env";
import { getMarginHistory } from "@/lib/data";
import { MarginCalculator } from "@/components/margin/MarginCalculator";

export const metadata: Metadata = { title: "마진계산기" };

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
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">마진계산기</h1>
        <p className="mt-1 text-sm text-slate-500">
          원가·수수료·배송비를 넣으면 마진액과 손익분기, 목표 마진율 기준 권장
          판매가를 바로 계산합니다.
          {initialCost && (
            <span className="ml-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
              도매몰 카드에서 원가 {won(initialCost)} 자동 입력됨
            </span>
          )}
        </p>
      </div>

      <MarginCalculator
        initialCost={initialCost}
        productRef={productRef}
        mock={isMockMode()}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                  <th className="py-2 pr-4 font-medium">원가</th>
                  <th className="py-2 pr-4 font-medium">판매가</th>
                  <th className="py-2 pr-4 font-medium">수수료율</th>
                  <th className="py-2 pr-4 font-medium">마진액</th>
                  <th className="py-2 font-medium">마진율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2 pr-4 text-xs text-slate-400">
                      {new Date(h.createdAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="py-2 pr-4">{won(h.cost)}</td>
                    <td className="py-2 pr-4">{won(h.price)}</td>
                    <td className="py-2 pr-4">{h.feeRate}%</td>
                    <td
                      className={`py-2 pr-4 font-semibold ${
                        h.margin >= 0 ? "text-brand-700" : "text-red-600"
                      }`}
                    >
                      {won(h.margin)}
                    </td>
                    <td className="py-2">{h.marginRate}%</td>
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
