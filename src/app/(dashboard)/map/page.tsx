import type { Metadata } from "next";
import { getAllSubcategoryDetails, getTaxonomy } from "@/lib/data";
import { BodyMapExplorer } from "@/components/body-map/BodyMapExplorer";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "증상 지도" };

export default async function BodyMapPage() {
  const [categories, details] = await Promise.all([
    getTaxonomy(),
    getAllSubcategoryDetails(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        overline="Body Map"
        title="증상 지도"
        description="어떤 고민을 팔아볼까요? 인체 지도에서 계통을 클릭해 부위 → 증상 키워드 → 추천 원료 순으로 좁혀 들어가세요."
      />

      <BodyMapExplorer categories={categories} details={details} />
    </div>
  );
}
