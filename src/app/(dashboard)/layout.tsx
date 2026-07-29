import Link from "next/link";
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
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
