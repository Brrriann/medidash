import type { Metadata } from "next";
import { isMockMode } from "@/lib/supabase/env";
import { ThumbnailStudio } from "@/components/studio/ThumbnailStudio";

export const metadata: Metadata = { title: "썸네일" };

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ ingredient?: string; part?: string }>;
}) {
  const { ingredient, part } = await searchParams;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">썸네일</h1>
        <p className="mt-1 text-sm text-slate-500">
          부위 테마 배경을 생성하고 텍스트·건강기능식품 배지·로고를 드래그로 배치해
          플랫폼 프리셋 크기의 PNG로 내려받습니다.
        </p>
      </div>

      <ThumbnailStudio
        defaults={{ ingredient: ingredient ?? "", part: part ?? "" }}
        mock={isMockMode()}
      />
    </div>
  );
}
