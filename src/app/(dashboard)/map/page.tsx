import type { Metadata } from "next";
import { getAllSubcategoryDetails, getTaxonomy, getBroadcastStats } from "@/lib/data";
import { BodyMapExplorer } from "@/components/body-map/BodyMapExplorer";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "증상 지도" };

export default async function BodyMapPage() {
  const [categories, details, broadcast] = await Promise.all([
    getTaxonomy(),
    getAllSubcategoryDetails(),
    getBroadcastStats(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="증상 지도"
        description="어떤 고민을 팔아볼까요? 인체 지도에서 계통을 클릭해 부위 → 증상 키워드 → 추천 원료 순으로 좁혀 들어가세요."
      />

      {/* 방송 지표는 부위 패널 7종 중 ⑥ (docs/SPEC.md §5-3). 기준 시각을 서버에서 넘겨
          클라이언트 시계와 어긋나 리드타임이 흔들리는 것을 막는다. */}
      <BodyMapExplorer
        categories={categories}
        details={details}
        broadcast={broadcast}
        now={Date.now()}
      />
    </div>
  );
}
