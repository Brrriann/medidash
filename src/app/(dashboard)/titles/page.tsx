import type { Metadata } from "next";
import { TAXONOMY } from "@/lib/taxonomy/data";
import { TitleGenerator } from "@/components/titles/TitleGenerator";

export const metadata: Metadata = { title: "상품명·태그 추천" };

// 부위/효능 자동완성 후보 (중분류명)
const BODY_PARTS = TAXONOMY.flatMap((c) => c.subcategories.map((s) => s.name));

export default async function TitlesPage({
  searchParams,
}: {
  searchParams: Promise<{ ingredient?: string; part?: string }>;
}) {
  const { ingredient, part } = await searchParams;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">상품명·태그 추천</h1>
        <p className="mt-1 text-sm text-slate-500">
          원료·부위·플랫폼을 입력하면 노출도 등급이 붙은 상품명 3~5안과 태그 20개를
          만들어 드립니다. 의약품 오인 표현은 광고 안전 표현으로 자동 치환됩니다.
        </p>
      </div>

      <TitleGenerator
        defaults={{ ingredient: ingredient ?? "", bodyPart: part ?? "" }}
        bodyParts={BODY_PARTS}
      />
    </div>
  );
}
