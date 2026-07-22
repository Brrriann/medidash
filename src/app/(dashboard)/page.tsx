import Link from "next/link";
import { getAllSubcategoryDetails, getRecentWorks, getTaxonomy } from "@/lib/data";
import { BodyMapExplorer } from "@/components/body-map/BodyMapExplorer";

const WORK_LABELS: Record<string, string> = {
  thumbnail: "썸네일",
  title_tags: "상품명·태그",
  margin: "마진 계산",
};

const QUICK_MENU = [
  {
    href: "/sourcing",
    title: "도매몰 통합 검색",
    desc: "3사 캐시에서 원료·키워드로 상품 찾기",
  },
  {
    href: "/titles",
    title: "상품명·태그 추천",
    desc: "노출도 상/중/하 상품명과 태그 20개",
  },
  {
    href: "/margin",
    title: "마진계산기",
    desc: "도매가 기반 마진액·마진율·손익분기",
  },
];

export default async function DashboardPage() {
  const [categories, details, recentWorks] = await Promise.all([
    getTaxonomy(),
    getAllSubcategoryDetails(),
    getRecentWorks(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          어떤 고민을 팔아볼까요?
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          인체 지도에서 계통을 클릭해 부위 → 증상 키워드 → 추천 원료 순으로
          좁혀 들어가세요.
        </p>
      </div>

      <BodyMapExplorer categories={categories} details={details} />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 최근 작업 이력 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-800">최근 작업</h2>
          {recentWorks.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-center">
              <p className="text-sm text-slate-400">아직 작업 이력이 없습니다</p>
              <p className="mt-1 text-xs text-slate-400">
                썸네일·상품명·마진 계산 결과가 여기에 쌓입니다 (W3)
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {recentWorks.map((w, i) => (
                <li key={i} className="flex justify-between py-2">
                  <span className="text-slate-700">
                    {WORK_LABELS[w.kind] ?? w.kind}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(w.createdAt).toLocaleString("ko-KR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 빠른 메뉴 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-800">빠른 메뉴</h2>
          <div className="space-y-2">
            {QUICK_MENU.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl border border-slate-200 px-4 py-3 transition hover:border-brand-300 hover:bg-brand-50/50"
              >
                <span className="block text-sm font-semibold text-slate-800">
                  {item.title} →
                </span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  {item.desc}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
