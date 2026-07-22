import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "상품명·태그 추천" };

export default function TitlesPage() {
  return (
    <ComingSoon
      title="상품명·태그 추천"
      week="W3"
      description="원료·부위·제품 특징과 플랫폼(쿠팡/스마트스토어)을 입력하면 노출도 등급이 붙은 상품명 3~5안과 태그 20개를 생성합니다. 의약품 오인 표현은 코드 레벨 금지어 필터로 치환됩니다."
      features={[
        "상품명 3~5안 + 노출도 상/중/하 뱃지 (원료+부위+브랜드+규격 스코어링)",
        "태그 20개: 증상 5 · 원료 한/영 5 · 부위·효능 5 · 대상군 3 · 계절 2",
        "항목별·전체 원클릭 복사",
        "플랫폼별 규칙 분기 (쿠팡: 브랜드+원료+수량 / 스마트스토어: 키워드 조합)",
        "금지어(치료·완치·예방 등) 자동 치환 + AI 초안 고지 문구",
      ]}
    />
  );
}
