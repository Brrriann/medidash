import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "마진계산기" };

export default function MarginPage() {
  return (
    <ComingSoon
      title="마진계산기"
      week="W3"
      description="고객 제공 엑셀의 수식을 lib/margin.ts 순수 함수로 이식해(단위 테스트 필수) 웹 폼으로 제공합니다. 도매몰 카드에서 진입하면 원가가 자동 입력됩니다."
      features={[
        "입력: 원가(도매가 자동) · 판매가 · 플랫폼 수수료율 · 배송비 · 기타비용",
        "출력: 마진액 · 마진율 · 손익분기 판매가",
        "동일 입력 시 고객 엑셀과 동일 출력(±0원) 보장 — 단위 테스트",
        "계산 결과 저장 및 히스토리 목록 (margin_calcs)",
      ]}
    />
  );
}
