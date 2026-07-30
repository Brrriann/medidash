import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/supabase/env";
import { signOutAction } from "@/app/(auth)/actions";
import { OnboardingForm } from "@/components/auth/OnboardingForm";

export const metadata: Metadata = { title: "수강생 코드 확인" };

/**
 * 소셜 로그인으로 들어왔지만 아직 수강생 코드를 안 낸 사용자를 받는 화면.
 *
 * 이 앱은 수강생 전용이라 **로그인만으로는 대시보드를 열어주지 않는다.** 입장권은
 * `profiles` 행이고, 그 행은 코드를 낸 사람에게만 생긴다. 대시보드 레이아웃과 AI
 * 라우트가 프로필 유무로 막고, 여기서 그 프로필을 만든다.
 */
export default async function OnboardingPage() {
  if (isMockMode()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 이미 코드를 낸 사람이 주소로 직접 들어온 경우 되돌려 보낸다.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile) redirect("/");

  return (
    <>
      <h1 className="text-lg font-semibold text-slate-900">수강생 코드 확인</h1>
      <p className="mt-1.5 mb-5 text-sm leading-relaxed text-slate-500">
        <span className="font-medium text-slate-700">{user.email}</span> 계정으로
        로그인했습니다. 헬스셀러는 수강생 전용이라 발급받으신 코드를 한 번만 확인합니다.
      </p>

      <OnboardingForm />

      <div className="mt-5 border-t border-slate-100 pt-4 text-center">
        <p className="text-xs text-slate-400">
          코드가 없으신가요? 운영자에게 문의해 주세요.
        </p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="mt-2 text-xs font-semibold text-slate-500 underline-offset-2 hover:underline"
          >
            다른 계정으로 로그인
          </button>
        </form>
      </div>
    </>
  );
}
