import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "마이페이지" };

export default function MyPage() {
  return (
    <ComingSoon
      title="마이페이지"
      week="W3~W4"
      description="내 작업 이력과 계정을 관리합니다. 썸네일·상품명·마진 산출물이 생기는 W3부터 이력이 채워집니다."
      features={[
        "작업 이력: 썸네일 / 상품명·태그 / 마진 계산 (works, margin_calcs)",
        "계정 관리: 이메일 · 비밀번호 변경",
        "결제 내역 조회 (W4 — 토스페이먼츠 단건 결제)",
      ]}
    />
  );
}
