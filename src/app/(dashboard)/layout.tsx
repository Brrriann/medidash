import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { isMockMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

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
      {/* mock 모드에선 admin 메뉴도 노출해 전체 화면 구조를 확인할 수 있게 한다.
          계정·mock 표시는 레일 아래로 들어갔다 — 종전 상단 헤더(56px)가 그것만 담고
          있어서 페이지 머리글과 머리띠가 두 겹이 됐다. */}
      <Sidebar showAdmin={mock || isAdmin} email={email} mock={mock} />

      {/* pt-16 md:pt-0 — 모바일에선 좌상단 햄버거가 본문 위에 떠 있으므로 그만큼 비운다 */}
      <main className="grid-surface min-w-0 flex-1 px-4 pt-16 pb-6 md:px-6 md:pt-6">
        {children}
      </main>
    </div>
  );
}
