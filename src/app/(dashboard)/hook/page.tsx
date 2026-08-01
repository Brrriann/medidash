import type { Metadata } from "next";
import Link from "next/link";
import { getAiQuota } from "@/lib/ai/quota";
import { PageHeader } from "@/components/ui/PageHeader";
import { HookStudio } from "@/components/hook/HookStudio";
import { loadHookContextAction } from "./actions";

export const metadata: Metadata = { title: "후킹페이지" };

export default async function HookPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  // 상품 id로 받는다 — 클라이언트가 준 임의 값으로 서버가 외부를 조회하지 않게 한다.
  const productId = Number(ref);
  const [loaded, quota] = await Promise.all([
    // mock에서는 id 없이도 샘플을 돌려주므로 그대로 호출한다.
    loadHookContextAction(Number.isFinite(productId) && productId > 0 ? productId : 0),
    getAiQuota(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="후킹페이지"
        description="상세페이지 최상단에 넣을 후킹 이미지 2장을 만듭니다. 1장은 고객의 고민을 지목하고, 2장은 제품으로 답합니다. 의약품 오인 표현은 광고 안전 표현으로 자동 치환됩니다."
      />

      {!loaded ? (
        <section className="card p-8 text-center">
          <p className="text-sm text-slate-500">
            소싱 목록에서 상품을 고르면 그 상품 정보로 후킹페이지를 만듭니다.
          </p>
          <Link
            href="/sourcing"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            상품 소싱으로 가기
          </Link>
        </section>
      ) : (
        <>
          {/* 어떤 정보로 문구를 만드는지 먼저 보여준다 — 결과가 이상하면 여기가 원인이다. */}
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-slate-800">이 상품 정보로 만듭니다</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 md:grid-cols-4">
              <div>
                <dt className="text-xs text-slate-400">상품</dt>
                <dd className="font-semibold text-slate-800">{loaded.ctx.spec.core}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">규격</dt>
                <dd className={loaded.ctx.specText ? "text-slate-700" : "text-slate-400"}>
                  {loaded.ctx.specText || "상품명에 규격 없음"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">원료</dt>
                <dd className="text-slate-700">
                  {loaded.ctx.ingredients.join(", ") || (
                    <span className="text-slate-400">매칭된 원료 없음</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">구매자 고민</dt>
                <dd className="text-slate-700">
                  {loaded.ctx.symptoms.join(", ") || (
                    <span className="text-amber-600">
                      없음 — 1장 문구가 일반적으로 나옵니다
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <HookStudio
            product={loaded.product}
            specText={loaded.ctx.specText}
            ingredient={loaded.ctx.ingredients[0] ?? loaded.ctx.spec.core}
            symptom={loaded.ctx.symptoms[0] ?? ""}
            quota={quota}
          />
        </>
      )}
    </div>
  );
}
