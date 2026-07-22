import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { isMockMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "관리자" };

export default async function AdminPage() {
  // mock 모드는 화면 구조 확인용으로 통과, 실모드는 admin 역할 필수
  if (!isMockMode()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") redirect("/");
  }

  return (
    <ComingSoon
      title="관리자"
      week="W2~W4"
      description="운영자 전용 화면입니다. 수강생 코드 발급과 회원 관리, 데이터 갱신(크롤러)을 여기서 수행합니다."
      context={
        isMockMode()
          ? "Mock 모드 — 화면 구조 확인용으로 접근이 허용되어 있습니다. 실모드에서는 admin 역할만 접근 가능합니다."
          : null
      }
      features={[
        "수강생 코드 발급·관리 (invite_codes: 사용 횟수/만료)",
        "회원 목록 조회 (profiles)",
        "도매몰 크롤러 실행 버튼 + 최근 갱신일 표시 (W2, 월 1회 배치)",
        "홈쇼핑모아 지표 크롤러 실행 (W2)",
        "결제 내역 관리 (W4)",
      ]}
    />
  );
}
