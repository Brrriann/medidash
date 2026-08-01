import type { Metadata } from "next";
import { isMockMode } from "@/lib/supabase/env";
import { LoginForm } from "@/components/auth/LoginForm";
import { MockNotice } from "@/components/auth/MockNotice";
import { AuthDivider, SocialButtons } from "@/components/auth/SocialButtons";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // 소셜 로그인 실패는 콜백 라우트가 ?error=로 되돌려 보낸다 (동의 취소·설정 누락 등).
  const { error } = await searchParams;
  const mock = isMockMode();

  return (
    <>
      {mock && <MockNotice />}

      <h1 className="mb-4 text-lg font-semibold text-slate-900">로그인</h1>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      {/* mock 모드에서도 보여준다 — 화면 구조를 확인하려고 두는 모드인데 여기만 빠지면
          레이아웃 검증이 안 된다. 눌러도 액션이 mock 안내로 되돌려 보내니 안전하다. */}
      <div className="mb-5 space-y-4">
        <SocialButtons />
        <AuthDivider />
      </div>

      <LoginForm />
    </>
  );
}
