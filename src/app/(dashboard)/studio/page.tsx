import type { Metadata } from "next";
import { isMockMode } from "@/lib/supabase/env";
import { ThumbnailStudio } from "@/components/studio/ThumbnailStudio";
import { getAiQuota } from "@/lib/ai/quota";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "썸네일" };

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ ingredient?: string; part?: string; ref?: string }>;
}) {
  const { ingredient, part, ref } = await searchParams;
  // ref = 소싱에서 넘어온 상품 id. 이미지 URL이 아니라 id로 받아야 서버가 임의 주소를
  // 받아오는 SSRF가 안 된다 (actions.ts loadProductImageAction 주석 참고).
  const productId = Number(ref);
  const quota = await getAiQuota();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        overline="Thumbnail Studio"
        title="썸네일"
        description="AI 배경·인물과 소싱한 상품 이미지를 얹고, 텍스트·건강기능식품 배지를 드래그로 배치해 플랫폼 프리셋 크기의 PNG로 내려받습니다."
      />

      <ThumbnailStudio
        defaults={{
          ingredient: ingredient ?? "",
          part: part ?? "",
          productId: Number.isFinite(productId) && productId > 0 ? productId : null,
        }}
        mock={isMockMode()}
        quota={quota}
      />
    </div>
  );
}
