import Link from "next/link";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { isMockMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/(auth)/actions";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const mock = isMockMode();

  let email: string | null = null;
  let isAdmin = false;

  if (!mock) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
    if (user) {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      // **입장권은 로그인이 아니라 프로필이다.**
      // 소셜 로그인은 수강생 코드 없이도 계정을 만들 수 있으므로, 로그인 여부만 보는
      // 미들웨어만으로는 관문이 뚫린다. 코드를 낸 사람에게만 profiles 행이 생기니
      // 그 행이 없으면 대시보드 대신 코드 입력 화면으로 보낸다.
      // (미들웨어에 두지 않은 건 여기서 이미 프로필을 읽고 있어 추가 조회가 없기 때문이다.
      //  api/ 경로는 미들웨어를 안 타므로 각 라우트가 따로 확인한다 — api/ai/image 참고.)
      //
      // **조회 실패(error)와 행 없음을 구분한다.** 일시적인 DB 오류까지 "코드 미제출"로
      // 보면 이미 가입한 수강생이 쓰지도 않은 코드를 다시 내라는 화면에 갇힌다.
      // 관문이 막아야 할 대상(새 소셜 계정)은 오류가 아니라 깨끗한 "행 없음"으로 나온다.
      if (!error && !profile) redirect("/onboarding");
      isAdmin = profile?.role === "admin";
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* mock 모드에선 admin 메뉴도 노출해 전체 화면 구조를 확인할 수 있게 한다 */}
      <Sidebar showAdmin={mock || isAdmin} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* pl-16: 모바일 햄버거(Sidebar 내 fixed 버튼) 자리 확보 */}
        <header className="flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white pl-16 pr-6 md:px-6">
          <div className="flex items-center gap-2">
            {mock && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                Mock 모드 — Supabase 미연결
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            {email ? (
              <>
                <span className="text-slate-500">{email}</span>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    로그아웃
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                로그인
              </Link>
            )}
          </div>
        </header>

        <main className="grid-surface min-w-0 flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
