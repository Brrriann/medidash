import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "썸네일 스튜디오" };

export default function StudioPage() {
  return (
    <ComingSoon
      title="썸네일 스튜디오"
      week="W3"
      description="AI가 원료 특징을 반영한 배경을 생성하고, 캔버스에서 텍스트·배지·로고를 편집해 플랫폼 프리셋 크기의 PNG로 내려받습니다. 산출물은 작업 이력(works)에 저장됩니다."
      features={[
        "AI 배경 생성 → 재생성 → 캔버스 편집 → PNG 다운로드 흐름",
        "텍스트 오버레이 블록 추가·드래그, 폰트/크기/색 조정",
        "'건강기능식품' 배지 삽입, 로고 업로드·배치",
        "사이즈 프리셋: 쿠팡 정방형 / 스마트스토어 / 인스타",
        "모든 산출물에 규정 검수 고지 문구 노출",
      ]}
    />
  );
}
